// 📂 File: controllers/userController.js

const User = require('../models/User');
// Assume these models exist and are correctly defined
const Order = require('../models/Order'); 
const ContactMessage = require('../models/ContactMessage'); 
const Activity = require('../models/Activity'); 
const mongoose = require('mongoose');
// Note: Assuming you have an ErrorResponse class, though we will use 
// direct res.status().json() to match the style of your provided code.

// --- UTILITY FUNCTIONS ---

/**
 * Converts milliseconds to a formatted time string (e.g., "1h 3m 45s").
 * @param {number} ms - Duration in milliseconds.
 */
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
    // If hours and minutes are 0, always show seconds
    if (seconds > 0 || timeString === '') timeString += `${seconds}s`; 
    return timeString.trim();
};

/**
 * Formats a Date object into a readable string.
 * @param {Date|string} date - The date to format.
 */
const formatTime = (date) => {
    if (!date || isNaN(new Date(date))) return 'Invalid Date';
    const d = new Date(date);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};


// ==================================================================
// --- PROTECTED USER-SPECIFIC ENDPOINTS (Fixing 404s) ---
// ==================================================================

// ------------------------------------------------------------------
// GET: Get Me (Protected) - FIXES /api/users/me GET
// ------------------------------------------------------------------
exports.getMe = async (req, res) => {
    // req.user is set by the 'protect' middleware and excludes password
    const user = req.user.toObject();
    // The sessionStatus virtual field is automatically calculated by the User Model
    
    // We also need to send the session data for device management display
    const currentSessionId = req.sessionId; 
    
    const sessions = user.sessions.map(session => ({
        id: session.sessionId,
        loginTime: formatTime(session.loginTime),
        deviceName: session.device,
        location: session.ip,
        isCurrent: session.sessionId === currentSessionId 
    }));
    
    res.status(200).json({ 
        success: true, 
        data: {
            ...user,
            sessions: sessions.sort((a, b) => new Date(b.loginTime) - new Date(a.loginTime))
        } 
    });
};

// ------------------------------------------------------------------
// PUT: Update Me (Protected - Requires password verification) - FIXES /api/users/me PUT
// ------------------------------------------------------------------
exports.updateMe = async (req, res) => {
    const { password, updateFields } = req.body;
    const userId = req.user._id;

    if (!password || !updateFields) {
        return res.status(400).json({ success: false, error: 'Current password and update fields are required.' });
    }

    try {
        // 1. Fetch user including password for verification
        const user = await User.findById(userId).select('+password');
        
        // 2. Verify current password (MANDATORY SECURITY STEP)
        if (!(await user.matchPassword(password))) {
            return res.status(401).json({ success: false, error: 'Incorrect current password.' });
        }
        
        const updates = {};
        let passwordChanged = false;

        // 3. Collect valid fields for update
        if (updateFields.firstName) updates.firstName = updateFields.firstName;
        if (updateFields.lastName) updates.lastName = updateFields.lastName;
        if (updateFields.username) updates.username = updateFields.username;
        if (updateFields.phone) updates.phone = updateFields.phone;
        if (updateFields.email) updates.email = updateFields.email;

        // --- Handle Password Change ---
        if (updateFields.newPassword) {
            if (updateFields.newPassword.length < 6) {
                return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
            }
            user.password = updateFields.newPassword; 
            passwordChanged = true;
        }

        if (passwordChanged) {
            await user.save(); // Triggers the pre('save') hash middleware
        } else if (Object.keys(updates).length > 0) {
            // Update other fields
            await User.findByIdAndUpdate(userId, updates, { 
                new: true, 
                runValidators: true
            });
        } else {
             return res.status(400).json({ success: false, error: 'No valid fields provided for update.' });
        }

        // 4. Send back the updated user profile
        const finalUser = await User.findById(userId).select('-password -__v -resetPasswordToken -resetPasswordExpire -sessions');

        res.status(200).json({ success: true, data: finalUser });

    } catch (error) {
        // Handle common Mongoose errors
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            return res.status(409).json({ success: false, error: `${field.charAt(0).toUpperCase() + field.slice(1)} is already taken.` });
        }
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, error: messages.join(', ') });
        }
        console.error("Update Me Error:", error);
        res.status(500).json({ success: false, error: 'Server error during profile update.' });
    }
};

// ------------------------------------------------------------------
// DELETE: Delete Own User Account - FIXES /api/users/me DELETE
// ------------------------------------------------------------------
exports.deleteMyAccount = async (req, res) => {
    const userId = req.user._id;
    const userEmail = req.user.email;
    
    try {
        // 1. Delete associated data 
        await Promise.all([
            Order.deleteMany({ customerEmail: userEmail }),
            Activity.deleteMany({ userId: userId }),
            ContactMessage.deleteMany({ email: userEmail }),
        ]);

        // 2. Delete User document
        await User.deleteOne({ _id: userId });
        
        // 3. Clear cookies (Assumes cookies are cleared in authController.logout, 
        // but repeating here for direct DELETE operation certainty)
        res.cookie('authToken', 'none', { expires: new Date(Date.now() + 10 * 1000), httpOnly: true, path: '/' });
        res.cookie('loggedIn', 'none', { expires: new Date(Date.now() + 10 * 1000), httpOnly: false, path: '/' }); 

        return res.status(200).json({ 
            success: true, 
            message: `Your account and all related data have been permanently deleted.` 
        });

    } catch (error) {
        console.error("SELF ACCOUNT DELETION FAILED:", error);
        return res.status(500).json({ 
            success: false, 
            error: 'Server error during account deletion.' 
        });
    }
};


// ------------------------------------------------------------------
// GET: Get All Active Sessions (Protected) - FIXES /api/users/sessions GET
// ------------------------------------------------------------------
exports.getSessions = async (req, res) => {
    // Note: req.user contains the full user document, including the sessions array.
    const currentSessionId = req.sessionId; 
    
    // Map sessions, marking the current one
    const sessions = req.user.sessions.map(session => ({
        id: session.sessionId,
        loginTime: formatTime(session.loginTime),
        deviceName: session.device,
        location: session.ip,
        isCurrent: session.sessionId === currentSessionId 
    }));
    
    // Send newest sessions first
    sessions.sort((a, b) => new Date(b.loginTime) - new Date(a.loginTime));

    res.status(200).json({ success: true, count: sessions.length, data: sessions });
};


// ------------------------------------------------------------------
// DELETE: Log Out Specific Session (Protected) - FIXES /api/users/sessions/:sessionId DELETE
// ------------------------------------------------------------------
exports.logoutSpecificSession = async (req, res) => {
    const sessionIdToDelete = req.params.sessionId;
    
    if (sessionIdToDelete === req.sessionId) {
        return res.status(403).json({ success: false, error: 'Cannot log out the current session via this endpoint. Please use the main Log Out button.' });
    }
    
    try {
        const result = await User.updateOne(
            { _id: req.user._id },
            { $pull: { sessions: { sessionId: sessionIdToDelete } } } 
        );
        
        if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, error: 'Session not found for this user.' });
        }

        res.status(200).json({ success: true, message: 'Device logged out successfully.' });
        
    } catch (error) {
        console.error("Logout Specific Session Error:", error);
        res.status(500).json({ success: false, error: 'Server error during session logout.' });
    }
};


// ==================================================================
// --- EXISTING ADMIN/OTHER ENDPOINTS ---
// ==================================================================

// ------------------------------------------------------------------
// GET: Get All Users (Admin Only)
// ------------------------------------------------------------------
exports.getUsers = async (req, res) => {
    try {
        const users = await User.find({ role: { $ne: 'admin' } })
            .select('firstName lastName email lastActivity currentDevice profilePic createdAt')
            .sort({ createdAt: -1 }); 

        const INACTIVE_THRESHOLD_MS = 10 * 60 * 1000;

        const formattedUsers = users.map(user => {
            const lastActivityTime = new Date(user.lastActivity || user.createdAt);
            const timeDifference = new Date() - lastActivityTime;
            let status = (timeDifference < INACTIVE_THRESHOLD_MS) ? 'Active' : 'Inactive';

            return {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                profilePic: user.profilePic,
                currentDevice: user.currentDevice,
                createdAt: user.createdAt,
                lastActivity: formatTime(lastActivityTime), 
                sessionStatus: status,
            };
        });

        res.status(200).json({ success: true, count: formattedUsers.length, data: formattedUsers });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ success: false, error: 'Could not fetch user list.' });
    }
};

// ------------------------------------------------------------------
// GET: Get Single User Details
// ------------------------------------------------------------------
exports.getUserDetails = async (req, res) => {
    try {
        const userId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, error: 'Invalid User ID format.' });
        }

        const user = await User.findById(userId)
            .select('-password -__v -resetPasswordToken -resetPasswordExpire'); 

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        
        const userEmail = user.email;

        // Fetch related data in parallel
        const [orders, feedback, activities, totalOrders, totalFeedback] = await Promise.all([
            Order.find({ customerEmail: userEmail })
                .select('_id totalAmount status createdAt') 
                .sort({ createdAt: -1 })
                .limit(5),
            ContactMessage.find({ email: userEmail }).sort({ createdAt: -1 }).limit(5),
            Activity.find({ userId: userId }).sort({ timestamp: -1 }).limit(30),
            Order.countDocuments({ customerEmail: userEmail }),
            ContactMessage.countDocuments({ email: userEmail })
        ]);

        const INACTIVE_THRESHOLD_MS = 10 * 60 * 1000;
        const lastActivityTime = new Date(user.lastActivity || user.createdAt);
        const timeDifference = new Date() - lastActivityTime;
        let status = (timeDifference < INACTIVE_THRESHOLD_MS) ? 'Active' : 'Inactive';
        
        // Calculate Page Metrics
        const pageMetrics = await Activity.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId), durationMs: { $gt: 0 } } }, 
            { $group: {
                _id: '$pageRoute',
                totalTimeSpentMs: { $sum: '$durationMs' },
                pageViews: { $sum: 1 }
            }},
            { $sort: { totalTimeSpentMs: -1 } } 
        ]);

        const responseData = {
            profile: {
                ...user.toObject(),
                sessionStatus: status, 
                lastActivity: formatTime(lastActivityTime), 
            },
            metrics: {
                totalOrders, 
                totalFeedback,
                topPages: pageMetrics.slice(0, 5).map(m => ({
                    page: m._id,
                    views: m.pageViews,
                    timeSpent: formatDuration(m.totalTimeSpentMs) 
                }))
            },
            logs: {
                orders, 
                feedback,
                activities: activities.map(activity => ({
                    id: activity._id.toString(),
                    description: activity.description,
                    type: activity.type,
                    time: formatTime(activity.timestamp),
                    page: activity.pageRoute || 'N/A', 
                    duration: formatDuration(activity.durationMs) 
                })),
            }
        };

        res.status(200).json({ success: true, data: responseData });

    } catch (error) {
        console.error("Error fetching user details:", error);
        res.status(500).json({ success: false, error: 'Could not fetch user details.' });
    }
};

// ------------------------------------------------------------------
// POST: Track Activity
// ------------------------------------------------------------------
exports.trackActivity = async (req, res) => {
    // Note: req.user should be available here if this route is protected by 'protect'
    const userId = req.user ? req.user._id : null; 
    const { type, pageRoute, durationMs, ip, device } = req.body;

    // Capture details from Request Headers if not provided in body
    const currentIP = ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'N/A';
    const userAgent = device || req.headers['user-agent'] || 'N/A';
    
    if (!userId) {
         // Optionally allow tracking if not logged in, but skip user update
         return res.status(200).json({ success: true, message: 'Activity not logged as user is unauthenticated.' });
    }

    try {
        // Update user's last activity, IP, and device
        await User.findByIdAndUpdate(userId, { 
            lastActivity: Date.now(),
            currentIP: currentIP,
            currentDevice: userAgent,
        });

        // Log the activity
        if (type || pageRoute) {
            await Activity.create({
                userId,
                type: type || 'PAGE_VIEW',
                pageRoute: pageRoute || 'N/A',
                durationMs: durationMs || 0,
                description: type === 'LOGIN' ? 'User logged in' : `Visited ${pageRoute || 'unknown page'}`,
                timestamp: Date.now()
            });
        }
        
        res.status(200).json({ success: true, message: 'Activity logged and user profile updated.' });

    } catch (error) {
        console.error("Tracking Error:", error);
        res.status(500).json({ success: false, error: 'Tracking failed.' });
    }
};

// ------------------------------------------------------------------
// DELETE: Delete User (Admin action)
// ------------------------------------------------------------------
exports.deleteUser = async (req, res) => {
    const userId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, error: 'Invalid User ID format.' });
    }

    try {
        // 1. Find user and get email
        const userToDelete = await User.findById(userId).select('email role');

        if (!userToDelete) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        
        // Prevent admin deletion via this endpoint
        if (userToDelete.role === 'admin') {
            return res.status(403).json({ success: false, error: 'Admin users cannot be deleted via this API.' });
        }

        const userEmail = userToDelete.email;

        // 2. Delete Associated data
        await Promise.all([
            Order.deleteMany({ customerEmail: userEmail }),
            Activity.deleteMany({ userId: userId }),
            ContactMessage.deleteMany({ email: userEmail }),
        ]);

        // 3. Delete User document
        const deleteResult = await User.deleteOne({ _id: userId });

        if (deleteResult.deletedCount === 0) {
            return res.status(500).json({ success: false, error: 'User found but failed to delete the main record.' });
        }

        // 4. Success Response
        return res.status(200).json({ 
            success: true, 
            message: `User ${userEmail} and related data deleted successfully.` 
        });

    } catch (error) {
        console.error("USER DELETION FAILED:", error);
        return res.status(500).json({ 
            success: false, 
            error: 'Server error during user deletion.', 
            details: error.message 
        });
    }
};


// ------------------------------------------------------------------
// POST: Make Any User Admin (Admin Only)
// ------------------------------------------------------------------
exports.makeAdmin = async (req, res) => {
    try {
        // Assumes this route is protected and uses restrictTo('admin')
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Forbidden: Only admins can promote users to admin.' });
        }

        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, error: 'Email is required.' });
        }

        const user = await User.findOneAndUpdate(
            { email: email.trim().toLowerCase() },
            { role: 'admin' },
            { new: true, select: 'firstName lastName email role' }
        );

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found with this email.' });
        }

        res.status(200).json({
            success: true,
            message: `${user.email} is now an ADMIN!`,
            user: {
                id: user._id,
                name: `${user.firstName} ${user.lastName}`,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Make-admin error:', error);
        res.status(500).json({ success: false, error: 'Server error.' });
    }
};