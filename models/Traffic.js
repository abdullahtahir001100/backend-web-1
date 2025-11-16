const mongoose = require('mongoose');

// Traffic Schema
const trafficSchema = new mongoose.Schema({
    // Page URL jo user visit kar raha hai (Top Pages ke liye)
    pageUrl: {
        type: String,
        required: true
    },
    // User ka device type (Device Visits ke liye)
    device: {
        type: String,
        enum: ['Mobile', 'Tablet', 'Web'], 
        required: true
    },
    // Traffic ka source 
    source: { 
        type: String 
    },
    // Browser name
    browser: {
        type: String, 
    },
    // Kab visit hui
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Model ko export karne ka sahi tareeka
module.exports = mongoose.model('Traffic', trafficSchema);