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
    sessions: [{
        sessionId: { type: String, default: uuidv4, required: true },
        loginTime: { type: Date, default: Date.now },
        device: { type: String, required: true }, // User-Agent string
        ip: { type: String, required: true },
    }],

    // Password Reset Fields
    resetPasswordToken: String,
    resetPasswordExpire: Date,

}, {
    // Schema Options
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Middleware: Encrypt password using bcrypt before saving
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Method: Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Method: Get signed JWT for user
UserSchema.methods.getSignedToken = function(sessionId) {
    // Token now includes both user ID and the specific sessionId
    return jwt.sign({ id: this._id, sessionId: sessionId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    });
};

module.exports = mongoose.model('User', UserSchema);