import express from "express";
import { verifyUser, optionalVerifyUser } from "../authMiddleware.js";
import {
  getActiveAuctions,
  getAuctionById,
  createAuction,
  placeBid,
  getSellerAuctions,
  updateAuction,
  endAuction,
  getAuctionRefresh,
  deleteAuction
} from "./auctionController.js";

const router = express.Router();

// Routes
router.get("/", optionalVerifyUser, getActiveAuctions);
router.get("/seller/my-auctions", verifyUser, getSellerAuctions);
router.get("/:id", optionalVerifyUser, getAuctionById);
router.get("/:id/refresh", optionalVerifyUser, getAuctionRefresh);
router.post("/", verifyUser, createAuction);
router.post("/:id/bid", verifyUser, placeBid);
router.put("/:id", verifyUser, updateAuction);
router.put("/:id/end", verifyUser, endAuction);
router.delete("/:id", verifyUser, deleteAuction);

export default router;
