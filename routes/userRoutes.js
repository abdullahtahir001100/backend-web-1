const express = require('express');
const router = express.Router();

// Import controller functions
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

// Import auth middleware (assuming you have 'protect' and 'restrictTo' defined)
// NOTE: Assuming the file is named authMiddleware.js
const { protect, restrictTo } = require('../middleware/authMiddleware'); 

// =========================================================
// USER-SPECIFIC PROTECTED ROUTES
// =========================================================

// Protected routes for current user (/me)
router.route('/me')
  .get(protect, getMe)        // GET /api/users/me - Get current user profile
  .put(protect, updateMe)     // PUT /api/users/me - Update current user profile
  .delete(protect, deleteMyAccount); // DELETE /api/users/me - Delete own account

// Sessions management
router.get('/sessions', protect, getSessions); // GET /api/users/sessions - Get all sessions
router.delete('/sessions/:sessionId', protect, logoutSpecificSession); // DELETE /api/users/sessions/:sessionId - Logout specific session

// Activity tracking
router.post('/activity', protect, trackActivity); // POST /api/users/activity - Track activity

// =========================================================
// ADMIN-ONLY ROUTES
// =========================================================

/**
 * The next router.use() line applies both 'protect' and 'restrictTo('admin')' 
 * middleware to ALL subsequent routes defined in this router file.
 * The restrictTo function takes 'admin' as an argument and returns the 
 * actual middleware function, which is the correct pattern.
 */
router.use(protect, restrictTo('admin')); // All below require admin role

router.get('/', getUsers); // GET /api/users - Get all users (admin)
router.get('/:id', getUserDetails); // GET /api/users/:id - Get single user details (admin)
router.delete('/:id', deleteUser); // DELETE /api/users/:id - Delete user (admin)
router.post('/make-admin', makeAdmin); // POST /api/users/make-admin - Make user admin (admin)

module.exports = router;