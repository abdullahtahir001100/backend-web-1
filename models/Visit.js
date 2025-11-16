const mongoose = require('mongoose');

// Visit Schema is designed to track user interactions and device data.
const visitSchema = new mongoose.Schema({
    // "Top Performing Pages" ke liye (e.g., "/index", "/blog-post")
    pageUrl: {
        type: String,
        required: true
    },
    // "Visit by Device" ke liye (Mobile, Tablet, Web)
    device: {
        type: String,
        enum: ['Mobile', 'Tablet', 'Web'], // Ensure your frontend sends these exact strings
        required: true
    },
    // "Traffic Source" ke liye (e.g., "Google", "Social Media", "direct")
    source: {
        type: String
    },
    // "Top Session" pie chart ke liye
    browser: {
        type: String, // e.g., "Chrome", "Firefox", "Safari"
    },
    // Tamam data ko date ke hisab se filter karne aur analytics ke liye
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Visit', visitSchema);