import express from 'express';
import Wishlist from '../models/Wishlist.js';

const router = express.Router();

// ❤️ Add to wishlist
router.post('/add', async (req, res) => {
  const { userId, productId } = req.body;

  try {
    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = new Wishlist({ userId, items: [productId] });
    } else if (!wishlist.items.includes(productId)) {
      wishlist.items.push(productId);
    }

    await wishlist.save();
    res.json({ success: true, wishlist });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
});

// 📋 Get wishlist
router.get('/:userId', async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ userId: req.params.userId }).populate('items');
    res.json({ success: true, wishlist });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});

// ❌ Remove item
router.delete('/:userId/:productId', async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ userId: req.params.userId });

    if (!wishlist) return res.status(404).json({ error: 'Wishlist not found' });

    wishlist.items = wishlist.items.filter(
      (id) => id.toString() !== req.params.productId
    );

    await wishlist.save();
    res.json({ success: true, wishlist });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove from wishlist' });
  }
});

export default router;
