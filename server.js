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

await mongoose.connect(process.env.MONGO_URI);
console.log('MongoDB connected – TTL active (30 min)');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 1e6
});

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  let roomId, peerId;

  socket.on('join', async ({ room, peer }) => {
    roomId = room;
    peerId = peer;
    socket.join(roomId);

    const history = await Message.find({ roomId }).sort({ createdAt: 1 }).limit(200);
    socket.emit('history', history.map(m => ({
      ...m.toObject(),
      isMe: m.sender === peerId
    })));

    io.to(roomId).emit('online-count', io.sockets.adapter.rooms.get(roomId)?.size || 0);
  });

  socket.on('message', async (data) => {
    const msg = new Message({
      roomId,
      ciphertext: data.ciphertext,
      iv: data.iv,
      sender: peerId
    });
    await msg.save();
    io.to(roomId).emit('message', { ...msg.toObject(), isMe: false });
  });

  socket.on('typing', (isTyping) => {
    socket.to(roomId).emit('typing', { peerId, isTyping });
  });

  socket.on('disconnect', () => {
    if (roomId) {
      io.to(roomId).emit('online-count', io.sockets.adapter.rooms.get(roomId)?.size || 0);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`VoidChat running on https://localhost:${PORT}`);
});
