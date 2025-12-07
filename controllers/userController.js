const User = require('../models/User');
// Assume these models exist and are correctly defined
const Order = require('../models/Order'); 
const ContactMessage = require('../models/ContactMessage'); 
const Activity = require('../models/Activity'); 
const mongoose = require('mongoose');

// --- IMPORTANT: CLOUDINARY IMPORT ---
// 🔑 You must adjust the path if your cloudinary utility file is elsewhere
const { uploadToCloudinary } = require('../config/cloudinary'); 

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

/**
 * Converts a Multer file buffer into a Base64 Data URI string for Cloudinary.
 * @param {object} file - The file object from req.file (must have buffer and mimetype).
 * @returns {string|null} - Base64 Data URI string.
 */
const bufferToDataUri = (file) => {
    if (!file || !file.buffer || !file.mimetype) return null;
    // req.file.mimetype will give you 'image/jpeg', 'image/png', etc.
    return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
};


// ==================================================================
// --- PROTECTED USER-SPECIFIC ENDPOINTS ---
// ==================================================================

// ------------------------------------------------------------------
// GET: Get Me (Protected)
// ------------------------------------------------------------------
exports.getMe = async (req, res) => {
    // req.user is set by the 'protect' middleware and excludes password
    const user = req.user.toObject();
    
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
// PUT: Update Me (Protected - Requires password verification)
// ------------------------------------------------------------------
exports.updateMe = async (req, res) => {
    // Note: req.body contains text fields (password, updateFields)
    // req.file contains the uploaded image data (if Multer ran)
    const { password, updateFields } = req.body;
    const userId = req.user._id;

    if (!password) { 
        return res.status(400).json({ success: false, error: 'Current password is required.' });
    }

    try {
        // 1. Fetch user including password for verification
        let user = await User.findById(userId).select('+password');
        
        // 2. Verify current password (MANDATORY SECURITY STEP)
        if (!(await user.matchPassword(password))) {
            return res.status(401).json({ success: false, error: 'Incorrect current password.' });
        }
        
        const updates = {};
        let passwordChanged = false;

        // --- Handle File Upload (CLOUDinary LOGIC) ---
        if (req.file) {
            console.log("Uploading new profile picture to Cloudinary...");
            // 1. Convert Buffer to Data URI
            const dataUri = bufferToDataUri(req.file);
            
            // 2. Call the Cloudinary utility function
            const photoUrl = await uploadToCloudinary(dataUri); 
            
            if (photoUrl) {
                // 3. Save the resulting URL.
                updates.profilePic = photoUrl; // Assuming your model field is profilePic
            } else {
                 // Throwing an error will be caught by the outer catch block
                 throw new Error('Image upload failed. Cloudinary returned no URL.');
            }
        }
        // --- End of CLOUDINARY LOGIC ---

        // --- Handle JSON Field Updates ---
        if (updateFields) {
            const fields = JSON.parse(updateFields); // Assuming updateFields is a JSON string
            
            if (fields.firstName) updates.firstName = fields.firstName;
            if (fields.lastName) updates.lastName = fields.lastName;
            if (fields.username) updates.username = fields.username;
            if (fields.phone) updates.phone = fields.phone;
            if (fields.email) updates.email = fields.email;

            // Handle Password Change
            if (fields.newPassword) {
                if (fields.newPassword.length < 6) {
                    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
                }
                user.password = fields.newPassword; 
                passwordChanged = true;
            }
        }
        // --- End of JSON Field Updates ---


        // 3. Perform the database update/save
        if (passwordChanged) {
            // If password changed, save the user object to trigger pre('save') hash
            await user.save(); 
            // Invalidate all other sessions (optional but good practice)
            user.sessions = user.sessions.filter(session => session.sessionId === req.sessionId);
            await user.save();
        } 
        
        if (Object.keys(updates).length > 0) {
            // Update other fields (including profilePicUrl if uploaded)
            const updatedUser = await User.findByIdAndUpdate(userId, updates, { 
                new: true, 
                runValidators: true
            });
            // Ensure the local 'user' variable is the most recent version
            if (updatedUser) user = updatedUser; 
        } 
        
        if (!passwordChanged && Object.keys(updates).length === 0) {
            // If no fields were provided/changed
            return res.status(400).json({ success: false, error: 'No valid fields or file provided for update.' });
        }


        // 4. Send back the updated user profile (excluding sensitive fields)
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
        // Check for specific Cloudinary upload failure
        const isCloudinaryError = error.message.includes('Cloudinary upload failed');
        res.status(isCloudinaryError ? 502 : 500).json({ success: false, error: isCloudinaryError ? error.message : 'Server error during profile update.' });
    }
};

// ------------------------------------------------------------------
// DELETE: Delete Own User Account - REMOVES JWT TOKEN COOKIE & CLEARS LOCAL STORAGE STATUS
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
        
        // 3. Clear cookies (CRITICAL: Removes the JWT cookie, effectively logging out)
        // These cookies are set to expire immediately (10 seconds)
        res.cookie('authToken', 'none', { 
            expires: new Date(Date.now() + 10 * 1000), 
            httpOnly: false, // Secure JWT cookie (should be true for better security but client might need to access it)
            path: '/' 
        });
        res.cookie('loggedIn', 'none', { 
            expires: new Date(Date.now() + 10 * 1000), 
            httpOnly: false, // Client-readable status cookie
            path: '/' 
        }); 

        // 4. Success Response
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
// GET: Get All Active Sessions (Protected)
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
// DELETE: Log Out Specific Session (Protected) - Clears server-side session
// ------------------------------------------------------------------
exports.logoutSpecificSession = async (req, res) => {
    const sessionIdToDelete = req.params.sessionId;
    
    // Security check: Prevent logging out the current session this way
    if (sessionIdToDelete === req.sessionId) {
        return res.status(403).json({ success: false, error: 'Cannot log out the current session via this endpoint. Please use the main Log Out button.' });
    }
    
    try {
        // Use $pull to remove the session object matching the sessionId from the array
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