const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true }, // Plain text password
    role: { type: String, default: 'admin' }
}, { timestamps: true });

// Models ko export karte waqt check karein
module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
