import express from "express";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { verifyUser } from "../authMiddleware.js";

const router = express.Router();

router.post("/", verifyUser, async (req, res) => {
  // Annotate each incoming item with sellerId
  const itemsIn = req.body.items || [];
  const annotated = [];

  for (const it of itemsIn) {
    const prod = await Product.findById(it.productId);
    if (!prod) return res.status(400).json({ message: `Product ${it.productId} not found` });
    if (prod.stock < it.qty) return res.status(400).json({ message: `Insufficient stock for ${prod.title}` });
    annotated.push({
      productId: it.productId,
      qty: it.qty || 1,
      sellerId: prod.sellerId
    });
  }

  const order = await Order.create({
    userId: req.user.uid,
    items: annotated,
    total: req.body.total,
    shippingAddress: req.body.shippingAddress,
    notes: req.body.notes
  });

  // Reduce stock
  for (const it of annotated) {
    await Product.findByIdAndUpdate(it.productId, { $inc: { stock: -it.qty } });
  }

  res.json(order);
});

// Get orders: buyers get their orders, sellers get orders that include their products, admin gets all
router.get("/", verifyUser, async (req, res) => {
  if (req.user.admin) {
    const orders = await Order.find();
    return res.json(orders);
  }

  if (req.user.seller) {
    const orders = await Order.find({ "items.sellerId": req.user.uid });
    return res.json(orders);
  }

  const orders = await Order.find({ userId: req.user.uid });
  res.json(orders);
});

// Cancel an order (admin or seller related to order)
router.put("/:id/cancel", verifyUser, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });

  // admin can cancel any order
  if (req.user.admin) {
    order.status = "cancelled";
    await order.save();
    return res.json(order);
  }

  // seller can cancel orders that include their products
  if (req.user.seller) {
    const has = order.items.some(i => i.sellerId === req.user.uid);
    if (!has) return res.status(403).json({ message: "Not allowed to cancel this order" });
    order.status = "cancelled";
    await order.save();
    return res.json(order);
  }

  res.status(403).json({ message: "Not allowed to cancel this order" });
});

// Update order status (seller only, to completed)
router.put("/:id/status", verifyUser, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (!req.user.seller) return res.status(403).json({ message: "Not allowed" });

  const has = order.items.some(i => i.sellerId === req.user.uid);
  if (!has) return res.status(403).json({ message: "Not allowed to update this order" });

  const newStatus = req.body.status;
  if (newStatus !== "completed" && newStatus !== "in transit") return res.status(400).json({ message: "Invalid status update" });

  order.status = newStatus;
  await order.save();
  res.json(order);
});

// Delete an order seller
// DELETE order (seller only, completed/cancelled)
router.delete("/:id", verifyUser, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // OPTIONAL: allow delete only if completed/cancelled
    if (!["completed", "cancelled"].includes(order.status)) {
      return res.status(400).json({ message: "Order cannot be deleted" });
    }

    await Order.findByIdAndDelete(req.params.id);
    res.json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("Delete order error:", err);
    res.status(500).json({ message: "Failed to delete order" });
  }
});


export default router;
