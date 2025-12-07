const express = require('express');
const router = express.Router();
const multer = require('multer');

// Import controller functions from userController.js
const {
    getMe,
    updateMe,
    deleteMyAccount,
    getSessions,
    logoutSpecificSession,
    getUsers,
    getUserDetails,
    trackActivity,
    deleteUser,
    makeAdmin
} = require('../controllers/userController');


// Import authentication middleware (protect for login check, restrictTo for role check)
const { protect, restrictTo } = require('../middleware/authMiddleware'); // Assumes authController's functions are available via authMiddleware

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});
// ==================================================================
// --- PROTECTED USER-SPECIFIC ENDPOINTS (/api/users/me) ---
// ==================================================================

router.route('/me')
    // GET /api/users/me: Get current user profile and session details (Protected)
    .get(protect, getMe) 
    // PUT /api/users/me: Update current user profile (Requires password verification)
   .put(protect, upload.single('profile_image'), updateMe)
    // DELETE /api/users/me: Permanently delete own account and associated data
    .delete(protect, deleteMyAccount); 


// ==================================================================
// --- SESSION MANAGEMENT ENDPOINTS ---
// ==================================================================

// GET /api/users/sessions: Get a list of all active sessions for the current user
router.get('/sessions', protect, getSessions); 

// DELETE /api/users/sessions/:sessionId: Log out a specific remote session by ID
router.delete('/sessions/:sessionId', protect, logoutSpecificSession); 


// ==================================================================
// --- ACTIVITY TRACKING ENDPOINTS ---
// ==================================================================

// POST /api/users/activity: Log user activity and update lastActivity/device fields
router.post('/activity', protect, trackActivity); 


// ==================================================================
// --- ADMIN-ONLY ENDPOINTS ---
// ==================================================================

// All routes below this point must pass the `protect` and `restrictTo('admin')` middleware
router.use(protect, restrictTo('admin')); 

// GET /api/users: Get a list of all non-admin users
router.get('/', getUsers); 

// GET /api/users/:id: Get full details (orders, logs, metrics) for a single user
router.get('/:id', getUserDetails); 

// DELETE /api/users/:id: Delete a user and all related data (Admin action)
router.delete('/:id', deleteUser); 

// POST /api/users/make-admin: Promote a user to admin role by email
router.post('/make-admin', makeAdmin); 

module.exports = router;