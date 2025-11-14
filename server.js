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
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v2 as cloudinary } from 'cloudinary';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// User schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  email: { type: String, required: false, unique: true, sparse: true },
  avatar: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

// Server schema
const serverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  id: { type: String, required: true, unique: true, index: true },
  ownerId: { type: String, required: true },
  icon: { type: String, default: null },
  iconId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

// Channel schema
const channelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  serverId: { type: String, required: true, index: true },
  ownerId: { type: String, required: true },
  type: { type: String, default: 'text' },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Role schema
const roleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  serverId: { type: String, required: true, index: true },
  color: { type: String, default: '#ffffff' },
  position: { type: Number, default: 0 },
  permissions: { type: Number, default: 0 }
}, { timestamps: true });

// Member schema
const memberSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  serverId: { type: String, required: true, index: true },
  roles: [{ type: String }],
  banned: { type: Boolean, default: false },
  timeoutUntil: { type: Date, default: null },
  joinedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Message schema
const msgSchema = new mongoose.Schema({
  channelId: { type: String, required: true, index: true },
  c: { type: Buffer, required: true },
  i: { type: String, required: true },
  s: { type: String, required: true },
  rep: { type: String, default: null },
  attachments: [{
    url: String,
    publicId: String,
    type: String,
    filename: String,
    size: Number
  }]
}, { timestamps: true, minimize: false });

// Audit Log schema
const auditLogSchema = new mongoose.Schema({
  serverId: { type: String, required: true, index: true },
  action: { type: String, required: true },
  userId: { type: String, required: true },
  targetId: { type: String },
  details: { type: Object, default: {} },
  ip: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// TTL indexes
msgSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1800 }); // 30 minutes
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

const User = mongoose.model('User', userSchema);
const ServerModel = mongoose.model('Server', serverSchema);
const Channel = mongoose.model('Channel', channelSchema);
const Role = mongoose.model('Role', roleSchema);
const Member = mongoose.model('Member', memberSchema);
const Msg = mongoose.model('Msg', msgSchema);
const AuditLog = mongoose.model('AuditLog', auditLogSchema);

// Permission constants
const Permissions = {
  ADMINISTRATOR: 1n << 25n,
  CREATE_CHANNELS: 1n,
  MANAGE_CHANNELS: 1n << 1n,
  MANAGE_ROLES: 1n << 2n,
  KICK_MEMBERS: 1n << 3n,
  BAN_MEMBERS: 1n << 4n,
  TIMEOUT_MEMBERS: 1n << 5n,
  MANAGE_MESSAGES: 1n << 6n,
  SEND_MESSAGES: 1n << 7n,
  READ_MESSAGES: 1n << 8n,
  UPLOAD_FILES: 1n << 9n,
  CONNECT_VOICE: 1n << 10n,
  SPEAK_VOICE: 1n << 11n,
  VIEW_AUDIT_LOGS: 1n << 12n
};

await mongoose.connect(process.env.MONGO_URI);
console.log('✅ MongoDB connected | 30min TTL enabled');

// Create default server
const initializeDefault = async () => {
  const defaultServer = await ServerModel.findOne({ id: 'general' });
  if (!defaultServer) {
    await new ServerModel({ name: 'General', id: 'general', ownerId: 'system' }).save();
    await new Channel({ name: 'general', serverId: 'general', ownerId: 'system', type: 'text' }).save();
    await new Channel({ name: 'General Voice', serverId: 'general', ownerId: 'system', type: 'voice' }).save();
    await new Role({ 
      name: '@everyone', 
      serverId: 'general', 
      permissions: BigInt(Permissions.READ_MESSAGES | Permissions.SEND_MESSAGES | Permissions.UPLOAD_FILES | Permissions.CONNECT_VOICE | Permissions.SPEAK_VOICE | Permissions.VIEW_AUDIT_LOGS) 
    }).save();
    console.log('🔧 Created default server and channels');
  }
};

initializeDefault();

// Auto-clear all messages every 30 minutes
const clearAllMessages = async () => {
  try {
    const result = await Msg.deleteMany({});
    console.log(`🧹 [Auto-Clear] Deleted ${result.deletedCount} messages`);
  } catch (err) {
    console.error('❌ [Auto-Clear] Failed:', err);
  }
};

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
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Log audit events
const logAudit = async (serverId, action, userId, targetId = null, details = {}, req = null) => {
  try {
    await new AuditLog({
      serverId,
      action,
      userId,
      targetId,
      details,
      ip: req ? req.ip : null
    }).save();
  } catch (err) {
    console.error('Audit log failed:', err);
  }
};

// Serve pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/server/:serverId/channel/:channelId', (req, res) => {
  const { serverId, channelId } = req.params;
  if (!/^[a-zA-Z0-9_-]+$/.test(serverId) || !/^[a-zA-Z0-9_-]+$/.test(channelId)) {
    return res.status(400).send('Invalid IDs');
  }
  res.sendFile(path.join(__dirname, 'public', 'channel.html'));
});

// API endpoints
app.get('/api/servers', async (req, res) => {
  try {
    const servers = await ServerModel.find({}, 'name id icon');
    res.json(servers);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load servers' });
  }
});

app.get('/api/server/:serverId/channels', async (req, res) => {
  try {
    const { serverId } = req.params;
    const channels = await Channel.find({ serverId }, 'name type');
    res.json(channels);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load channels' });
  }
});

// Audit logs endpoint
app.get('/api/server/:serverId/audit-logs', authenticateToken, async (req, res) => {
  try {
    const { serverId } = req.params;
    const logs = await AuditLog.find({ serverId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load audit logs' });
  }
});

// User authentication
app.post('/api/register', async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  
  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) return res.status(400).json({ error: 'Username or email already exists' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword, email: email || undefined });
    await user.save();
    
    const token = jwt.sign({ id: user._id.toString(), username: user.username }, process.env.JWT_SECRET || 'fallback_secret');
    res.json({ token, username: user.username });
  } catch (e) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  
  try {
    const user = await User.findOne({ username });
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user._id.toString(), username: user.username }, process.env.JWT_SECRET || 'fallback_secret');
    res.json({ token, username: user.username });
  } catch (e) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Middleware for auth
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Authenticated endpoints
app.get('/api/me', authenticateToken, (req, res) => {
  res.json({ username: req.user.username, id: req.user.id });
});

// Server creation with Cloudinary upload
app.post('/api/servers', authenticateToken, async (req, res) => {
  const { name, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'Server name required' });
  
  try {
    const serverId = crypto.randomUUID().replace(/-/g, '').substring(0, 12);
    let iconUrl = null;
    let iconId = null;
    
    if (icon && icon.startsWith('')) {
      try {
        const uploadResult = await cloudinary.uploader.upload(icon, {
          folder: 'caughtwiki/servers',
          resource_type: 'auto',
          public_id: `server_${serverId}_${Date.now()}`
        });
        iconUrl = uploadResult.secure_url;
        iconId = uploadResult.public_id;
      } catch (uploadErr) {
        console.error('Cloudinary upload failed:', uploadErr);
      }
    }
    
    const server = new ServerModel({ 
      name, 
      id: serverId, 
      ownerId: req.user.id,
      icon: iconUrl,
      iconId: iconId
    });
    await server.save();
    
    // Create default channels
    await new Channel({ 
      name: 'general', 
      serverId: serverId, 
      ownerId: req.user.id,
      type: 'text'
    }).save();
    
    await new Channel({ 
      name: 'General Voice', 
      serverId: serverId, 
      ownerId: req.user.id,
      type: 'voice'
    }).save();
    
    // Create @everyone role
    await new Role({ 
      name: '@everyone', 
      serverId: serverId, 
      permissions: BigInt(Permissions.READ_MESSAGES | Permissions.SEND_MESSAGES | Permissions.UPLOAD_FILES | Permissions.CONNECT_VOICE | Permissions.SPEAK_VOICE | Permissions.VIEW_AUDIT_LOGS) 
    }).save();
    
    // Add owner as member
    await new Member({ 
      userId: req.user.id, 
      serverId: serverId 
    }).save();
    
    // Log server creation
    await logAudit(serverId, 'SERVER_CREATE', req.user.id, null, { serverName: name }, req);
    
    res.json({ id: serverId, name, icon: server.icon });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create server' });
  }
});

// File upload endpoint
app.post('/api/upload', authenticateToken, async (req, res) => {
  const { file, channelId } = req.body;
  if (!file || !channelId) return res.status(400).json({ error: 'File and channel required' });
  
  try {
    const uploadResult = await cloudinary.uploader.upload(file, {
      folder: 'caughtwiki/channels',
      resource_type: 'auto',
      public_id: `msg_${channelId}_${Date.now()}`
    });
    
    res.json({
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      type: uploadResult.resource_type,
      filename: uploadResult.original_filename,
      size: uploadResult.bytes
    });
  } catch (e) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Simple rate limiter
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

// Content moderation
const isContentAllowed = (text) => {
  const lowerText = text.toLowerCase();
  const prohibited = ['racism', 'terrorism', 'nazi', 'hitler', 'incite violence', 'plan harm'];
  return !prohibited.some(term => lowerText.includes(term));
};

// Socket.IO logic
io.on('connection', (socket) => {
  let channel, peer, userId;

  // Auth handshake
  socket.on('auth', async (data) => {
    if (data.token) {
      try {
        const decoded = jwt.verify(data.token, process.env.JWT_SECRET || 'fallback_secret');
        userId = decoded.id;
        peer = decoded.username;
      } catch (e) {
        peer = data.tempUsername;
        userId = 'temp_' + crypto.randomUUID().substring(0, 8);
      }
    } else if (data.tempUsername) {
      peer = data.tempUsername;
      userId = 'temp_' + crypto.randomUUID().substring(0, 8);
    } else {
      return socket.disconnect(true);
    }
  });

  socket.on('join', async ({ channel: ch }) => {
    if (!ch) return socket.disconnect(true);
    channel = ch;
    socket.join(channel);
    
    try {
      const hist = await Msg.find({ channelId: channel }).sort({ createdAt: 1 }).limit(100).lean();
      const decompressed = await Promise.all(
        hist.map(async (m) => {
          const buffer = Buffer.isBuffer(m.c) ? m.c : Buffer.from(m.c.buffer);
          const plaintext = (await gunzip(buffer)).toString();
          return {
            _id: m._id.toString(),
            c: plaintext,
            i: m.i,
            s: m.s,
            rep: m.rep,
            attachments: m.attachments || []
          };
        })
      );

      socket.emit('h', decompressed);
      const cnt = io.sockets.adapter.rooms.get(channel)?.size || 0;
      io.to(channel).emit('o', cnt);

      if (decompressed.length > 0) {
        const last = decompressed[decompressed.length - 1];
        const prefix = last.s === peer ? 'You' : last.s;
        socket.emit('lm', `${prefix}: ${last.c.slice(0, 20)}...`);
      }
    } catch (err) {
      console.error('History load error:', err);
    }
  });

  socket.on('m', async ({ c, i, rep,
