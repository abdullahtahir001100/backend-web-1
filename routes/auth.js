const express = require('express');
const router = express.Router();
const { Resend } = require('resend');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const OTP = require('../models/OTP');

const resend = new Resend('re_ZrEPwS8B_4LmczeFrB3S34171FNuEnDyx');

// --- 1. LOGIN ENDPOINT ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "INVALID_IDENTITY" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "ACCESS_DENIED_HASH_MISMATCH" });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user._id, email: user.email } });
    } catch (err) {
        res.status(500).json({ message: "SVR_ERR" });
    }
});

// --- 2. FORGOT PASSWORD (OTP Dispatch) ---
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "IDENTITY_NOT_FOUND" });

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await OTP.findOneAndUpdate({ email }, { otp: otpCode }, { upsert: true, new: true });

        const { data, error } = await resend.emails.send({
            from: 'Gateway <system@abdullahtahir.me>',
            to: [email],
            subject: 'GATEWAY_ACCESS_RECOVERY',
            html: `
                <div style="background:#030303; color:#fff; padding:30px; border:1px solid #ff2a00; font-family:monospace;">
                    <h1 style="color:#ff2a00;">INKBYHAND SECURITY</h1>
                    <p>RECOVERY HASH GENERATED:</p>
                    <div style="font-size:32px; letter-spacing:10px; text-align:center; padding:20px; background:#111;">${otpCode}</div>
                    <p>VALID_FOR: 10_MINUTES</p>
                </div>
            `
        });

        if (error) return res.status(400).json({ error });
        res.json({ message: "RECOVERY_HASH_DISPATCHED" });
    } catch (err) {
        res.status(500).json({ message: "DISPATCH_FAILED" });
    }
});

// --- 3. RESET PASSWORD (OTP Verification) ---
router.post('/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;
    try {
        const record = await OTP.findOne({ email, otp });
        if (!record) return res.status(400).json({ message: "INVALID_OR_EXPIRED_HASH" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await User.findOneAndUpdate({ email }, { password: hashedPassword });
        await OTP.deleteOne({ _id: record._id });

        res.json({ message: "ACCESS_HASH_UPDATED" });
    } catch (err) {
        res.status(500).json({ message: "RESET_FAILED" });
    }
});

module.exports = router;
