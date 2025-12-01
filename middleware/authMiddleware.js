// middleware/authMiddleware.js

// The 'jwt' and 'User' imports are no longer strictly needed if the function is empty,
// but they can be left for future use or clarity.
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Completely disables the 'protect' authentication middleware.
 * All requests will proceed to the next handler without token validation.
 */
exports.protect = async (req, res, next) => {
    // --- Authentication logic has been REMOVED ---
    
    // By immediately calling next(), the request proceeds directly 
    // to the next middleware or the final route handler.
    next(); 
};

/**
 * Disables the 'restrictTo' authorization middleware.
 * All roles will be allowed access to restricted routes.
 * * NOTE: This function still needs to return an executable Express middleware function.
 */
exports.restrictTo = (...roles) => {
    // Returns a middleware function that immediately calls next()
    return (req, res, next) => {
        // --- Authorization logic has been REMOVED ---
        
        next(); // Proceed to the next handler immediately
    };
};