// 📂 models/Activity.js (Crucial Modification)

const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        // ⭐ CRITICAL FIX: Set required to false to allow logs from unauthenticated users (userId = null)
        required: false 
    },
    type: {
        type: String,
        required: true
    },
    // ... other fields
    pageRoute: { 
        type: String,
        default: 'N/A'
    },
    durationMs: {
        type: Number,
        default: 0
    },
    description: {
        type: String,
        default: 'User activity tracked.'
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Activity', ActivitySchema);