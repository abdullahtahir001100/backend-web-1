const express = require('express');
const router = express.Router();
const { Resend } = require('resend');
const User = require('../models/User');
const OTP = require('../models/OTP');

// Initialize Resend
const resend = new Resend('re_ZrEPwS8B_4LmczeFrB3S34171FNuEnDyx');

// --- 1. LOGIN (Direct Plain Text Match) ---
router.post('/login', async (req, res) => {
    try {
        const email = req.body.email ? req.body.email.trim().toLowerCase() : "";
        const password = req.body.password ? req.body.password.trim() : "";

        if (!email || !password) {
            return res.status(400).json({ message: "CREDENTIALS_REQUIRED" });
        }

        const user = await User.findOne({ email, password });
        
        if (!user) {
            return res.status(401).json({ message: "ACCESS_DENIED: INVALID_CREDENTIALS" });
        }

        res.json({ 
            success: true,
            user: { username: user.username, email: user.email } 
        });
    } catch (err) {
        res.status(500).json({ message: "SYSTEM_CORE_ERROR" });
    }
});

// --- 2. FORGOT PASSWORD (Using Resend Free Sandbox) ---
router.post('/forgot-password', async (req, res) => {
    const email = req.body.email ? req.body.email.trim().toLowerCase() : "";
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "IDENTITY_NOT_FOUND" });

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await OTP.findOneAndUpdate({ email }, { otp: otpCode, createdAt: Date.now() }, { upsert: true });

        // IMPORTANT: Agar domain verified nahi hai, toh sirf 'onboarding@resend.dev' chalega
        // Aur 'to' mein sirf wahi email chalegi jo Resend account mein registered hai.
        const { data, error } = await resend.emails.send({
            from: 'onboarding@resend.dev', 
            to: [email],
            subject: 'GATEWAY_ACCESS_RECOVERY',
            html: `
                <div style="background:#000; color:#fff; padding:20px; border:1px solid #f00; font-family:monospace;">
                    <h2>OTP_CODE: ${otpCode}</h2>
                    <p>Use this code to reset your access.</p>
                </div>
            `
        });

        if (error) {
            console.error("Resend Error:", error);
            return res.status(400).json({ message: "EMAIL_FAILED", error });
        }

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

// --- 4. FORCE SEED ---
router.get('/force-seed', async (req, res) => {
    try {
        await User.deleteMany({}); 
        await User.create({ 
            username: "abdullahtahir", 
            email: "abdullahtahi001@gmail.com", 
            password: "pak1234567", 
            role: "admin" 
        });
        res.send("Seed Done! Log in with pak1234567");
    } catch (err) {
        res.status(500).send("Seed Failed: " + err.message);
    }
});

module.exports = router;
