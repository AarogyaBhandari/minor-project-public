import express from 'express';
import admin from '../firebase.js';
import { verifyUser } from '../authMiddleware.js';

const router = express.Router();

// Endpoint to become seller - sets custom claim 'seller' for the authenticated user
router.post('/become-seller', verifyUser, async (req, res) => {
  try {
    const uid = req.user.uid;
    console.log('Attempting to set seller role for user:', uid);
    
    // get existing custom claims
    const userRecord = await admin.auth().getUser(uid);
    console.log('User record fetched:', userRecord.email);
    
    const existing = userRecord.customClaims || {};
    const newClaims = Object.assign({}, existing, { seller: true });
    console.log('New claims:', newClaims);
    
    await admin.auth().setCustomUserClaims(uid, newClaims);
    console.log('Seller role set successfully');
    
    res.json({ message: 'Seller role granted. Please sign out and sign in again to refresh token.' });
  } catch (e) {
    console.error('Error setting seller role:', e.message);
    console.error('Full error:', e);
    res.status(500).json({ message: 'Failed to set seller role: ' + e.message });
  }
});

// Get all sellers (admin only)
router.get('/sellers', verifyUser, async (req, res) => {
  if (!req.user.admin) return res.status(403).json({ message: 'Not authorized' });

  try {
    const listUsersResult = await admin.auth().listUsers();
    const sellers = listUsersResult.users.filter(user => user.customClaims && user.customClaims.seller);
    const sellerData = sellers.map(user => ({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || 'N/A',
      // Add more fields if needed
    }));
    res.json(sellerData);
  } catch (e) {
    console.error('Error fetching sellers:', e);
    res.status(500).json({ message: 'Failed to fetch sellers' });
  }
});

// Get user by uid
router.get('/:uid', verifyUser, async (req, res) => {
  try {
    const userRecord = await admin.auth().getUser(req.params.uid);
    res.json({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName || 'N/A'
    });
  } catch (e) {
    res.status(404).json({ message: 'User not found' });
  }
});

export default router;
