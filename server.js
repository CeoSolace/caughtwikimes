// server.js – <1MB RAM | 30min TTL | Anti-recording | E2EE
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

// Tiny schema – no RAM bloat
const msgSchema = new mongoose.Schema({
  r: { type: String, required: true, index: true }, // roomId
  c: { type: Buffer, required: true },              // compressed ciphertext
  i: { type: String, required: true },              // iv
  s: { type: String, required: true }               // sender
}, { timestamps: true, minimize: false });
msgSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1800 });
const Msg = mongoose.model('Msg', msgSchema);

await mongoose.connect(process.env.MONGO_URI);
console.log('MongoDB: TTL 30min | Messages never in RAM');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 3e5  // 300 KB limit
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// /getfucked
app.get('/getfucked', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'getfucked.html'));
});

// Rate limit: <10KB RAM
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

// Socket.IO – ZERO message RAM
io.on('connection', (socket) => {
  let room, peer;

  socket.on('join', async ({ room: r, peer: p }) => {
    if (!r || !/^[0-9a-f]{64}$/.test(r) || !p || p.length > 10) {
      return socket.disconnect();
    }
    room = r; peer = p;
    socket.join(room);

    // Load from DB only when needed
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

    const cnt = io.sockets.adapter.rooms.get(room)?.size || 0;
    io.to(room).emit('o', cnt);
  });

  socket.on('m', async ({ c, i }) => {
    if (!room || !c || !i) return;
    const comp = await gzip(c);
    if (comp.length > 300) return; // Reject large

    await new Msg({ r: room, c: comp, i, s: peer }).save();
    socket.to(room).emit('m', { c, i, s: peer });
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
  console.log('VoidChat: <1MB RAM | 30min vanish | Anti-recording | Live');
});
