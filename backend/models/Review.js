import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  userId:    { type: String, required: true },
  orderId:   { type: String, required: true },
  rating:    { type: Number, required: true, min: 1, max: 5 },
  createdAt: { type: Date, default: Date.now }
});

// One review per user per product per order
ReviewSchema.index({ productId: 1, userId: 1, orderId: 1 }, { unique: true });

export default mongoose.model("Review", ReviewSchema);
