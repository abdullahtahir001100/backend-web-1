const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Admin identity (email) is required'],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, 'Access hash (password) is required'],
        minlength: 8
    },
    role: {
        type: String,
        enum: ['admin', 'developer', 'user'],
        default: 'admin' // Aapki professional identity ke mutabiq default admin rakha hai
    },
    resetPasswordOTP: String,
    resetPasswordExpires: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { 
    timestamps: true // Yeh automatic createdAt aur updatedAt manage karega
});

// --- Password Hashing Middleware ---
// Save hone se pehle password ko encrypt karne ke liye
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// --- Password Verification Method ---
// Login ke waqt password check karne ke liye helper function
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
