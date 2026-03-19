import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema({
  userId: String,
  items: [
    {
      productId: String,
      qty: Number,
      sellerId: String
    }
  ],
  total: Number,
  status: { type: String, default: "pending" },
  shippingAddress: {
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    address: String,
    city: String,
    zip: String
  },
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Order", OrderSchema);
