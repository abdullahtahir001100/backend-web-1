const express = require('express');
const router = express.Router();
const { Resend } = require('resend');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const OTP = require('../models/OTP');

// Aapki provide ki hui Resend API Key
const resend = new Resend('re_ZrEPwS8B_4LmczeFrB3S34171FNuEnDyx');

// --- 1. LOGIN (Authenticate) ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Identity check
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: "ACCESS_DENIED: IDENTITY_UNKNOWN" });
        }

        // Password Hash Comparison
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "ACCESS_DENIED: HASH_MISMATCH" });
        }

        // Token Generation for Dashboard Access
        const token = jwt.sign(
            { id: user._id, username: user.username }, 
            process.env.JWT_SECRET || 'GATEWAY_SECRET_2026', 
            { expiresIn: '24h' }
        );

        res.json({ 
            success: true,
            token, 
            user: { username: user.username, email: user.email } 
        });

    } catch (err) {
        res.status(500).json({ message: "SYSTEM_CORE_ERROR" });
    }
});

// --- 2. FORGOT PASSWORD (OTP System) ---
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "IDENTITY_NOT_FOUND" });

        // Generate 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Save to OTP Model (Temporary Store)
        await OTP.findOneAndUpdate(
            { email }, 
            { otp: otpCode, createdAt: Date.now() }, 
            { upsert: true }
        );

        // Send Email via Resend
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
        res.json({ message: "RECOVERY_HASH_DISPATCHED" });

    } catch (err) {
        res.status(500).json({ message: "DISPATCH_FAILED" });
    }
});

// --- 3. RESET PASSWORD ---
router.post('/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;

    try {
        const otpRecord = await OTP.findOne({ email, otp });
        if (!otpRecord) return res.status(400).json({ message: "INVALID_OR_EXPIRED_HASH" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await User.findOneAndUpdate({ email }, { password: hashedPassword });
        await OTP.deleteOne({ email });

        res.json({ message: "ACCESS_HASH_UPDATED_SUCCESSFULLY" });

    } catch (err) {
        res.status(500).json({ message: "RESET_PROTOCOL_FAILED" });
    }
});
router.get('/force-seed', async (req, res) => {
    const User = require('../models/User');
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash("admin_gateway_2026", 10);
    await User.create({ 
        username: "abdullahtahir", 
        email: "abdullahtahi001@gmail.com", 
        password: 'pak1234567', 
        role: "admin" 
    });
    res.send("Seed Done!");
});
module.exports = router;
