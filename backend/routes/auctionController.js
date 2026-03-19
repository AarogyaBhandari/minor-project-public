import Auction from "../models/Auction.js";

/**
 * Get all active auctions
 */
export async function getActiveAuctions(req, res) {
  try {
    const now = new Date();
    const auctions = await Auction.find({
      status: "active",
      endTime: { $gt: now }
    }).sort({ createdAt: -1 });

    res.json(auctions);
  } catch (err) {
    console.error("Error fetching auctions:", err);
    res.status(500).json({ message: "Failed to fetch auctions", error: err.message });
  }
}

/**
 * Get single auction by ID
 */
export async function getAuctionById(req, res) {
  try {
    const { id } = req.params;
    const auction = await Auction.findById(id);

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    res.json(auction);
  } catch (err) {
    console.error("Error fetching auction:", err);
    res.status(500).json({ message: "Failed to fetch auction", error: err.message });
  }
}

/**
 * Create new auction (seller only)
 */
export async function createAuction(req, res) {
  try {
    const { title, description, category, subcategory, eraPeriod, reservePrice, duration, imageUrl } = req.body;

    // Validate required fields
    if (!title || !reservePrice || !duration) {
      return res.status(400).json({ message: "Missing required fields: title, reservePrice, duration" });
    }

    // Parse duration to milliseconds
    const durationMap = {
      "1": 1 * 60 * 60 * 1000,
      "2": 2 * 60 * 60 * 1000,
      "4": 4 * 60 * 60 * 1000,
      "12": 12 * 60 * 60 * 1000,
      "24": 24 * 60 * 60 * 1000,
      "72": 72 * 60 * 60 * 1000
    };

    const durationMs = durationMap[duration];
    if (!durationMs) {
      return res.status(400).json({ message: "Invalid duration" });
    }

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationMs);

    const auction = new Auction({
      title,
      description,
      imageUrl,
      category,
      subcategory,
      eraPeriod,
      reservePrice,
      currentPrice: reservePrice,
      seller: req.user.uid,
      startTime,
      endTime,
      status: "active"
    });

    await auction.save();

    res.status(201).json({
      message: "Auction created successfully",
      auction
    });
  } catch (err) {
    console.error("Error creating auction:", err);
    res.status(500).json({ message: "Failed to create auction", error: err.message });
  }
}

/**
 * Place a bid on an auction
 */
export async function placeBid(req, res) {
  try {
    const { id } = req.params;
    const { bidAmount } = req.body;
    const bidderId = req.user.uid;

    if (!bidAmount || bidAmount <= 0) {
      return res.status(400).json({ message: "Invalid bid amount" });
    }

    const auction = await Auction.findById(id);

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    // Check if auction is still active
    if (auction.status !== "active" || new Date() > auction.endTime) {
      return res.status(400).json({ message: "Auction is no longer active" });
    }

    // Validate bid is higher than current price
    if (bidAmount <= auction.currentPrice) {
      return res.status(400).json({
        message: `Bid must be higher than current price of $${auction.currentPrice}`
      });
    }

    // Check seller cannot bid on own auction
    if (auction.seller === bidderId) {
      return res.status(400).json({ message: "Seller cannot bid on own auction" });
    }

    // Update auction
    auction.currentPrice = bidAmount;
    auction.highestBidder = bidderId;
    auction.bids.push({
      bidder: bidderId,
      amount: bidAmount,
      time: new Date()
    });

    await auction.save();

    res.json({
      message: "Bid placed successfully",
      auction
    });
  } catch (err) {
    console.error("Error placing bid:", err);
    res.status(500).json({ message: "Failed to place bid", error: err.message });
  }
}

/**
 * Get seller's auctions
 */
export async function getSellerAuctions(req, res) {
  try {
    const sellerId = req.user.uid;

    const auctions = await Auction.find({ seller: sellerId })
      .sort({ createdAt: -1 });

    res.json(auctions);
  } catch (err) {
    console.error("Error fetching seller auctions:", err);
    res.status(500).json({ message: "Failed to fetch auctions", error: err.message });
  }
}

/**
 * Update auction (seller only)
 */
export async function updateAuction(req, res) {
  try {
    const { id } = req.params;
    const { title, description, category, subcategory, eraPeriod, imageUrl } = req.body;
    const sellerId = req.user.uid;

    const auction = await Auction.findById(id);

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    // Only seller can update
    if (auction.seller !== sellerId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Only allow updates if auction hasn't started receiving bids
    if (auction.bids.length > 0) {
      return res.status(400).json({ message: "Cannot update auction with bids" });
    }

    auction.title = title || auction.title;
    auction.description = description || auction.description;
    auction.category = category || auction.category;
    auction.subcategory = subcategory || auction.subcategory;
    auction.eraPeriod = eraPeriod || auction.eraPeriod;
    auction.imageUrl = imageUrl || auction.imageUrl;

    await auction.save();

    res.json({
      message: "Auction updated successfully",
      auction
    });
  } catch (err) {
    console.error("Error updating auction:", err);
    res.status(500).json({ message: "Failed to update auction", error: err.message });
  }
}

/**
 * End auction manually (admin/seller only)
 */
export async function endAuction(req, res) {
  try {
    const { id } = req.params;
    const auction = await Auction.findById(id);

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    // Only seller can end auction
    if (auction.seller !== req.user.uid) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    auction.status = "ended";
    await auction.save();

    res.json({ message: "Auction ended", auction });
  } catch (err) {
    console.error("Error ending auction:", err);
    res.status(500).json({ message: "Failed to end auction", error: err.message });
  }
}

/**
 * Get auction by ID with refresh (for polling)
 */
export async function getAuctionRefresh(req, res) {
  try {
    const { id } = req.params;
    const auction = await Auction.findById(id);

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    res.json({
      currentPrice: auction.currentPrice,
      highestBidder: auction.highestBidder,
      endTime: auction.endTime,
      status: auction.status,
      bidsCount: auction.bids.length
    });
  } catch (err) {
    console.error("Error refreshing auction:", err);
    res.status(500).json({ message: "Failed to refresh auction", error: err.message });
  }
}
/**
 * Delete auction (admin only)
 */
export async function deleteAuction(req, res) {
  try {
    const { id } = req.params;
    
    const auction = await Auction.findById(id);
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    await Auction.findByIdAndDelete(id);

    res.json({ message: "Auction deleted successfully" });
  } catch (err) {
    console.error("Error deleting auction:", err);
    res.status(500).json({ message: "Failed to delete auction", error: err.message });
  }
}