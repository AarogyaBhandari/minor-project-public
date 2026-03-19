import mongoose from "mongoose";

const AuctionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  imageUrl: String,
  category: String,
  subcategory: String,
  eraPeriod: String,
  reservePrice: {
    type: Number,
    required: true
  },
  currentPrice: {
    type: Number,
    required: true
  },
  seller: {
    type: String,
    required: true
  },
  highestBidder: {
    type: String,
    default: null
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ["active", "ended", "cancelled"],
    default: "active"
  },
  bids: [
    {
      bidder: String,
      amount: Number,
      time: {
        type: Date,
        default: Date.now
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model("Auction", AuctionSchema);
