import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

// Initialise Cloudinary from environment variables
// Make sure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
// are set in your .env file
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
import admin from '../firebase.js';
import { verifyUser } from '../authMiddleware.js';
import SellerRequest from '../models/SellerRequest.js';

const router = express.Router();

// Multer: memory storage (Vercel has no persistent disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ─── Helper: upload buffer to Cloudinary ──────────────────────────────────────
function uploadToCloudinary(buffer, filename) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'seller-id-docs', resource_type: 'auto', public_id: filename },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

// ─── GET /api/users/seller-request/status ─────────────────────────────────────
// Returns the current user's seller request status (or null if none exists).
// Used by the frontend to disable the "Become Seller" button after submission.
router.get('/seller-request/status', verifyUser, async (req, res) => {
  try {
    const request = await SellerRequest.findOne({ uid: req.user.uid })
      .select('status createdAt');
    if (!request) return res.json({ exists: false, status: null });
    res.json({ exists: true, status: request.status });
  } catch (e) {
    res.status(500).json({ message: 'Failed to check status: ' + e.message });
  }
});

// ─── POST /api/users/seller-request ───────────────────────────────────────────
// Saves the full seller application as a PENDING request.
// Does NOT grant the seller role yet — admin must approve.
router.post(
  '/seller-request',
  verifyUser,
  upload.single('idPhoto'),
  async (req, res) => {
    try {
      const uid   = req.user.uid;
      const email = req.user.email || '';

      // Check for duplicate pending/approved request
      const existing = await SellerRequest.findOne({ uid });
      if (existing) {
        if (existing.status === 'approved') {
          return res.status(400).json({ message: 'You are already a seller.' });
        }
        if (existing.status === 'pending') {
          return res.status(400).json({ message: 'You already have a pending application. Please wait for admin review.' });
        }
        // If previously rejected, allow re-application — update the existing doc
        await SellerRequest.deleteOne({ uid });
      }

      // Upload ID photo to Cloudinary if provided and Cloudinary is configured
      let idPhotoUrl = '';
      if (req.file) {
        if (!process.env.CLOUDINARY_API_KEY) {
          console.warn('Cloudinary not configured — skipping ID photo upload. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET to your .env');
        } else {
          const safeName = `seller-id-${uid}-${Date.now()}`;
          idPhotoUrl = await uploadToCloudinary(req.file.buffer, safeName);
        }
      }

      const {
        firstName, lastName, age, phone, address, city, province,
        domain, experience, bio, portfolio,
        idType, idNumber,
      } = req.body;

      await SellerRequest.create({
        uid, email,
        firstName, lastName,
        age: Number(age),
        phone, address, city, province,
        domain, experience, bio, portfolio,
        idType, idNumber,
        idPhotoUrl,
        status: 'pending',
      });

      res.json({ message: 'Application submitted successfully. You will be notified once reviewed.' });
    } catch (e) {
      console.error('seller-request error:', e);
      res.status(500).json({ message: 'Failed to submit application: ' + e.message });
    }
  }
);

// ─── GET /api/users/seller-requests  (admin only) ─────────────────────────────
// Returns all seller requests, newest first.
router.get('/seller-requests', verifyUser, async (req, res) => {
  if (!req.user.admin) return res.status(403).json({ message: 'Not authorized' });

  try {
    const requests = await SellerRequest.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (e) {
    console.error('seller-requests fetch error:', e);
    res.status(500).json({ message: 'Failed to fetch requests' });
  }
});

// ─── POST /api/users/seller-requests/:id/approve  (admin only) ─────────────
router.post('/seller-requests/:id/approve', verifyUser, async (req, res) => {
  if (!req.user.admin) return res.status(403).json({ message: 'Not authorized' });

  try {
    const request = await SellerRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    // Grant seller role via Firebase custom claims
    const userRecord = await admin.auth().getUser(request.uid);
    const existing   = userRecord.customClaims || {};
    await admin.auth().setCustomUserClaims(request.uid, { ...existing, seller: true });

    // Mark as approved
    request.status    = 'approved';
    request.adminNote = req.body.note || '';
    await request.save();

    res.json({ message: 'Seller role granted and application approved.' });
  } catch (e) {
    console.error('approve error:', e);
    res.status(500).json({ message: 'Failed to approve: ' + e.message });
  }
});

// ─── POST /api/users/seller-requests/:id/reject  (admin only) ──────────────
router.post('/seller-requests/:id/reject', verifyUser, async (req, res) => {
  if (!req.user.admin) return res.status(403).json({ message: 'Not authorized' });

  try {
    const request = await SellerRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    request.status    = 'rejected';
    request.adminNote = req.body.note || '';
    await request.save();

    res.json({ message: 'Application rejected.' });
  } catch (e) {
    console.error('reject error:', e);
    res.status(500).json({ message: 'Failed to reject: ' + e.message });
  }
});

// ─── GET /api/users/sellers  (admin only) ─────────────────────────────────────
router.get('/sellers', verifyUser, async (req, res) => {
  if (!req.user.admin) return res.status(403).json({ message: 'Not authorized' });

  try {
    const listUsersResult = await admin.auth().listUsers();
    const sellers = listUsersResult.users.filter(u => u.customClaims?.seller);
    const sellerData = sellers.map(u => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName || 'N/A',
    }));
    res.json(sellerData);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch sellers' });
  }
});

// ─── GET /api/users/:uid ────────────────────────────────────────────────────
router.get('/:uid', verifyUser, async (req, res) => {
  try {
    const userRecord = await admin.auth().getUser(req.params.uid);
    res.json({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName || 'N/A',
    });
  } catch (e) {
    res.status(404).json({ message: 'User not found' });
  }
});

export default router;