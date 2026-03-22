import dotenv from "dotenv";
dotenv.config();

import { fileURLToPath } from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import chatbotRoutes from "./routes/chatbot.js";

console.log("MONGO_URI:", process.env.MONGO_URI);
console.log("PORT:", process.env.PORT);

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/chatbot", chatbotRoutes);

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '..')));

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error("MONGO_URI is not set in environment variables");
  process.exit(1);
}

mongoose.connect(mongoUri)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("Mongo error:", err));

app.get("/", (req, res) => res.send("API running"));

app.listen(process.env.PORT || 5000, () =>
  console.log("Server running at port " + (process.env.PORT || 5000))
);

import productRoutes from "./routes/products.js";
app.use("/api/products", productRoutes);

import cartRoutes from "./routes/cart.js";
app.use("/api/cart", cartRoutes);

import orderRoutes from "./routes/orders.js";
app.use("/api/orders", orderRoutes);

import userRoutes from "./routes/users.js";
app.use("/api/users", userRoutes);

import auctionRoutes from "./routes/auctions.js";
app.use("/api/auctions", auctionRoutes);

import reviewRoutes from "./routes/reviews.js";
app.use("/api/reviews", reviewRoutes);