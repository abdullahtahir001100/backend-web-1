const express = require('express');
const router = express.Router();
const { Resend } = require('resend');
const User = require('../models/User');
const OTP = require('../models/OTP');

// Initialize Resend
const resend = new Resend('re_ZrEPwS8B_4LmczeFrB3S34171FNuEnDyx');

// --- 1. LOGIN (Direct Plain Text Match) ---
router.post('/login', async (req, res) => {
    console.log(">> [AUTH] LOGIN_ATTEMPT_START");
    
    try {
        const email = req.body.email ? req.body.email.trim().toLowerCase() : "";
        const password = req.body.password ? req.body.password.trim() : "";

        if (!email || !password) {
            return res.status(400).json({ message: "CREDENTIALS_REQUIRED" });
        }

        // Direct database match - No Bcrypt
        const user = await User.findOne({ email, password });
        
        if (!user) {
            console.log("-- [AUTH] INVALID_CREDENTIALS:", email);
            return res.status(401).json({ message: "ACCESS_DENIED: INVALID_CREDENTIALS" });
        }

        console.log(">> [AUTH] LOGIN_SUCCESSFUL");
        res.json({ 
            success: true,
            user: { username: user.username, email: user.email } 
        });

    } catch (err) {
        console.error("!! [AUTH] LOGIN_CORE_ERROR:", err.message);
        res.status(500).json({ message: "SYSTEM_CORE_ERROR" });
    }
});

// --- 2. FORGOT PASSWORD (OTP Dispatch) ---
router.post('/forgot-password', async (req, res) => {
    const email = req.body.email ? req.body.email.trim().toLowerCase() : "";
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "IDENTITY_NOT_FOUND" });

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await OTP.findOneAndUpdate({ email }, { otp: otpCode, createdAt: Date.now() }, { upsert: true });

        // Email Sending via Resend
        await resend.emails.send({
            from: 'Gateway <system@abdullahtahir.me>',
            to: [email],
            subject: 'GATEWAY_ACCESS_RECOVERY',
            html: `
                <div style="background:#030303; color:#fff; padding:20px; border:1px solid #ff2a00; font-family:monospace;">
                    <h2 style="color:#ff2a00;">SECURITY_GATEWAY</h2>
                    <p>RECOVERY_OTP_GENERATED:</p>
                    <h1 style="text-align:center; letter-spacing:5px;">${otpCode}</h1>
                    <p>EXPIRES_IN: 10_MINUTES</p>
                </div>
            `
        });

        res.json({ message: "RECOVERY_HASH_DISPATCHED" });
    } catch (err) {
        res.status(500).json({ message: "DISPATCH_FAILED" });
    }
});

// --- 3. RESET PASSWORD (Plain Text Update) ---
router.post('/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;
    try {
        const otpRecord = await OTP.findOne({ email: email.trim().toLowerCase(), otp });
        if (!otpRecord) return res.status(400).json({ message: "INVALID_OR_EXPIRED_HASH" });

        // Password direct plain text mein update hoga
        await User.findOneAndUpdate(
            { email: email.trim().toLowerCase() }, 
            { password: newPassword.trim() }
        );
        
        await OTP.deleteOne({ email: email.trim().toLowerCase() });

        res.json({ message: "ACCESS_HASH_UPDATED_SUCCESSFULLY" });
    } catch (err) {
        res.status(500).json({ message: "RESET_PROTOCOL_FAILED" });
    }
});

// --- 4. FORCE SEED (The Simple Reset) ---
router.get('/force-seed', async (req, res) => {
    console.log(">> [SYSTEM] PLAIN_TEXT_SEED_STARTED");
    try {
        try { await User.collection.dropIndexes(); } catch (e) { console.log("No indexes"); }

        await User.deleteMany({}); 

        // Direct Insert without Hashing
        await User.create({ 
            username: "abdullahtahir", 
            email: "abdullahtahi001@gmail.com", 
            password: "pak1234567", 
            role: "admin" 
        });

        res.send("Seed Done! Logic: Plain-Text | No-JWT");
    } catch (err) {
        res.status(500).send("Seed Failed: " + err.message);
    }
});

module.exports = router;
