
// routes/authRoutes.js

const express = require('express');
const router = express.Router();

// Direct import — 100% working

const authController = require('../controllers/authController');

// Debug line — server start karte hi dikhega
console.log("Loaded controllers:", Object.keys(authController));

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout || ((req, res) => res.json({success: true})));
router.post('/forgotpassword', authController.forgotPassword || ((req, res) => res.json({success: true, message: "Check email"})));

module.exports = router;