import 'dotenv/config';
import OpenAI from "openai";
import express from "express";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { optionalVerifyUser } from "../authMiddleware.js";

const router = express.Router();

// Ollama local model — no API key needed
const openai = new OpenAI({
  apiKey: "ollama",
  baseURL: "http://localhost:11434/v1",
});

console.log("Using local Ollama model: deepseek-r1:8b");

// ─── Order ID detector ────────────────────────────────────────────────────────
// MongoDB ObjectIDs are 24 hex characters
function extractOrderId(message) {
  const match = message.match(/\b([a-f0-9]{24})\b/i);
  return match ? match[1] : null;
}

// Also detect intent like "track order", "where is my order", "order status"
function isOrderTrackingIntent(message) {
  return /\b(track|tracking|order\s*status|where.*order|my\s*order|order.*id|check.*order|order.*#)\b/i.test(message);
}

// ─── Order lookup ─────────────────────────────────────────────────────────────
async function lookupOrder(orderId, userId = null) {
  try {
    const order = await Order.findById(orderId).lean();
    if (!order) return null;

    // If user is authenticated, only let them see their own orders
    // If no user (guest), still return order — chatbot is support-facing
    if (userId && order.userId !== userId) return null;

    return order;
  } catch {
    return null; // invalid ObjectID format or DB error
  }
}

function formatOrderStatus(order) {
  const statusEmoji = {
    pending:     "🕐",
    "in transit":"🚚",
    completed:   "✅",
    cancelled:   "❌",
  };
  const emoji = statusEmoji[order.status] || "📦";
  const date = new Date(order.createdAt).toLocaleDateString("en-NP", {
    year: "numeric", month: "short", day: "numeric",
  });

  const lines = [
    `Order ID: ${order._id}`,
    `Status: ${emoji} ${order.status?.toUpperCase() || "PENDING"}`,
    `Placed on: ${date}`,
    `Total: Rs. ${order.total}`,
    `Items: ${order.items?.length || 0}`,
  ];

  if (order.shippingAddress) {
    lines.push(`Shipping to: ${order.shippingAddress}`);
  }
  if (order.notes) {
    lines.push(`Notes: ${order.notes}`);
  }

  return lines.join("\n");
}

// ─── Product search helpers ───────────────────────────────────────────────────
function extractMaxPrice(message) {
  const match = message.match(/(?:under|below|less\s+than|cheaper\s+than|within|max(?:imum)?|upto?|up\s+to)\s*(?:rs\.?|npr|₹)?\s*(\d[\d,]*)/i);
  if (match) return parseFloat(match[1].replace(/,/g, ''));
  const match2 = message.match(/(\d[\d,]*)\s*(?:or\s+)?(?:less|max|maximum)/i);
  if (match2) return parseFloat(match2[1].replace(/,/g, ''));
  return null;
}

function extractMinPrice(message) {
  const match = message.match(/(?:above|over|more\s+than|at\s+least|minimum|min)\s*(?:rs\.?|npr|₹)?\s*(\d[\d,]*)/i);
  if (match) return parseFloat(match[1].replace(/,/g, ''));
  return null;
}

async function searchProducts(message) {
  const msg = message.toLowerCase();
  const filter = {};

  const maxPrice = extractMaxPrice(message);
  const minPrice = extractMinPrice(message);
  if (maxPrice !== null || minPrice !== null) {
    filter.price = {};
    if (maxPrice !== null) filter.price.$lte = maxPrice;
    if (minPrice !== null) filter.price.$gte = minPrice;
  }

  const stopWords = new Set([
    'show', 'me', 'find', 'get', 'list', 'give', 'i', 'want', 'need',
    'looking', 'for', 'a', 'an', 'the', 'some', 'any', 'please', 'can',
    'you', 'have', 'do', 'what', 'are', 'is', 'under', 'below', 'above',
    'over', 'less', 'than', 'more', 'max', 'maximum', 'min', 'minimum',
    'upto', 'up', 'to', 'within', 'rs', 'npr', 'rupees', 'rupee',
  ]);

  const keywords = msg
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w) && !/^\d+$/.test(w));

  if (keywords.length > 0) {
    const regexClauses = keywords.map(kw => {
      const re = { $regex: kw, $options: 'i' };
      return {
        $or: [
          { title: re },
          { description: re },
          { category: re },
          { subcategory: re },
          { era: re },
        ],
      };
    });
    filter.$or = regexClauses.length === 1
      ? regexClauses[0].$or
      : regexClauses.flatMap(c => c.$or);
  }

  filter.stock = { $gt: 0 };
  const products = await Product.find(filter).limit(8).lean();
  return products;
}

function cleanImages(images) {
  if (!Array.isArray(images)) return [];
  return images.filter(img => img && img !== 'undefined' && img.trim() !== '');
}

// ─── Route ────────────────────────────────────────────────────────────────────

// optionalVerifyUser: attaches req.user if a valid Firebase token is sent,
// but does NOT block unauthenticated users — chatbot is public
router.post("/", optionalVerifyUser, async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

    const userId = req.user?.uid || null;

    // ── 1. Check for order tracking intent ───────────────────────────────────
    const orderId = extractOrderId(message);

    if (orderId || isOrderTrackingIntent(message)) {
      if (!orderId) {
        // User asked about order but gave no ID
        return res.json({
          reply: "I'd be happy to help track your order! 📦 Please share your Order ID (a 24-character code from your confirmation email) and I'll look it up right away.",
          products: [],
          orderInfo: null,
        });
      }

      const order = await lookupOrder(orderId, userId);

      if (!order) {
        return res.json({
          reply: `I couldn't find an order with ID \`${orderId}\`. Please double-check the ID — it should be a 24-character code from your order confirmation. If you need further help, contact our support team.`,
          products: [],
          orderInfo: null,
        });
      }

      const orderSummary = formatOrderStatus(order);

      // Let the AI compose a friendly reply using the order facts
      const orderPrompt = `You are LocalArtHub's shopping assistant. A customer asked about their order. Here are the order details:\n\n${orderSummary}\n\nWrite a warm, helpful reply in 2-3 sentences summarising the order status. Do not add information not listed above.`;

      let reply = "";
      try {
        const completion = await openai.chat.completions.create({
          model: "deepseek-r1:8b",
          messages: [{ role: "user", content: orderPrompt }],
          temperature: 0.5,
          max_tokens: 200,
        });
        reply = completion.choices[0].message.content || "";
        reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      } catch {
        // Fallback: just show the raw order summary if AI call fails
        reply = `Here are your order details:\n\n${orderSummary}`;
      }

      return res.json({
        reply,
        products: [],
        orderInfo: {
          _id: order._id,
          status: order.status,
          total: order.total,
          createdAt: order.createdAt,
          itemCount: order.items?.length || 0,
          shippingAddress: order.shippingAddress || null,
        },
      });
    }

    // ── 2. Product search ─────────────────────────────────────────────────────
    let products = [];
    let productContext = "";

    try {
      products = await searchProducts(message);
      if (products.length > 0) {
        const productList = products
          .map((p, i) => {
            const imgs = cleanImages(p.images);
            return [
              `${i + 1}. ${p.title}`,
              `   - Price: Rs. ${p.price}`,
              `   - Category: ${p.category}${p.subcategory ? ' > ' + p.subcategory : ''}`,
              `   - Stock: ${p.stock} available`,
              p.era ? `   - Era: ${p.era}` : '',
              p.description ? `   - Description: ${p.description.slice(0, 120)}` : '',
              imgs.length > 0 ? `   - Image: ${imgs[0]}` : '',
            ].filter(Boolean).join('\n');
          })
          .join('\n\n');
        productContext = `\n\n--- MATCHING PRODUCTS FROM DATABASE ---\n${productList}\n--- END OF PRODUCTS ---\n`;
      }
    } catch (dbErr) {
      console.error("DB search error:", dbErr);
    }

    // ── 3. Build system prompt ────────────────────────────────────────────────
    const systemPrompt = `You are LocalArtHub's shopping assistant for a handmade artisan marketplace in Nepal.

Rules:
- Only recommend products from the database list provided below
- List products with name and price in Rs.
- If no products match, say so and ask for clarification
- For order tracking questions, ask the user to provide their 24-character Order ID
- Keep replies under 150 words
- Do NOT add <think> tags or reasoning steps in your reply${productContext}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-6),
      { role: "user", content: message },
    ];

    // ── 4. Call local model ───────────────────────────────────────────────────
    const completion = await openai.chat.completions.create({
      model: "deepseek-r1:8b",
      messages,
      temperature: 0.6,
      max_tokens: 400,
      stream: false,
    });

    let reply = completion.choices[0].message.content || "";
    reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    res.json({
      reply,
      products: products.map(p => ({
        _id: p._id,
        title: p.title,
        price: p.price,
        category: p.category,
        subcategory: p.subcategory,
        images: cleanImages(p.images),
        stock: p.stock,
      })),
      orderInfo: null,
    });

  } catch (err) {
    console.error("Chatbot error:", err);
    if (err.cause?.code === "ECONNREFUSED") {
      return res.status(503).json({ error: "Local AI model is not running. Make sure the Ollama Docker container is up." });
    }
    res.status(500).json({ error: "Chatbot failed" });
  }
});

export default router;