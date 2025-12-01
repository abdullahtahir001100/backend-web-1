
const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes'); 
const userRoutes = require('./userRoutes'); 
const activityRoutes = require('./activityRoutes'); 

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/activity', activityRoutes);

module.exports = router;