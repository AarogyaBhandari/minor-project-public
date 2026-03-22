import express from "express";
import Review  from "../models/Review.js";
import Order   from "../models/Order.js";
import { verifyUser } from "../authMiddleware.js";

const router = express.Router();

/* ── POST /api/reviews  —  submit a rating ── */
router.post("/", verifyUser, async (req, res) => {
  try {
    const { productId, orderId, rating } = req.body;
    const userId = req.user.uid;

    if (!productId || !orderId || !rating)
      return res.status(400).json({ message: "productId, orderId and rating are required" });
    if (rating < 1 || rating > 5)
      return res.status(400).json({ message: "Rating must be between 1 and 5" });

    // Verify: order belongs to user, is completed, and contains the product
    const order = await Order.findById(orderId);
    if (!order)                       return res.status(404).json({ message: "Order not found" });
    if (order.userId !== userId)      return res.status(403).json({ message: "Not your order" });
    if (order.status !== "completed") return res.status(400).json({ message: "Order must be completed to leave a review" });

    const hasProduct = order.items.some(i => String(i.productId) === String(productId));
    if (!hasProduct) return res.status(400).json({ message: "Product not in this order" });

    // Upsert — allows updating a previously submitted rating
    const review = await Review.findOneAndUpdate(
      { productId, userId, orderId },
      { rating },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ message: "Review saved", review });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ message: "Already reviewed this product for this order" });
    console.error("Review POST error:", err);
    res.status(500).json({ message: "Failed to save review" });
  }
});

/* ── GET /api/reviews/product/:productId  —  average + count ── */
router.get("/product/:productId", async (req, res) => {
  try {
    const reviews = await Review.find({ productId: req.params.productId });
    if (!reviews.length) return res.json({ average: 0, count: 0 });

    const sum     = reviews.reduce((acc, r) => acc + r.rating, 0);
    const average = Math.round((sum / reviews.length) * 10) / 10;
    res.json({ average, count: reviews.length });
  } catch (err) {
    console.error("Review GET error:", err);
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
});

/* ── POST /api/reviews/products  —  bulk: { productId: {average, count} }
   Body: { productIds: ["id1","id2",...] }                                  */
router.post("/products", async (req, res) => {
  try {
    const { productIds } = req.body;
    if (!Array.isArray(productIds) || !productIds.length) return res.json({});

    const reviews = await Review.find({ productId: { $in: productIds } });

    const map = {};
    productIds.forEach(id => { map[id] = { sum: 0, count: 0 }; });
    reviews.forEach(r => {
      if (map[r.productId]) { map[r.productId].sum += r.rating; map[r.productId].count += 1; }
    });

    const result = {};
    Object.entries(map).forEach(([id, { sum, count }]) => {
      result[id] = { average: count ? Math.round((sum / count) * 10) / 10 : 0, count };
    });

    res.json(result);
  } catch (err) {
    console.error("Bulk reviews error:", err);
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
});

/* ── GET /api/reviews/user/reviewed  —  which (productId, orderId) pairs has the user reviewed? ── */
router.get("/user/reviewed", verifyUser, async (req, res) => {
  try {
    const reviews = await Review.find({ userId: req.user.uid }, "productId orderId rating");
    res.json(reviews.map(r => ({
      productId: String(r.productId),
      orderId:   String(r.orderId),
      rating:    r.rating
    })));
  } catch (err) {
    console.error("User reviewed error:", err);
    res.status(500).json({ message: "Failed to fetch reviewed products" });
  }
});

export default router;
