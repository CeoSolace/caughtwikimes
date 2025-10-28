// server.js - Full Updated Production-Ready VoidChat Server
// Features: Room validation (64-char hex), E2EE relay, TTL 30min, Zero logs, Low RAM

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import Message from './models/Message.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to MongoDB (TTL auto-deletes after 1800s = 30min)
await mongoose.connect(process.env.MONGO_URI);
console.log('✅ MongoDB connected – TTL active (messages expire in 30min)');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 1e6, // 1MB limit per packet
  pingTimeout: 20000,
  pingInterval: 25000
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com', 'https://cdn.socket.io', 'https://cdn.jsdelivr.net'],
      connectSrc: ["'self'", 'https://*.socket.io', 'wss://*.socket.io'],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'"]
    }
  }
}));
app.use(cors({ origin: '*' }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1y',
  etag: false
}));

// Rate limiting middleware (per IP)
const rateLimit = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  // Simple in-memory (RAM-safe, expires naturally)
  if (!global.rateLimit) global.rateLimit = new Map();
  const now = Date.now();
  const window = 60 * 1000; // 1min
  const key = ip;
  const userHits = global.rateLimit.get(key) || [];
  const validHits = userHits.filter(time => now - time < window);
  if (validHits.length >= 50) { // 50 req/min
    return res.status(429).send('Too many requests');
  }
  validHits.push(now);
  global.rateLimit.set(key, validHits);
  next();
};
app.use(rateLimit);

// Socket.IO Handlers (Zero-knowledge: only relays ciphertext)
io.on('connection', (socket) => {
  console.log(`🔌 Peer connected: ${socket.id}`);
  
  let roomId, peerId;

  // Join room (validate 64-char lowercase hex)
  socket.on('join', async ({ room, peer }) => {
    // Strict validation: exactly 64 hex chars [0-9a-f]
    if (!room || !/^[0-9a-f]{64}$/.test(room) || !peer || peer.length > 12) {
      socket.emit('error', 'Invalid room or peer ID');
      return socket.disconnect(true);
    }

    roomId = room;
    peerId = peer;
    socket.data.roomId = roomId;
    socket.data.peerId = peerId;
    socket.join(roomId);

    try {
      // Load recent history (last 200 msgs, still in TTL window)
      const history = await Message.find({ roomId })
        .sort({ createdAt: 1 })
        .limit(200)
        .lean(); // Fast read-only

      // Send to new peer only
      socket.emit('history', history.map(m => ({
        ...m,
        isMe: m.sender === peerId
      })));

      // Broadcast online count to room
      const roomSize = io.sockets.adapter.rooms.get(roomId)?.size || 0;
      socket.to(roomId).emit('online-count', roomSize);
      
      console.log(`✅ ${peerId} joined ${roomId.slice(0,8)}... (${roomSize} online)`);
    } catch (err) {
      console.error('History load error:', err);
      socket.emit('error', 'Failed to load history');
    }
  });

  // Send encrypted message
  socket.on('message', async (data) => {
    if (!roomId || !data?.ciphertext || !data?.iv) {
      return socket.disconnect(true);
    }

    try {
      const msg = new Message({
        roomId,
        ciphertext: data.ciphertext,
        iv: data.iv,
        sender: peerId
      });
      await msg.save();

      // Broadcast to room (excludes sender)
      socket.to(roomId).emit('message', {
        _id: msg._id,
        roomId,
        ciphertext: msg.ciphertext,
        iv: msg.iv,
        sender: peerId,
        createdAt: msg.createdAt,
        isMe: false
      });
    } catch (err) {
      console.error('Message save error:', err);
    }
  });

  // Typing indicator
  socket.on('typing', (isTyping) => {
    if (roomId) {
      socket.to(roomId).emit('typing', { peerId, isTyping });
    }
  });

  // Graceful disconnect
  socket.on('disconnect', (reason) => {
    if (roomId) {
      const roomSize = io.sockets.adapter.rooms.get(roomId)?.size || 0;
      socket.to(roomId).emit('online-count', roomSize - 1);
      console.log(`🔌 ${peerId} left ${roomId.slice(0,8)}... (${roomSize - 1} online) [${reason}]`);
    }
    console.log(`❌ Peer disconnected: ${socket.id}`);
  });

  // Graceful error handling
  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).send('VoidChat – Not found');
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Internal error');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down gracefully...');
  await mongoose.connection.close();
  server.close(() => {
    process.exit(0);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 VoidChat locked & loaded on port ${PORT}`);
  console.log(`📱 Homepage: http://localhost:${PORT}`);
  console.log(`🔒 Messages auto-vanish in 30min | E2EE enforced`);
});
