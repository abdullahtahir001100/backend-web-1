// 📂 models/ActivityLog.js
const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: { // e.g., 'PAGE_VIEW', 'LOGIN', 'LOGOUT', 'ORDER'
        type: String,
        required: true
    },
    page: { // e.g., '/products', '/checkout', '/dashboard'
        type: String,
        default: 'N/A'
    },
    duration: { // How long the user was on this page (in seconds)
        type: Number,
        default: 0
    },
    description: {
        type: String,
        default: 'User activity tracked.'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);