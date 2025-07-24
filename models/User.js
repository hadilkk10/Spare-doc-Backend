import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String }, // Add this field
  phone: { type: String, required: true, unique: true },
  refreshToken: { type: String },
}, { timestamps: true });

export default mongoose.model('User', userSchema);
