const express = require('express');
const router = express.Router();
const { Resend } = require('resend');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const OTP = require('../models/OTP');

// Initialize Resend
const resend = new Resend('re_ZrEPwS8B_4LmczeFrB3S34171FNuEnDyx');

// --- 1. LOGIN (With Strict Data Cleaning) ---
router.post('/login', async (req, res) => {
    console.log(">> [AUTH] LOGIN_ATTEMPT_START");
    
    try {
        // Cleaning input data (Removing accidental spaces)
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

        // Direct bcrypt comparison
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            console.log("-- [AUTH] HASH_MISMATCH for:", email);
            return res.status(401).json({ message: "ACCESS_DENIED: HASH_MISMATCH" });
        }

        // Generate Secure Token
        const token = jwt.sign(
            { id: user._id, username: user.username }, 
            process.env.JWT_SECRET || 'GATEWAY_SECRET_2026', 
            { expiresIn: '24h' }
        );

        console.log(">> [AUTH] LOGIN_SUCCESSFUL for:", user.username);
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

// --- 2. FORGOT PASSWORD (OTP System) ---
router.post('/forgot-password', async (req, res) => {
    console.log(">> [AUTH] FORGOT_PWD_REQUESTED");
    const email = req.body.email ? req.body.email.trim().toLowerCase() : "";

    try {
        const user = await User.findOne({ email });
        if (!user) {
            console.log("-- [AUTH] RECOVERY_REJECTED: Email not found");
            return res.status(404).json({ message: "IDENTITY_NOT_FOUND" });
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        await OTP.findOneAndUpdate(
            { email }, 
            { otp: otpCode, createdAt: Date.now() }, 
            { upsert: true }
        );

        const { error } = await resend.emails.send({
            from: 'Gateway <system@abdullahtahir.me>',
            to: [email],
            subject: 'GATEWAY_ACCESS_RECOVERY',
            html: `
                <div style="background:#030303; color:#fff; padding:20px; border:1px solid #ff2a00; font-family:monospace;">
                    <h2 style="color:#ff2a00;">INKBYHAND_SECURITY</h2>
                    <p>RECOVERY_HASH_GENERATED:</p>
                    <h1 style="text-align:center; letter-spacing:5px;">${otpCode}</h1>
                    <p>EXPIRES_IN: 10_MINUTES</p>
                </div>
            `
        });

        if (error) throw error;
        console.log(">> [AUTH] OTP_DISPATCHED to:", email);
        res.json({ message: "RECOVERY_HASH_DISPATCHED" });

    } catch (err) {
        console.error("!! [AUTH] DISPATCH_ERROR:", err.message);
        res.status(500).json({ message: "DISPATCH_FAILED" });
    }
});

// --- 3. RESET PASSWORD ---
router.post('/reset-password', async (req, res) => {
    console.log(">> [AUTH] RESET_PWD_ATTEMPT");
    const { email, otp, newPassword } = req.body;

    try {
        const otpRecord = await OTP.findOne({ email: email.trim().toLowerCase(), otp });
        if (!otpRecord) {
            console.log("-- [AUTH] RESET_REJECTED: Invalid/Expired OTP");
            return res.status(400).json({ message: "INVALID_OR_EXPIRED_HASH" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword.trim(), salt);

        await User.findOneAndUpdate({ email: email.trim().toLowerCase() }, { password: hashedPassword });
        await OTP.deleteOne({ email: email.trim().toLowerCase() });

        console.log(">> [AUTH] ACCESS_HASH_UPDATED for:", email);
        res.json({ message: "ACCESS_HASH_UPDATED_SUCCESSFULLY" });

    } catch (err) {
        console.error("!! [AUTH] RESET_ERROR:", err.message);
        res.status(500).json({ message: "RESET_PROTOCOL_FAILED" });
    }
});

// --- 4. FORCE SEED (The Ultimate Fix) ---
router.get('/force-seed', async (req, res) => {
    console.log(">> [SYSTEM] AGGRESSIVE_SEED_STARTED");
    try {
        // Step 1: Cleanup old indexes that cause duplicate key errors
        try {
            await User.collection.dropIndexes();
            console.log(">> [SYSTEM] OLD_INDEXES_DROPPED");
        } catch (e) {
            console.log(">> [SYSTEM] NO_INDEXES_TO_DROP");
        }

        // Step 2: Delete existing users to prevent conflicts
        await User.deleteMany({}); 
        console.log(">> [SYSTEM] DATABASE_CLEANED");

        // Step 3: Secure Hashing
        const plainPassword = 'pak1234567';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(plainPassword, salt);

        // Step 4: Provision Admin
        await User.create({ 
            username: "abdullahtahir", 
            email: "abdullahtahi001@gmail.com", 
            password: hashedPassword,
            role: "admin" 
        });

        console.log(">> [SYSTEM] SEED_SUCCESSFUL: ADMIN_PROVISIONED");
        res.send("Seed Done! Login with: abdullahtahi001@gmail.com / pak1234567");

    } catch (err) {
        console.error("!! [SYSTEM] SEED_CRITICAL_FAIL:", err.message);
        res.status(500).send("Seed Failed: " + err.message);
    }
});

module.exports = router;
