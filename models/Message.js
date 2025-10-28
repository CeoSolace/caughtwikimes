import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true },
  ciphertext: { type: String, required: true },
  iv: { type: String, required: true },
  sender: { type: String, required: true },
  typing: { type: Boolean, default: false }
}, { timestamps: true });

// Auto-delete after 30 minutes
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1800 });

export default mongoose.model('Message', messageSchema);
