const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware function to protect routes.
 * It checks for the JWT in the httpOnly cookie (primary) or Authorization header (fallback).
 * If valid, it attaches the user object and session ID to the request object.
 */
exports.protect = async (req, res, next) => { 
    
    // --- AUTH BYPASS FOR DEVELOPMENT/DEBUGGING ---
    // Agar environment variable DISABLE_AUTH 'true' set hai, toh authentication ko skip karo.
    if (process.env.DISABLE_AUTH === 'true') {
        console.warn('⚠️ Authentication bypassed for debugging (DISABLE_AUTH is true in environment).');
        // Agar aage ka code req.user par nirbhar karta hai, toh aap yahan ek mock user object attach kar sakte hain.
        // req.user = { id: 'mockUserId', role: 'admin' }; 
        return next();
    }
    // ------------------------------------------
    
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
        return res.status(401).json({ success: false, error: 'Not authorized to access this route. No token found.' });
    }

    try {
        // 1. Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 2. Find user by ID and attach it to the request object
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }

        // 3. Verify session validity and attach the session ID
        const sessionExists = user.sessions.some(session => session.sessionId === decoded.sessionId);

        if (!sessionExists) {
             return res.status(401).json({ success: false, error: 'Session expired or invalidated. Please log in again.' });
        }

        req.user = user;
        req.sessionId = decoded.sessionId; // Attach the session ID from the token
        
        next();
    } catch (error) {
        console.error('JWT Verification Error:', error.message);
        // Clear cookies on JWT error (e.g., token expired)
        res.cookie('authToken', 'none', { expires: new Date(Date.now() + 10 * 1000), httpOnly: true, path: '/' });
        res.cookie('loggedIn', 'none', { expires: new Date(Date.now() + 10 * 1000), httpOnly: false, path: '/' });
        return res.status(401).json({ success: false, error: 'Not authorized to access this route. Invalid or expired token.' });
    }
};

/**
 * Authorization middleware to restrict access based on user role.
 */
exports.restrictTo = (...roles) => { 
    return (req, res, next) => { 
        // Agar auth bypass active hai, toh role check ko bhi bypass karna behtar hai.
        if (process.env.DISABLE_AUTH === 'true') {
            return next();
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, error: `User role ${req.user.role} is not authorized to access this route.` });
        }
        next(); 
    }; 
};