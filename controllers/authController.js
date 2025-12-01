// File: controllers/authController.js

const jwt = require('jsonwebtoken'); 
const User = require('../models/User'); // Assume User model is defined
const { v4: uuidv4 } = require('uuid');

/**
 * Helper function to set JWT token in an HTTP-only cookie and send response.
 * FIX: Sets two cookies: 1. httpOnly 'authToken' for security, 2. non-httpOnly 'loggedIn' for frontend status check.
 */
const sendTokenResponse = (user, statusCode, res, sessionId) => {
    const token = user.getSignedToken(sessionId); 

    // 1. HTTP-Only Cookie (Main Auth Token)
    const optionsAuth = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000), 
        httpOnly: true, // Cannot be read by client-side JS (HIGH SECURITY)
        secure: process.env.NODE_ENV === 'production',
        path: '/'
    };
    
    // 2. Non-HTTP-Only Cookie (Frontend Status Indicator)
    const optionsStatus = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000), 
        httpOnly: false, // Can be read by client-side JS (FOR STATUS CHECK ONLY)
        secure: process.env.NODE_ENV === 'production',
        path: '/'
    };
    
    user.password = undefined; 
    
    res.status(statusCode)
       .cookie('authToken', token, optionsAuth) // Set Secure Auth Cookie
       .cookie('loggedIn', 'true', optionsStatus) // Set Client-Readable Status Cookie
       .json({
            success: true,
            token: token, 
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                role: user.role
            }
        });
};


// ----------------------------------------------------------------------
// --- 1. User Registration (POST /api/auth/register) ---
// ----------------------------------------------------------------------
exports.register = async (req, res, next) => {
    const { firstName, lastName, phone, username, email, password } = req.body;

    const currentIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown Device';

    try {
        const user = await User.create({ firstName, lastName, phone, username, email, password });

        // Add initial session
        const sessionId = uuidv4();
        user.sessions.push({
            sessionId,
            loginTime: new Date(),
            device: userAgent,
            ip: currentIP
        });
        user.lastActivity = new Date();
        user.currentDevice = userAgent;
        user.currentIP = currentIP;
        await user.save({ validateBeforeSave: false });

        sendTokenResponse(user, 201, res, sessionId);

    } catch (error) {
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            return res.status(409).json({ success: false, error: `${field.charAt(0).toUpperCase() + field.slice(1)} is already registered.` });
        }
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, error: messages.join(', ') });
        }
        console.error("Registration Error:", error);
        res.status(500).json({ success: false, error: 'Registration failed due to server error.' });
    }
};

// ----------------------------------------------------------------------
// --- 2. User Login (POST /api/auth/login) ---
// ----------------------------------------------------------------------
exports.login = async (req, res) => {
    const { email, password } = req.body; 

    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Please provide email and password.' });
    }

    const currentIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown Device';

    try {
        const user = await User.findOne({ email }).select('+password');

        if (!user || !(await user.matchPassword(password))) {
            return res.status(401).json({ success: false, error: 'Invalid credentials.' });
        }
        
        // Add new session
        const sessionId = uuidv4();
        user.sessions.push({
            sessionId,
            loginTime: new Date(),
            device: userAgent,
            ip: currentIP
        });

        // Limit sessions to 5, remove oldest if exceeded
        if (user.sessions.length > 5) {
            user.sessions.shift();
        }

        // Update tracking fields upon successful login
        user.lastActivity = new Date();
        user.currentIP = currentIP; 
        user.currentDevice = userAgent; 
        await user.save({ validateBeforeSave: false }); // Save tracking data

        sendTokenResponse(user, 200, res, sessionId);
        
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, error: 'Login failed due to a server error.' });
    }
};

// ----------------------------------------------------------------------
// --- 3. Protect Middleware (Protected Routes ke liye) ---
// ----------------------------------------------------------------------
exports.protect = async (req, res, next) => {
    let token;

    // 1. Cookie se token nikalna (Primary method for client-side web apps using httpOnly cookies)
    if (req.cookies && req.cookies.authToken) {
        token = req.cookies.authToken;
    }
    // 2. Authorization Header se token nikalna (Fallback for APIs/testing)
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ success: false, error: 'Not authorized, token missing.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET); 
        
        req.user = await User.findById(decoded.id).select('-password'); 

        if (!req.user) {
            return res.status(401).json({ success: false, error: 'User not found.' });
        }

        // Validate sessionId from token against user's sessions
        const validSession = req.user.sessions.some(session => session.sessionId === decoded.sessionId);
        if (!validSession) {
            return res.status(401).json({ success: false, error: 'Invalid session. Please log in again.' });
        }

        req.sessionId = decoded.sessionId;
        
        next();

    } catch (error) {
        console.error("Authentication Error:", error);
        return res.status(401).json({ success: false, error: 'Token is invalid or expired.' });
    }
};

// ----------------------------------------------------------------------
// --- 4. Restrict Access Middleware (Role Based Access Control - RBAC) ---
// ----------------------------------------------------------------------
exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to perform this action.' });
        }
        next();
    };
};

// ----------------------------------------------------------------------
// --- 5. Forgot Password (Placeholder Logic) ---
// ----------------------------------------------------------------------
exports.forgotPassword = async (req, res) => {
    const { email, phone } = req.body;

    if (!email && !phone) {
         return res.status(400).json({ success: false, error: 'Please provide email or phone number.' });
    }
    
    res.status(200).json({ 
        success: true, 
        message: 'If your account details are correct, a reset link/code has been sent.' 
    });
};

// ----------------------------------------------------------------------
// --- 6. Logout ---
// ----------------------------------------------------------------------
exports.logout = async (req, res) => {
    try {
        // Remove the current session from user's sessions array
        await User.updateOne(
            { _id: req.user._id },
            { $pull: { sessions: { sessionId: req.sessionId } } }
        );

        // Clear both cookies
        res.cookie('authToken', 'none', { expires: new Date(Date.now() + 10 * 1000), httpOnly: true, path: '/' });
        res.cookie('loggedIn', 'none', { expires: new Date(Date.now() + 10 * 1000), httpOnly: false, path: '/' }); // Clear status cookie

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        console.error("Logout Error:", error);
        res.status(500).json({ success: false, error: 'Logout failed due to a server error.' });
    }
};