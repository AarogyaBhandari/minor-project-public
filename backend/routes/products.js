import express from "express";
import Product from "../models/Product.js";
import { verifyUser, optionalVerifyUser } from "../authMiddleware.js";
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ dest: path.join(__dirname, '../../images/') });

const router = express.Router();

// Helper to clean images array
function cleanImages(data) {
  if (typeof data.images === 'string') {
    data.images = data.images === 'undefined' ? [] : [data.images];
  } else if (!Array.isArray(data.images)) {
    data.images = [];
  } else {
    data.images = data.images.filter(img => img && img !== 'undefined' && img.trim() !== '');
  }
  return data;
}

router.get("/", optionalVerifyUser, async (req, res) => {
  let products;

  // Admins see all, sellers see their own
  if (req.user && req.user.admin) {
    products = await Product.find().sort({ _id: -1 });
  } else if (req.user && req.user.seller) {
    products = await Product.find({ sellerId: req.user.uid }).sort({ _id: -1 });
  } else {
    // Public listing — support ?sort=newest and ?limit=N
    const sortOrder = req.query.sort === 'newest' ? { _id: -1 } : { _id: -1 }; // default newest
    const limit = parseInt(req.query.limit) || 0;
    const query = Product.find().sort(sortOrder);
    if (limit > 0) query.limit(limit);
    products = await query;
  }

  console.log("Fetched products:", products.length);

  const productsData = products.map(product => cleanImages(product.toObject()));
  res.json(productsData);
});

router.get("/:id", optionalVerifyUser, async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(cleanImages(product.toObject()));
});

router.post("/", upload.single('image'), verifyUser, async (req, res) => {
  console.log("Adding product:", req.body);
  const payload = { sellerId: req.user.uid };
  payload.title = req.body.title;
  payload.price = req.body.price;
  payload.stock = req.body.stock;
  payload.category = req.body.category;
  payload.subcategory = req.body.subcategory;
  payload.era = req.body.era;
  payload.description = req.body.description;

  if (req.file) {
    payload.images = [`/images/${req.file.filename}`];
  } else {
    payload.images = [req.body.image];
  }

  const product = await Product.create(payload);
  console.log("Product created:", product);
  res.json(product);
});

router.put("/:id", upload.single('image'), verifyUser, async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });

  if (!req.user.admin && product.sellerId !== req.user.uid) {
    return res.status(403).json({ message: "Not allowed to edit this product" });
  }

  const payload = {};
  if (req.body.title)       payload.title       = req.body.title;
  if (req.body.price)       payload.price       = req.body.price;
  if (req.body.stock)       payload.stock       = req.body.stock;
  if (req.body.category)    payload.category    = req.body.category;
  if (req.body.subcategory) payload.subcategory = req.body.subcategory;
  if (req.body.era)         payload.era         = req.body.era;
  if (req.body.description) payload.description = req.body.description;

  if (req.file) {
    payload.images = [`/images/${req.file.filename}`];
  } else if (req.body.image) {
    payload.images = [req.body.image];
  }

  Object.assign(product, payload);
  await product.save();
  res.json(product);
});

router.delete("/:id", verifyUser, async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });

  if (!req.user.admin && product.sellerId !== req.user.uid) {
    return res.status(403).json({ message: "Not allowed to delete this product" });
  }

  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: "Product deleted" });
});

// ── AI Recommendations ─────────────────────────────────────────────────────────
// GET /api/products/recommendations/:productId
router.get("/recommendations/:productId", optionalVerifyUser, async (req, res) => {
  try {
    const current = await Product.findById(req.params.productId).lean();
    if (!current) return res.status(404).json({ message: "Product not found" });

    const currentPrice = parseFloat(current.price) || 0;

    // Candidates: other in-stock products priced >= current, sorted ascending
    const candidates = await Product.find({
      _id: { $ne: current._id },
      stock: { $gt: 0 },
      price: { $gte: currentPrice },
    }).sort({ price: 1 }).limit(40).lean();

    // Build order history affinity map if user is logged in
    let affinityMap = {};
    if (req.user?.uid) {
      try {
        const Order = (await import("../models/Order.js")).default;
        const orders = await Order.find({ userId: req.user.uid }).lean();

        const boughtIds = orders.flatMap(o => o.items.map(i => String(i.productId)));
        const boughtProducts = await Product.find({ _id: { $in: boughtIds } }).lean();

        const catFreq = {};
        const subcatFreq = {};
        orders.forEach(order => {
          order.items.forEach(item => {
            const prod = boughtProducts.find(p => String(p._id) === String(item.productId));
            if (!prod) return;
            const qty = item.qty || 1;
            catFreq[prod.category]       = (catFreq[prod.category]       || 0) + qty;
            subcatFreq[prod.subcategory] = (subcatFreq[prod.subcategory] || 0) + qty;
          });
        });

        candidates.forEach(p => {
          let score = 0;
          if (p.category    && catFreq[p.category])       score += catFreq[p.category] * 2;
          if (p.subcategory && subcatFreq[p.subcategory]) score += subcatFreq[p.subcategory] * 3;
          affinityMap[String(p._id)] = score;
        });
      } catch (e) {
        console.error("Affinity build error:", e);
      }
    }

    const scored = candidates.map(p => {
      let score = 0;
      if (p.category    === current.category)    score += 10;
      if (p.subcategory === current.subcategory) score += 20;
      score += (affinityMap[String(p._id)] || 0);
      const priceDiff = parseFloat(p.price) - currentPrice;
      score += Math.max(0, 5 - Math.floor(priceDiff / 1000));
      return { ...p, _score: score };
    });

    scored.sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return parseFloat(a.price) - parseFloat(b.price);
    });

    const results = scored.slice(0, 8).map(p => {
      let images = Array.isArray(p.images) ? p.images : (p.images ? [p.images] : []);
      images = images.filter(img => img && img !== 'undefined' && img.trim() !== '');
      return { ...p, images, _score: undefined };
    });

    res.json(results);
  } catch (err) {
    console.error("Recommendations error:", err);
    res.status(500).json({ message: "Failed to fetch recommendations" });
  }
});

export default router;