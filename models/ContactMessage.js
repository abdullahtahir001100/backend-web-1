// ArtDashboard/backend/models/ContactMessage.js

const mongoose = require('mongoose');

const contactMessageSchema = new mongoose.Schema({
    // Form field: <input type="text" id="first-name">
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    // Form field: <input type="text" id="last-name">
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    // Form field: <input type="email" id="email">
    email: {
        type: String,
        required: true,
        // ایک سادہ email validation شامل کر سکتے ہیں (Optional)
        match: [/.+@.+\..+/, 'Please fill a valid email address'] 
    },
    // Form field: <input type="tel" id="contact-details">
    contactDetails: {
        type: String,
        required: true,
        trim: true
    },
    // Form field: <textarea id="message">
    message: {
        type: String,
        required: true
    },
    // یہ میسج کی تاریخ اور وقت کو محفوظ کرے گا
    createdAt: {
        type: Date,
        default: Date.now
    },
    // ایڈمن ڈیش بورڈ کے لیے: یہ دیکھنے کے لیے کہ آیا میسج پڑھا گیا ہے
    isRead: {
        type: Boolean,
        default: false
    }
});

const ContactMessage = mongoose.model('ContactMessage', contactMessageSchema);

module.exports = ContactMessage;