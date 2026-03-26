const express = require('express');
const router = express.Router();
const { Resend } = require('resend');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const OTP = require('../models/OTP');

const resend = new Resend('re_ZrEPwS8B_4LmczeFrB3S34171FNuEnDyx');

// --- 1. LOGIN (Authenticate) ---
router.post('/login', async (req, res) => {
    console.log(">> LOGIN_ROUTE_TRIGGERED"); // Check message
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            console.log("-- IDENTITY_UNKNOWN");
            return res.status(401).json({ message: "ACCESS_DENIED: IDENTITY_UNKNOWN" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log("-- HASH_MISMATCH");
            return res.status(401).json({ message: "ACCESS_DENIED: HASH_MISMATCH" });
        }

        const token = jwt.sign(
            { id: user._id, username: user.username }, 
            process.env.JWT_SECRET || 'GATEWAY_SECRET_2026', 
            { expiresIn: '24h' }
        );

        console.log(">> LOGIN_SUCCESSFUL");
        res.json({ 
            success: true,
            token, 
            user: { username: user.username, email: user.email } 
        });

    } catch (err) {
        console.error("!! LOGIN_CORE_ERROR:", err.message);
        res.status(500).json({ message: "SYSTEM_CORE_ERROR" });
    }
});

// --- 2. FORGOT PASSWORD (OTP System) ---
router.post('/forgot-password', async (req, res) => {
    console.log(">> FORGOT_PWD_ROUTE_TRIGGERED");
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "IDENTITY_NOT_FOUND" });

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
        console.log(">> OTP_DISPATCHED_TO:", email);
        res.json({ message: "RECOVERY_HASH_DISPATCHED" });

    } catch (err) {
        console.error("!! DISPATCH_ERROR:", err.message);
        res.status(500).json({ message: "DISPATCH_FAILED" });
    }
});

// --- 3. RESET PASSWORD ---
router.post('/reset-password', async (req, res) => {
    console.log(">> RESET_PWD_ROUTE_TRIGGERED");
    const { email, otp, newPassword } = req.body;

    try {
        const otpRecord = await OTP.findOne({ email, otp });
        if (!otpRecord) return res.status(400).json({ message: "INVALID_OR_EXPIRED_HASH" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await User.findOneAndUpdate({ email }, { password: hashedPassword });
        await OTP.deleteOne({ email });

        console.log(">> PASSWORD_RESET_SUCCESS");
        res.json({ message: "ACCESS_HASH_UPDATED_SUCCESSFULLY" });

    } catch (err) {
        console.error("!! RESET_ERROR:", err.message);
        res.status(500).json({ message: "RESET_PROTOCOL_FAILED" });
    }
});

// --- 4. FORCE SEED (Production Only) ---
router.get('/force-seed', async (req, res) => {
    console.log(">> SEED_PROCESS_STARTED");
    try {
        const passwordToHash = 'pak1234567';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(passwordToHash, salt);

        // Purana user delete karein agar exists karta hai taake naya hash save ho
        await User.deleteOne({ email: "abdullahtahi001@gmail.com" });

        await User.create({ 
            username: "abdullahtahir", 
            email: "abdullahtahi001@gmail.com", 
            password: hashedPassword, // Hashed password save ho raha hai
            role: "admin" 
        });

        console.log(">> SEED_SUCCESSFUL: USER_CREATED");
        res.send("Seed Done! You can now login with: abdullahtahi001@gmail.com / pak1234567");
    } catch (err) {
        console.error("!! SEED_ERROR:", err.message);
        res.status(500).send("Seed Failed: " + err.message);
    }
});

module.exports = router;
