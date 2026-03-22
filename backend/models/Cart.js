import mongoose from "mongoose";

const CartSchema = new mongoose.Schema({
  userId:        String,
  productId:     String,
  qty:           { type: Number, default: 1 },
  // Auction-won items
  isAuctionWin:  { type: Boolean, default: false },
  auctionId:     { type: String,  default: null },
  auctionTitle:  { type: String,  default: null },
  auctionPrice:  { type: Number,  default: null },
  auctionImage:  { type: String,  default: null }
});

export default mongoose.model("Cart", CartSchema);