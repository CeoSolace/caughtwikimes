import { User, ServerModel, Channel, Message, Report, Boost } from './models';
import { IUser, IServer, IChannel, IMessage, IReport, IBoost } from './models';

// Create server
export const createServer = async (name: string, ownerId: string): Promise<IServer> => {
  const server = new ServerModel({
    name,
    ownerId,
    members: [ownerId],
    channels: []
  });
  
  await server.save();
  
  // Create default channel
  const defaultChannel = await createChannel('general', server._id.toString());
  server.channels.push(defaultChannel._id.toString());
  await server.save();
  
  return server;
};

// Get server by ID
export const getServerById = async (serverId: string): Promise<IServer | null> => {
  return await ServerModel.findById(serverId);
};

// Add user to server
export const addUserToServer = async (serverId: string, userId: string): Promise<void> => {
  const server = await ServerModel.findById(serverId);
  if (server && !server.members.includes(userId)) {
    server.members.push(userId);
    await server.save();
  }
};

// Create channel
export const createChannel = async (name: string, serverId: string): Promise<IChannel> => {
  const channel = new Channel({
    name,
    serverId,
    type: 'text'
  });
  
  await channel.save();
  
  // Add channel to server
  await ServerModel.findByIdAndUpdate(serverId, {
    $push: { channels: channel._id }
  });
  
  return channel;
};

// Send message
export const sendMessage = async (content: string, channelId: string, userId: string): Promise<IMessage> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  const message = new Message({
    content,
    userId,
    username: user.username,
    channelId,
    timestamp: new Date()
  });
  
  await message.save();
  return message;
};

// Get messages
export const getMessages = async (channelId: string): Promise<IMessage[]> => {
  // Get messages from last 30 minutes unless user is reported
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  
  // Find users who have active reports
  const reportedUsers = await Report.find({ status: 'pending' }).distinct('targetId');
  
  const messages = await Message.find({
    channelId,
    $or: [
      { timestamp: { $gte: thirtyMinutesAgo } },
      { userId: { $in: reportedUsers } }
    ],
    deleted: false
  }).sort({ timestamp: 1 });
  
  return messages;
};

// Create report
export const createReport = async (
  reporterId: string,
  targetId: string,
  reason: string,
  evidence?: string,
  type: 'normal' | 'danger' = 'normal'
): Promise<IReport> => {
  const report = new Report({
    reporterId,
    targetId,
    reason,
    evidence,
    type
  });
  
  await report.save();
  
  // If danger report, preserve all messages from target user
  if (type === 'danger') {
    await Message.updateMany(
      { userId: targetId },
      { $unset: { deleted: 1 } }
    );
  }
  
  return report;
};

// Add boost
export const addBoost = async (serverId: string, userId: string): Promise<IBoost> => {
  const boost = new Boost({
    serverId,
    userId
  });
  
  await boost.save();
  
  // Update server boost count
  await ServerModel.findByIdAndUpdate(serverId, {
    $inc: { boosts: 1 }
  });
  
  return boost;
};

// Create admin user
export const createAdminUser = async (): Promise<void> => {
  try {
    const adminUser = await User.findOne({ username: 'ceosolace' });
    if (!adminUser) {
      const admin = new User({
        username: 'ceosolace',
        accountType: 'permanent',
        staff: true,
        status: 'active'
      });
      await admin.save();
      console.log('Admin user created: ceosolace');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
};

// Clear old messages (run periodically)
export const clearOldMessages = async (): Promise<void> => {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    // Find users with active reports to exclude
    const reportedUsers = await Report.find({ status: 'pending' }).distinct('targetId');
    
    // Delete messages older than 30 minutes that are not from reported users
    const result = await Message.deleteMany({
      timestamp: { $lt: thirtyMinutesAgo },
      userId: { $nin: reportedUsers },
      deleted: false
    });
    
    console.log(`Cleared ${result.deletedCount} old messages`);
  } catch (error) {
    console.error('Error clearing old messages:', error);
  }
};

// Get user by IP for admin security
export const getUserByIP = async (ip: string): Promise<IUser | null> => {
  return await User.findOne({ ip });
};

// Update user IP for admin security
export const updateUserIP = async (userId: string, ip: string): Promise<void> => {
  await User.findByIdAndUpdate(userId, { ip });
};

// Check if user is admin
export const isAdmin = async (userId: string): Promise<boolean> => {
  const user = await User.findById(userId);
  return user?.staff || user?.username === 'ceosolace';
};

// Get server with encryption
export const getEncryptedServer = async (serverId: string, adminKey: string): Promise<any> => {
  const server = await ServerModel.findById(serverId);
  if (!server) return null;
  
  // Encrypt server ID for admin panel
  const encryptedId = btoa(serverId + adminKey.substring(0, 5));
  
  return {
    ...server.toObject(),
    encryptedId
  };
};

// Get user with encryption
export const getEncryptedUser = async (userId: string, adminKey: string): Promise<any> => {
  const user = await User.findById(userId);
  if (!user) return null;
  
  // Encrypt user ID for admin panel
  const encryptedId = btoa(userId + adminKey.substring(0, 5));
  
  return {
    ...user.toObject(),
    encryptedId
  };
};
