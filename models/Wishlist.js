import mongoose from 'mongoose';

const wishlistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  items: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product', // Link to your Product model
    },
  ],
}, { timestamps: true });

export default mongoose.model('Wishlist', wishlistSchema);
