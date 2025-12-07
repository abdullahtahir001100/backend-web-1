// File: routes/activityRoutes.js

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware'); 
const { recordActivity } = require('../controllers/activityController'); 

// FIX: Use the 'protect' middleware to ensure req.user is set and valid
router.post('/', protect, recordActivity); // <-- ADD 'protect' HERE

module.exports = router;