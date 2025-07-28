import express from 'express';
import Cart from '../models/Cart.js';

const router = express.Router();

// ➕ Add to cart
router.post('/add', async (req, res) => {
  const { userId, productId, quantity } = req.body;

  try {
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, items: [{ productId, quantity }] });
    } else {
      const index = cart.items.findIndex(
        (item) => item.productId.toString() === productId
      );
      if (index > -1) {
        cart.items[index].quantity += quantity;
      } else {
        cart.items.push({ productId, quantity });
      }
    }

    await cart.save();
    res.json({ success: true, cart });
  } catch (err) {
    res.status(500).json({ error: 'Add to cart failed' });
  }
});

// 📦 Get cart
router.get('/:userId', async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.params.userId }).populate('items.productId');
    res.json({ success: true, cart });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get cart' });
  }
});

// 🔄 Update quantity
router.patch('/:userId/:productId', async (req, res) => {
  const { quantity } = req.body;

  try {
    const cart = await Cart.findOne({ userId: req.params.userId });
    const item = cart.items.find((item) => item.productId.toString() === req.params.productId);
    if (item) {
      item.quantity = quantity;
      await cart.save();
      res.json({ success: true, cart });
    } else {
      res.status(404).json({ error: 'Item not in cart' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// 🗑️ Remove from cart
router.delete('/:userId/:productId', async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.params.userId });
    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== req.params.productId
    );
    await cart.save();
    res.json({ success: true, cart });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove from cart' });
  }
});

export default router;
