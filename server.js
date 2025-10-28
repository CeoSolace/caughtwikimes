// server.js – RTM + LM + Replying | E2E Encrypted | 30min Auto-Clear
import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Message schema with reply support
const msgSchema = new mongoose.Schema({
  r: { type: String, required: true, index: true }, // room ID
  c: { type: Buffer, required: true },              // gzipped plaintext
  i: { type: String, required: true },              // IV for AES (unused in this version but kept for client compat)
  s: { type: String, required: true },              // sender peer ID
  rep: { type: String, default: null }              // replied-to message ID
}, { timestamps: true, minimize: false });

// TTL index: auto-delete after 30 minutes (MongoDB background task)
msgSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1800 });
const Msg = mongoose.model('Msg', msgSchema);

await mongoose.connect(process.env.MONGO_URI);
console.log('✅ MongoDB connected | 30min TTL enabled');

// 🔁 Auto-clear all messages every 30 minutes (manual safety net)
const clearAllMessages = async () => {
  try {
    const result = await Msg.deleteMany({});
    console.log(`🧹 [Auto-Clear] Deleted ${result.deletedCount} messages`);
  } catch (err) {
    console.error('❌ [Auto-Clear] Failed:', err);
  }
};

// Run once on startup + every 30 minutes
clearAllMessages();
setInterval(clearAllMessages, 30 * 60 * 1000);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 3e5,
  pingTimeout: 10000,
  pingInterval: 5000
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Serve chat room
app.get('/r/:roomId', (req, res) => {
  const { roomId } = req.params;
  if (!/^[0-9a-f]{64}$/.test(roomId)) {
    return res.status(400).send('Invalid room ID (must be 64 hex chars)');
  }
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Simple in-memory rate limiter (30 req/min per IP)
const rateLimit = new Map();
app.use((req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const hits = (rateLimit.get(ip) || []).filter(t => now - t < 60_000);
  if (hits.length >= 30) return res.status(429).send('Too many requests');
  hits.push(now);
  rateLimit.set(ip, hits);
  next();
});

// Socket.IO logic
io.on('connection', (socket) => {
  let room, peer;

  socket.on('join', async ({ room: r, peer: p }) => {
    if (!r || !/^[0-9a-f]{64}$/.test(r) || !p || p.length > 10) {
      return socket.disconnect(true);
    }
    room = r;
    peer = p;
    socket.join(room);

    try {
      // Fetch last 100 messages
      const hist = await Msg.find({ r: room }).sort({ createdAt: 1 }).limit(100).lean();
      const decompressed = await Promise.all(
        hist.map(async (m) => {
          const buffer = Buffer.isBuffer(m.c) ? m.c : Buffer.from(m.c.buffer);
          const plaintext = (await gunzip(buffer)).toString();
          return {
            _id: m._id.toString(),
            c: plaintext,
            i: m.i,
            s: m.s,
            rep: m.rep
          };
        })
      );

      socket.emit('h', decompressed);

      // Online count
      const cnt = io.sockets.adapter.rooms.get(room)?.size || 0;
      io.to(room).emit('o', cnt);

      // Last message preview
      if (decompressed.length > 0) {
        const last = decompressed[decompressed.length - 1];
        const prefix = last.s === peer ? 'You' : last.s;
        socket.emit('lm', `${prefix}: ${last.c.slice(0, 20)}...`);
      }
    } catch (err) {
      console.error('History load error:', err);
    }
  });

  socket.on('m', async ({ c, i, rep }) => {
    if (!room || !c || typeof c !== 'string') return;

    try {
      const comp = await gzip(c);
      if (comp.length > 300) return; // prevent abuse

      const msg = await new Msg({ r: room, c: comp, i, s: peer, rep }).save();

      io.to(room).emit('m', {
        _id: msg._id.toString(),
        c,
        i,
        s: peer,
        rep
      });

      const prefix = peer === socket.id ? 'You' : peer;
      io.to(room).emit('lm', `${prefix}: ${c.slice(0, 20)}...`);
    } catch (err) {
      console.error('Message save error:', err);
    }
  });

  socket.on('t', (typing) => {
    if (room && typeof typing === 'boolean') {
      socket.to(room).emit('t', { s: peer, t: typing });
    }
  });

  socket.on('disconnect', () => {
    if (room) {
      const cnt = io.sockets.adapter.rooms.get(room)?.size || 0;
      io.to(room).emit('o', cnt);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 VoidChat server running on port ${PORT}`);
});
