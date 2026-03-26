import mongoose from 'mongoose';

const sellerRequestSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true }, // Firebase UID
  email: { type: String },                              // pulled from Firebase token

  // Personal Info
  firstName:  { type: String, required: true },
  lastName:   { type: String, required: true },
  age:        { type: Number, required: true },
  phone:      { type: String, required: true },
  address:    { type: String, required: true },
  city:       { type: String, required: true },
  province:   { type: String },

  // Seller / Business Info
  domain:     { type: String, required: true },
  experience: { type: String, required: true },
  bio:        { type: String, required: true },
  portfolio:  { type: String },

  // ID Verification
  idType:     { type: String, required: true },
  idNumber:   { type: String, required: true },
  idPhotoUrl: { type: String },   // Cloudinary URL

  // Status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminNote: { type: String },    // optional note from admin on rejection

}, { timestamps: true });

export default mongoose.model('SellerRequest', sellerRequestSchema);
