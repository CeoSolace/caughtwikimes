import mongoose, { Document, Schema } from 'mongoose';

// User model
export interface IUser extends Document {
  discordId?: string;
  username: string;
  email?: string;
  avatar?: string;
  accountType: 'temporary' | 'permanent';
  status: 'active' | 'banned' | 'suspended';
  staff?: boolean;
  createdAt: Date;
  lastActive: Date;
  ip?: string;
}

const userSchema = new Schema<IUser>({
  discordId: { type: String, unique: true, sparse: true },
  username: { type: String, required: true, unique: true },
  email: { type: String },
  avatar: { type: String },
  accountType: { 
    type: String, 
    enum: ['temporary', 'permanent'], 
    default: 'temporary' 
  },
  status: { 
    type: String, 
    enum: ['active', 'banned', 'suspended'], 
    default: 'active' 
  },
  staff: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now },
  ip: { type: String }
});

export const User = mongoose.model<IUser>('User', userSchema);

// Server model
export interface IServer extends Document {
  name: string;
  ownerId: string;
  members: string[];
  channels: string[];
  boosts: number;
  customInvite?: string;
  banner?: string;
  createdAt: Date;
}

const serverSchema = new Schema<IServer>({
  name: { type: String, required: true },
  ownerId: { type: String, required: true },
  members: [{ type: String }],
  channels: [{ type: String }],
  boosts: { type: Number, default: 0 },
  customInvite: { type: String },
  banner: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export const ServerModel = mongoose.model<IServer>('Server', serverSchema);

// Channel model
export interface IChannel extends Document {
  name: string;
  serverId: string;
  type: 'text' | 'voice';
  createdAt: Date;
}

const channelSchema = new Schema<IChannel>({
  name: { type: String, required: true },
  serverId: { type: String, required: true },
  type: { type: String, enum: ['text', 'voice'], default: 'text' },
  createdAt: { type: Date, default: Date.now }
});

export const Channel = mongoose.model<IChannel>('Channel', channelSchema);

// Message model
export interface IMessage extends Document {
  content: string;
  userId: string;
  username: string;
  channelId: string;
  timestamp: Date;
  deleted: boolean;
}

const messageSchema = new Schema<IMessage>({
  content: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  channelId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  deleted: { type: Boolean, default: false }
});

export const Message = mongoose.model<IMessage>('Message', messageSchema);

// Report model
export interface IReport extends Document {
  reporterId: string;
  targetId: string;
  reason: string;
  evidence?: string;
  type: 'normal' | 'danger';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  resolvedAt?: Date;
}

const reportSchema = new Schema<IReport>({
  reporterId: { type: String, required: true },
  targetId: { type: String, required: true },
  reason: { type: String, required: true },
  evidence: { type: String },
  type: { 
    type: String, 
    enum: ['normal', 'danger'], 
    default: 'normal' 
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  createdAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date }
});

export const Report = mongoose.model<IReport>('Report', reportSchema);

// Boost model
export interface IBoost extends Document {
  serverId: string;
  userId: string;
  timestamp: Date;
}

const boostSchema = new Schema<IBoost>({
  serverId: { type: String, required: true },
  userId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

export const Boost = mongoose.model<IBoost>('Boost', boostSchema);
