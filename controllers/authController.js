const jwt = require('jsonwebtoken'); 
const User = require('../models/User'); // Assume User model is defined
const { v4: uuidv4 } = require('uuid'); // For generating unique session IDs

/**
 * Helper function to set JWT token in a cookie and send response.
 * ⚠️ TEMPORARY CHANGE: httpOnly has been set to false for debugging.
 */
const sendTokenResponse = (user, statusCode, res, sessionId, req) => {
    // Generates the JWT token containing the user ID and the current session ID
    const token = user.getSignedToken(sessionId); 

    const cookieExpireDays = process.env.JWT_COOKIE_EXPIRE || 7; // Default to 7 days
    const expireDate = new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000);

    // --- Secure flag for Development/Production ---
    const secureCookie = process.env.NODE_ENV === 'production' || true;
    
    // 1. Main Auth Token Cookie
    const optionsAuth = {
        expires: expireDate, 
        httpOnly: false, // 🛑 TEMPORARILY CHANGED TO FALSE FOR DEBUGGING!
        secure: secureCookie, 
        path: '/', 
        sameSite: 'None' 
    };
    
    // 2. Non-HTTP-Only Cookie (Frontend Status Indicator)
    const optionsStatus = {
        expires: expireDate, 
        httpOnly: false, 
        secure: secureCookie, 
        path: '/',
        sameSite: 'None'
    };
    
    // Do not send password back in the response
    user.password = undefined; 
    
    res.status(statusCode)
        .cookie('authToken', token, optionsAuth) // Set Auth Cookie (Client-Readable)
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
        
        // Update user tracking fields
        user.lastActivity = new Date();
        user.currentDevice = userAgent;
        user.currentIP = currentIP;
        // Skip validation since the password has already been validated and hashed during the User.create() call
        await user.save({ validateBeforeSave: false }); 

        sendTokenResponse(user, 201, res, sessionId, req); 

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
        // Find user, explicitly selecting password for verification
        const user = await User.findOne({ email }).select('+password');

        // Check if user exists or password matches
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
            user.sessions.shift(); // Remove the oldest session (first element)
        }

        // Update tracking fields upon successful login
        user.lastActivity = new Date();
        user.currentIP = currentIP; 
        user.currentDevice = userAgent; 
        await user.save({ validateBeforeSave: false }); // Save tracking data and session array

        sendTokenResponse(user, 200, res, sessionId, req);
        
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, error: 'Login failed due to a server error.' });
    }
};

// ----------------------------------------------------------------------
// --- 3. Protect Middleware (Protected Routes) ---
// ----------------------------------------------------------------------
exports.protect = async (req, res, next) => {
    let token;

    // 1. Extract token from Cookie (Primary method for client-side web apps)
    if (req.cookies && req.cookies.authToken) {
        token = req.cookies.authToken;
        console.log("DEBUG: Token found in Cookie.");
    }
    // 2. Extract token from Authorization Header (Fallback for APIs/testing/Manual sending)
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
        console.log("DEBUG: Token found in Authorization Header.");
    } else {
        console.log("DEBUG: No token found in Cookie or Header.");
    }

    if (!token) {
        return res.status(401).json({ success: false, error: 'Not authorized, token missing.' });
    }
    // Log a snippet of the token
    console.log(`DEBUG: Extracted Token: ${token.substring(0, 30)}...`); 

    try {
        // 1. Verify token and extract payload
        const decoded = jwt.verify(token, process.env.JWT_SECRET); 
        console.log("DEBUG: JWT Verified successfully.");
        console.log("DEBUG: Decoded Payload:", decoded); // 💡 CHECK THIS LOG CAREFULLY

        // 2. Find user (without password)
        req.user = await User.findById(decoded.id).select('-password'); 

        if (!req.user) {
            console.log(`DEBUG: User not found for ID: ${decoded.id}`);
            return res.status(401).json({ success: false, error: 'User not found.' });
        }
        console.log(`DEBUG: User found: ${req.user.email}`);


        // 3. Validate sessionId from token against user's stored sessions (Crucial for remote logout)
        const validSession = req.user.sessions.some(session => session.sessionId === decoded.sessionId);
        
        if (!validSession) {
            console.log(`DEBUG: Session ID Mismatch/Invalid. Token Session ID: ${decoded.sessionId}.`);
            console.log("DEBUG: Stored Sessions:", req.user.sessions.map(s => s.sessionId));
            // If the session ID in the token is no longer in the DB, the token is invalid
            return res.status(401).json({ success: false, error: 'Invalid session. Please log in again.' });
        }
        console.log("DEBUG: Session ID Validated.");

        // Attach sessionId to the request for use in logout/session management endpoints
        req.sessionId = decoded.sessionId;
        
        // If all checks pass, proceed to the route handler
        next();

    } catch (error) {
        // Log the specific error (e.g., TokenExpiredError, JsonWebTokenError)
        console.error("Authentication Error/Token Invalid:", error.name, error.message);
        
        // Clear the bad cookie to force a fresh login
        const clearCookieOptions = { expires: new Date(Date.now() + 10 * 1000), httpOnly: false, path: '/', sameSite: 'None' }; 
        res.cookie('authToken', 'none', clearCookieOptions);
        res.cookie('loggedIn', 'none', clearCookieOptions); 

        return res.status(401).json({ success: false, error: `Token is invalid or expired. Detail: ${error.message}` });
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
    
    // In a real application, logic to find user, generate token, and send email/SMS would go here.
    
    res.status(200).json({ 
        success: true, 
        message: 'If your account details are correct, a reset link/code has been sent.' 
    });
};

// ----------------------------------------------------------------------
// --- 6. Logout (DELETE /api/auth/logout) ---
// ----------------------------------------------------------------------
exports.logout = async (req, res) => {
    try {
        if (!req.user) {
             throw new Error("User not authenticated for session removal.");
        }
        
        // 1. Remove the current session from user's sessions array in the database
        await User.updateOne(
            { _id: req.user._id },
            { $pull: { sessions: { sessionId: req.sessionId } } }
        );

        // 2. Clear both cookies by setting expiration to the past
        const clearCookieOptions = { expires: new Date(Date.now() + 10 * 1000), path: '/', sameSite: 'None', httpOnly: false }; 
        
        res.cookie('authToken', 'none', clearCookieOptions); 
        res.cookie('loggedIn', 'none', clearCookieOptions); 

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        const clearCookieOptions = { expires: new Date(Date.now() + 10 * 1000), path: '/', sameSite: 'None', httpOnly: false }; 
        res.cookie('authToken', 'none', clearCookieOptions);
        res.cookie('loggedIn', 'none', clearCookieOptions); 

        console.error("Logout Error:", error);
        res.status(200).json({ success: true, message: 'Logged out successfully (or session already invalid).' });
    }
};

module.exports = {
    register: exports.register,
    login: exports.login,
    protect: exports.protect,
    restrictTo: exports.restrictTo,
    forgotPassword: exports.forgotPassword,
    logout: exports.logout,
};