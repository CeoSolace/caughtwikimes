import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import DiscordStrategy from 'passport-discord';
import { Server } from 'socket.io';
import http from 'http';
import { config } from './config';
import { User, ServerModel, Channel, Message, Report, Boost } from './models';
import { 
  createServer, 
  getServerById, 
  addUserToServer, 
  createChannel, 
  sendMessage, 
  getMessages, 
  createReport,
  addBoost,
  createAdminUser,
  clearOldMessages
} from './services';

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://caught.wiki', 'https://*.onrender.com'] 
      : ['http://localhost:3000'],
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://caught.wiki', 'https://*.onrender.com'] 
    : ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret: config.PASSPHRASE_SALT,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport setup
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Discord OAuth Strategy
passport.use(new DiscordStrategy({
  clientID: config.DISCORD_CLIENT_ID,
  clientSecret: config.DISCORD_CLIENT_SECRET,
  callbackURL: config.DISCORD_REDIRECT_URI,
  scope: ['identify', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ discordId: profile.id });
    
    if (user) {
      // Update existing user
      user.username = profile.username;
      user.email = profile.email;
      user.avatar = profile.avatar;
      await user.save();
    } else {
      // Create new permanent user
      user = new User({
        discordId: profile.id,
        username: profile.username,
        email: profile.email,
        avatar: profile.avatar,
        accountType: 'permanent',
        status: 'active'
      });
      await user.save();
    }
    
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

// Database connection
mongoose.connect(config.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('joinChannel', (channelId) => {
    socket.join(channelId);
    console.log(`User ${socket.id} joined channel ${channelId}`);
  });
  
  socket.on('leaveChannel', (channelId) => {
    socket.leave(channelId);
    console.log(`User ${socket.id} left channel ${channelId}`);
  });
  
  socket.on('sendMessage', async (data) => {
    try {
      const { content, channelId, userId, username } = data;
      
      // Validate message
      if (!content || !channelId || !userId) {
        return;
      }
      
      // Sanitize content
      const sanitizedContent = content.replace(/<[^>]*>/g, '');
      
      // Create message in database
      const message = new Message({
        content: sanitizedContent,
        userId,
        username,
        channelId
      });
      await message.save();
      
      // Emit to channel
      io.to(channelId).emit('newMessage', {
        ...message.toObject(),
        staff: false // In a real implementation, check if user is staff
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Routes
// Authentication routes
app.get('/api/auth/discord', passport.authenticate('discord'));

app.get('/api/auth/discord/callback', 
  passport.authenticate('discord', { failureRedirect: '/auth' }),
  (req, res) => {
    // Successful authentication
    res.redirect('/');
  }
);

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // For temporary accounts, we'll create a session-based user
    // In a real implementation, you'd have proper authentication
    const user = await User.findOne({ username });
    
    if (user) {
      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: 'Login failed' });
        res.json({ user: { 
          id: user._id, 
          username: user.username, 
          staff: user.staff,
          accountType: user.accountType 
        }});
      });
    } else {
      // Create temporary account
      const tempUser = new User({
        username,
        accountType: 'temporary',
        status: 'active'
      });
      await tempUser.save();
      
      req.login(tempUser, (err) => {
        if (err) return res.status(500).json({ message: 'Login failed' });
        res.json({ user: { 
          id: tempUser._id, 
          username: tempUser.username, 
          staff: tempUser.staff,
          accountType: tempUser.accountType 
        }});
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Login failed' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // For this implementation, we'll create a temporary account
    // In a real system, you'd have proper registration with password hashing
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    
    const user = new User({
      username,
      email: email || undefined,
      accountType: 'temporary',
      status: 'active'
    });
    await user.save();
    
    req.login(user, (err) => {
      if (err) return res.status(500).json({ message: 'Registration failed' });
      res.json({ user: { 
        id: user._id, 
        username: user.username, 
        staff: user.staff,
        accountType: user.accountType 
      }});
    });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed' });
  }
});

// User routes
app.get('/api/users/:userId/servers', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const servers = await ServerModel.find({
      $or: [
        { ownerId: userId },
        { members: { $in: [userId] } }
      ]
    });
    
    res.json({ servers });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching servers' });
  }
});

// Server routes
app.post('/api/servers', async (req, res) => {
  try {
    const { name, ownerId } = req.body;
    
    // Check if user is permanent account
    const user = await User.findById(ownerId);
    if (!user || user.accountType !== 'permanent') {
      return res.status(403).json({ message: 'Permanent account required to create servers' });
    }
    
    const server = await createServer(name, ownerId);
    res.status(201).json({ server });
  } catch (error) {
    res.status(500).json({ message: 'Error creating server' });
  }
});

app.get('/api/servers/:serverId/channels', async (req, res) => {
  try {
    const { serverId } = req.params;
    const channels = await Channel.find({ serverId });
    res.json({ channels });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching channels' });
  }
});

// Channel routes
app.post('/api/channels', async (req, res) => {
  try {
    const { name, serverId, userId } = req.body;
    
    // Check if user has permission to create channel
    const server = await getServerById(serverId);
    if (!server || server.ownerId.toString() !== userId) {
      return res.status(403).json({ message: 'Permission denied' });
    }
    
    const channel = await createChannel(name, serverId);
    res.status(201).json({ channel });
  } catch (error) {
    res.status(500).json({ message: 'Error creating channel' });
  }
});

// Message routes
app.get('/api/channels/:channelId/messages', async (req, res) => {
  try {
    const { channelId } = req.params;
    const messages = await getMessages(channelId);
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const { content, channelId, userId } = req.body;
    
    const message = await sendMessage(content, channelId, userId);
    res.status(201).json({ message });
  } catch (error) {
    res.status(500).json({ message: 'Error sending message' });
  }
});

// Report routes
app.post('/api/reports', async (req, res) => {
  try {
    const { reporterId, targetId, reason, evidence, type } = req.body;
    
    const report = await createReport(reporterId, targetId, reason, evidence, type);
    res.status(201).json({ report });
  } catch (error) {
    res.status(500).json({ message: 'Error creating report' });
  }
});

// Boost routes
app.post('/api/boosts', async (req, res) => {
  try {
    const { serverId, userId } = req.body;
    
    // Check if user has permanent account
    const user = await User.findById(userId);
    if (!user || user.accountType !== 'permanent') {
      return res.status(403).json({ message: 'Permanent account required to boost' });
    }
    
    // Check if server already has max boosts
    const server = await getServerById(serverId);
    if (server.boosts >= 20) {
      return res.status(400).json({ message: 'Server already has maximum boosts (20)' });
    }
    
    const boost = await addBoost(serverId, userId);
    res.status(201).json({ boost });
  } catch (error) {
    res.status(500).json({ message: 'Error adding boost' });
  }
});

app.get('/api/servers/:serverId/boosts', async (req, res) => {
  try {
    const { serverId } = req.params;
    const boosts = await Boost.find({ serverId });
    const totalBoosts = boosts.length;
    
    res.json({ totalBoosts, boosts });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching boosts' });
  }
});

// Admin routes
app.get('/api/admin/reports', async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });
    res.json({ reports });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching reports' });
  }
});

app.put('/api/admin/reports/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { action } = req.body;
    
    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    report.status = action === 'approve' ? 'approved' : 'rejected';
    await report.save();
    
    res.json({ report });
  } catch (error) {
    res.status(500).json({ message: 'Error updating report' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users' });
  }
});

app.get('/api/admin/servers', async (req, res) => {
  try {
    const servers = await ServerModel.find();
    res.json({ servers });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching servers' });
  }
});

// Initialize admin user
createAdminUser();

// Schedule message clearing (every 30 minutes)
setInterval(clearOldMessages, 30 * 60 * 1000);

// Start server
const PORT = config.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
