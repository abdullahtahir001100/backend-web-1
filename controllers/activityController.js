const Activity = require('../models/Activity');
const User = require('../models/User'); 
const mongoose = require('mongoose'); 

// ------------------------------------------------------------------
// UTILITY: Formats duration in milliseconds into Hh Mm Ss string
// ------------------------------------------------------------------
const formatDuration = (ms) => {
    if (ms === undefined || ms === null || ms < 0) return '0s'; 
    if (ms < 1000) return `${(ms / 1000).toFixed(1)}s`;

    const totalSeconds = Math.floor(ms / 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    
    let timeString = '';
    if (hours > 0) timeString += `${hours}h `;
    if (minutes > 0) timeString += `${minutes}m `;
    if (seconds > 0 || timeString === '') timeString += `${seconds}s`; 
    return timeString.trim();
};

// ------------------------------------------------------------------
// POST: Record User Activity
// Route: /api/activity (Authentication currently disabled)
// ------------------------------------------------------------------
exports.recordActivity = async (req, res) => {
    // ⭐ CRITICAL FIX: Safely retrieve userId. If 'protect' is disabled, req.user is undefined.
    // This prevents "TypeError: Cannot read properties of undefined (reading '_id')"
    const userId = req.user ? req.user._id : null; 
    
    const { description, type, pageRoute, durationMs } = req.body;
    
    // Capture details from Request Headers
    const currentIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown Device';

    // 400 Bad Request validation check
    if (!description || !type) {
        return res.status(400).json({ success: false, error: 'Description and type are required for logging activity.' });
    }

    try {
        // 1. Create the activity log
        const activity = await Activity.create({
            // userId will be null if user is unauthenticated, which is now allowed by the schema
            userId: userId, 
            description,
            type,
            pageRoute: pageRoute,
            durationMs: durationMs
        });

        // 2. Update the corresponding User Model (only if authenticated)
        if (userId) {
            await User.updateOne(
                { _id: userId },
                { $set: { 
                    lastActivity: new Date(),
                    sessionStatus: 'Active',
                    currentIP: currentIP, 
                    currentDevice: userAgent 
                } }
            );
        }

        res.status(201).json({ 
            success: true, 
            message: 'Activity recorded successfully',
            data: activity
        });

    } catch (error) {
        // Log the error to the server console to aid debugging (e.g., Mongoose validation errors)
        console.error('FATAL DB ERROR RECORDING ACTIVITY:', error);
        res.status(500).json({ success: false, error: 'Server error: Could not record activity.' });
    }
};