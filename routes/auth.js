const express = require('express');
const router = express.Router();
const { Resend } = require('resend');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const OTP = require('../models/OTP');

// Initialize Resend
const resend = new Resend('re_ZrEPwS8B_4LmczeFrB3S34171FNuEnDyx');

// --- 1. LOGIN (With Trim Protection) ---
router.post('/login', async (req, res) => {
    console.log(">> [AUTH] LOGIN_ATTEMPT_START");
    
    try {
        const email = req.body.email ? req.body.email.trim().toLowerCase() : "";
        const password = req.body.password ? req.body.password.trim() : "";

        if (!email || !password) {
            return res.status(400).json({ message: "CREDENTIALS_REQUIRED" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            console.log("-- [AUTH] IDENTITY_UNKNOWN:", email);
            return res.status(401).json({ message: "ACCESS_DENIED: IDENTITY_UNKNOWN" });
        }

        // Bcrypt compare (Direct)
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            console.log("-- [AUTH] HASH_MISMATCH for:", email);
            return res.status(401).json({ message: "ACCESS_DENIED: HASH_MISMATCH" });
        }

        const token = jwt.sign(
            { id: user._id, username: user.username }, 
            process.env.JWT_SECRET || 'GATEWAY_SECRET_2026', 
            { expiresIn: '24h' }
        );

        console.log(">> [AUTH] LOGIN_SUCCESSFUL");
        res.json({ 
            success: true,
            token, 
            user: { username: user.username, email: user.email } 
        });

    } catch (err) {
        console.error("!! [AUTH] LOGIN_CORE_ERROR:", err.message);
        res.status(500).json({ message: "SYSTEM_CORE_ERROR" });
    }
});

// --- 2. FORGOT PASSWORD ---
router.post('/forgot-password', async (req, res) => {
    const email = req.body.email ? req.body.email.trim().toLowerCase() : "";
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "IDENTITY_NOT_FOUND" });

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await OTP.findOneAndUpdate({ email }, { otp: otpCode, createdAt: Date.now() }, { upsert: true });

        await resend.emails.send({
            from: 'Gateway <system@abdullahtahir.me>',
            to: [email],
            subject: 'GATEWAY_ACCESS_RECOVERY',
            html: `<div style="background:#000;color:#fff;padding:20px;border:1px solid #f00;">OTP: ${otpCode}</div>`
        });

        res.json({ message: "RECOVERY_HASH_DISPATCHED" });
    } catch (err) {
        res.status(500).json({ message: "DISPATCH_FAILED" });
    }
});

// --- 3. RESET PASSWORD ---
router.post('/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;
    try {
        const otpRecord = await OTP.findOne({ email: email.trim().toLowerCase(), otp });
        if (!otpRecord) return res.status(400).json({ message: "INVALID_OR_EXPIRED_HASH" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword.trim(), salt);

        await User.findOneAndUpdate({ email: email.trim().toLowerCase() }, { password: hashedPassword });
        await OTP.deleteOne({ email: email.trim().toLowerCase() });

        res.json({ message: "ACCESS_HASH_UPDATED_SUCCESSFULLY" });
    } catch (err) {
        res.status(500).json({ message: "RESET_PROTOCOL_FAILED" });
    }
});

// --- 4. FORCE SEED (The No-Bypass Version) ---
router.get('/force-seed', async (req, res) => {
    console.log(">> [SYSTEM] AGGRESSIVE_SEED_STARTED");
    try {
        // Step 1: Drop indexes
        try { await User.collection.dropIndexes(); } catch (e) { console.log("No indexes"); }

        // Step 2: Clear Collection
        await User.deleteMany({}); 

        // Step 3: Secure Hashing
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('pak1234567', salt);

        // Step 4: Direct Insert (Bypass Mongoose middleware to avoid double hashing)
        await User.collection.insertOne({ 
            username: "abdullahtahir", 
            email: "abdullahtahi001@gmail.com", 
            password: hashedPassword,
            role: "admin",
            createdAt: new Date(),
            updatedAt: new Date()
        });

        res.send("Seed Done! Login: abdullahtahi001@gmail.com / pak1234567");
    } catch (err) {
        res.status(500).send("Seed Failed: " + err.message);
    }
});

module.exports = router;
