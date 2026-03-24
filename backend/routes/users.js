import express from 'express';
import admin from '../firebase.js';
import { verifyUser } from '../authMiddleware.js';

const router = express.Router();
const sellerRequestsCollection = 'sellerRequests';

// Submit seller application request
router.post('/become-seller', verifyUser, async (req, res) => {
  try {
    const uid = req.user.uid;
    const userRecord = await admin.auth().getUser(uid);
    const claims = userRecord.customClaims || {};

    if (claims.seller === true) {
      return res.status(400).json({ message: 'You already have seller access.' });
    }

    const {
      firstName,
      lastName,
      age,
      phone,
      address,
      city,
      province,
      domain,
      experience,
      bio,
      portfolio,
      idType,
      idNumber,
      idFileName,
      idFileData
    } = req.body || {};

    const required = [
      firstName, lastName, age, phone, address, city, domain, experience, bio, idType, idNumber
    ];
    if (required.some(v => v == null || String(v).trim() === '')) {
      return res.status(400).json({ message: 'Please fill all required seller request fields.' });
    }

    const existingReqSnap = await admin.firestore()
      .collection(sellerRequestsCollection)
      .where('uid', '==', uid)
      .where('status', 'in', ['pending', 'approved'])
      .limit(1)
      .get();

    if (!existingReqSnap.empty) {
      return res.status(409).json({ message: 'You already have a pending/approved seller request.' });
    }

    const payload = {
      uid,
      email: userRecord.email || '',
      displayName: userRecord.displayName || '',
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      age: Number(age),
      phone: String(phone).trim(),
      address: String(address).trim(),
      city: String(city).trim(),
      province: String(province || '').trim(),
      domain: String(domain).trim(),
      experience: String(experience).trim(),
      bio: String(bio).trim(),
      portfolio: String(portfolio || '').trim(),
      idType: String(idType).trim(),
      idNumber: String(idNumber).trim(),
      idFileName: String(idFileName || '').trim(),
      idFileData: typeof idFileData === 'string' ? idFileData : '',
      status: 'pending',
      createdAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedByUid: null,
      reviewedByEmail: null,
      reviewNote: ''
    };

    const docRef = await admin.firestore().collection(sellerRequestsCollection).add(payload);
    res.json({ message: 'Seller request submitted successfully.', requestId: docRef.id });
  } catch (e) {
    console.error('Error saving seller request:', e);
    res.status(500).json({ message: 'Failed to submit seller request.' });
  }
});

// Get all seller requests (admin only)
router.get('/seller-requests', verifyUser, async (req, res) => {
  if (!req.user.admin) return res.status(403).json({ message: 'Not authorized' });

  try {
    const snapshot = await admin.firestore()
      .collection(sellerRequestsCollection)
      .orderBy('createdAt', 'desc')
      .get();

    const requests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(requests);
  } catch (e) {
    console.error('Error fetching seller requests:', e);
    res.status(500).json({ message: 'Failed to fetch seller requests' });
  }
});

// Approve / Reject a seller request (admin only)
router.patch('/seller-requests/:requestId', verifyUser, async (req, res) => {
  if (!req.user.admin) return res.status(403).json({ message: 'Not authorized' });

  try {
    const requestId = req.params.requestId;
    const { action, reviewNote } = req.body || {};

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: "Action must be either 'approve' or 'reject'." });
    }

    const docRef = admin.firestore().collection(sellerRequestsCollection).doc(requestId);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ message: 'Seller request not found.' });

    const reqData = snap.data();
    if (reqData.status !== 'pending') {
      return res.status(409).json({ message: `Request already ${reqData.status}.` });
    }

    const nowIso = new Date().toISOString();
    const nextStatus = action === 'approve' ? 'approved' : 'rejected';

    if (action === 'approve') {
      const userRecord = await admin.auth().getUser(reqData.uid);
      const existing = userRecord.customClaims || {};
      await admin.auth().setCustomUserClaims(reqData.uid, { ...existing, seller: true });
    }

    await docRef.update({
      status: nextStatus,
      reviewedAt: nowIso,
      reviewedByUid: req.user.uid,
      reviewedByEmail: req.user.email || '',
      reviewNote: String(reviewNote || '').trim()
    });

    res.json({ message: `Seller request ${nextStatus}.` });
  } catch (e) {
    console.error('Error reviewing seller request:', e);
    res.status(500).json({ message: 'Failed to review seller request.' });
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
