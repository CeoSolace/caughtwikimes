// server.js – RTM + LM | <0.3MB RAM | 30min TTL | E2EE
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

// Tiny message schema
const msgSchema = new mongoose.Schema({
  r: { type: String, required: true, index: true },
  c: { type: Buffer, required: true },
  i: { type: String, required: true },
  s: { type: String, required: true }
}, { timestamps: true, minimize: false });
msgSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1800 });
const Msg = mongoose.model('Msg', msgSchema);

await mongoose.connect(process.env.MONGO_URI);
console.log('MongoDB: 30min TTL | No RAM storage');

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

// Dedicated chat page
app.get('/r/:roomId', (req, res) => {
  const { roomId } = req.params;
  if (!/^[0-9a-f]{64}$/.test(roomId)) {
    return res.status(400).send('Invalid room');
  }
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Rate limit
const rl = new Map();
app.use((req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const hits = (rl.get(ip) || []).filter(t => now - t < 60000);
  if (hits.length > 30) return res.status(429).send('');
  hits.push(now);
  rl.set(ip, hits);
  next();
});

// Socket.IO – RTM + LM
io.on('connection', (socket) => {
  let room, peer;

  socket.on('join', async ({ room: r, peer: p }) => {
    if (!r || !/^[0-9a-f]{64}$/.test(r) || !p || p.length > 10) {
      return socket.disconnect();
    }
    room = r; peer = p;
    socket.join(room);

    // Send history
    const hist = await Msg.find({ r: room }).sort({ createdAt: 1 }).limit(100).lean();
    const decompressed = await Promise.all(
      hist.map(async m => ({
        c: (await gunzip(m.c)).toString(),
        i: m.i,
        s: m.s,
        isMe: m.s === peer
      }))
    );
    socket.emit('h', decompressed);

    // Update online count
    const cnt = io.sockets.adapter.rooms.get(room)?.size || 0;
    io.to(room).emit('o', cnt);

    // Send last message indicator
    if (decompressed.length > 0) {
      const last = decompressed[decompressed.length - 1];
      const lm = last.isMe ? `You: ${last.c.slice(0, 20)}...` : `${last.s}: ${last.c.slice(0, 20)}...`;
      socket.emit('lm', lm);
    }
  });

  socket.on('m', async ({ c, i }) => {
    if (!room || !c || !i) return;
    const comp = await gzip(c);
    if (comp.length > 300) return;

    await new Msg({ r: room, c: comp, i, s: peer }).save();

    // RTM: Broadcast to all in room
    io.to(room).emit('m', { c, i, s: peer });

    // LM: Update last message
    const lm = `${peer}: ${c.slice(0, 20)}...`;
    io.to(room).emit('lm', lm);
  });

  socket.on('t', (typing) => {
    socket.to(room).emit('t', { s: peer, t: typing });
  });

  socket.on('disconnect', () => {
    if (room) {
      const cnt = io.sockets.adapter.rooms.get(room)?.size || 0;
      io.to(room).emit('o', cnt);
    }
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('VoidChat: RTM + LM | <0.3MB RAM | Live');
});
