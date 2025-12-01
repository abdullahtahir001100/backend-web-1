// File: routes/activityRoutes.js

const express = require('express');
const router = express.Router();
// ⭐ RE-ENABLED: Import the authentication middleware
const { protect } = require('../middleware/authMiddleware'); 
const { recordActivity } = require('../controllers/activityController'); 

// @route POST /api/activity
// ⭐ RE-ENABLED: Add 'protect' middleware to secure the route and attach req.user
router.post('/', recordActivity); 

module.exports = router;