import mongoose from "mongoose";

const CartSchema = new mongoose.Schema({
  userId: String,
  productId: String,
  qty: { type: Number, default: 1 }
});

export default mongoose.model("Cart", CartSchema);
