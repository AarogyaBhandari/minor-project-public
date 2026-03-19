import express from "express";
import Cart from "../models/Cart.js";
import { verifyUser } from "../authMiddleware.js";

const router = express.Router();

/* ================= CLEAR CART (MUST BE FIRST) ================= */
router.delete("/clear", verifyUser, async (req, res) => {
  try {
    console.log("Clearing cart for:", req.user.uid);
    await Cart.deleteMany({ userId: req.user.uid });
    res.json({ message: "Cart cleared" });
  } catch (err) {
    console.error("Clear cart error:", err);
    res.status(500).json({ message: "Failed to clear cart" });
  }
});




// add to cart
router.post("/", verifyUser, async (req, res) => {
  console.log("Adding to cart:", req.body);
  const { productId } = req.body;

  let item = await Cart.findOne({
    userId: req.user.uid,
    productId
  });

  if (item) {
    item.qty += 1;
    await item.save();
  } else {
    item = await Cart.create({
      userId: req.user.uid,
      productId
    });
  }

  res.json(item);
});

// get user cart
router.get("/", verifyUser, async (req, res) => {
  const cart = await Cart.find({ userId: req.user.uid });
  console.log("Fetched cart:", cart.length, "items");
  res.json(cart);
});


// // clear cart after order placed
// router.delete("/clear", verifyUser, async (req, res) => {
//   await Cart.deleteMany({ userId: req.user.uid });
//   res.json({ message: "Cart cleared" });
// });

// delete cart item
router.delete("/:id", verifyUser, async (req, res) => {
  await Cart.findByIdAndDelete(req.params.id);
  res.json({ message: "Item removed" });
});
// Update cart item quantity
router.put("/:id", verifyUser, async (req, res) => {
  const cart = await Cart.findById(req.params.id);
  if (!cart) return res.status(404).json({ message: "Cart item not found" });
  if (cart.userId !== req.user.uid) return res.status(403).json({ message: "Not allowed" });

  const newQty = parseInt(req.body.qty);
  if (!newQty || newQty < 1) return res.status(400).json({ message: "Invalid quantity" });

  cart.qty = newQty;
  await cart.save();
  res.json(cart);
});


export default router;
