// 📂 models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid'); // Required for unique session IDs

const UserSchema = new mongoose.Schema({
    // Core Identity Fields
    firstName: { type: String, required: [true, 'First name is required'] },
    lastName: { type: String },
    username: { 
        type: String, 
        required: [true, 'Username is required'], 
        unique: true, 
        lowercase: true,
        trim: true,
        match: [/^[a-zA-Z0-9]+$/, 'Username must be alphanumeric']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Please use a valid email']
    },
    phone: { type: String },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6,
        select: false // Always exclude password when querying
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },

    // Session and Tracking Fields
    createdAt: { type: Date, default: Date.now },
    lastActivity: { type: Date, default: Date.now },
    currentDevice: { type: String, default: 'N/A' },
    currentIP: { type: String, default: 'N/A' },
    profilePic: { type: String, default: '/images/default_avatar.png' },

    // Device Management Array (Sessions)
    // Stores active login sessions for remote logout/device management
    sessions: [{
        sessionId: { type: String, default: uuidv4, required: true },
        loginTime: { type: Date, default: Date.now },
        device: { type: String, required: true }, // User-Agent string
        ip: { type: String, required: true },
    }],

    // Password Reset Fields (standard practice for password reset flow)
    resetPasswordToken: String,
    resetPasswordExpire: Date,

}, {
    // Schema Options: Allows virtual properties to be included in JSON/Object output
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// ----------------------------------------------------------------------
// --- Mongoose Middleware ---
// ----------------------------------------------------------------------

/**
 * Pre-save hook: Encrypt password using bcrypt before saving to the database,
 * but only if the password field has been modified (or is new).
 */
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next(); // Skip hashing if password wasn't changed
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// ----------------------------------------------------------------------
// --- Instance Methods ---
// ----------------------------------------------------------------------

/**
 * Method: Compares the plain text password provided during login with the hashed
 * password stored in the database.
 * @param {string} enteredPassword - The password submitted by the user.
 * @returns {Promise<boolean>} - True if passwords match.
 */
UserSchema.methods.matchPassword = async function(enteredPassword) {
    // Note: this.password is available here because we explicitly 'select' it during login
    return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * Method: Generates a JSON Web Token (JWT) containing the user ID and the current session ID.
 * @param {string} sessionId - The unique ID for the current login session.
 * @returns {string} - The signed JWT token.
 */
UserSchema.methods.getSignedToken = function(sessionId) {
    // Token payload includes user ID (for finding user) and sessionId (for session validation/logout)
    return jwt.sign({ id: this._id, sessionId: sessionId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE // JWT_EXPIRE defined in .env (e.g., '30d')
    });
};

module.exports = mongoose.model('User', UserSchema);