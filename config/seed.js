const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db'); // Aapka existing db config
const User = require('./models/User'); 
require('dotenv').config();

const seedAdmin = async () => {
    try {
        // Step 1: Connect to Database using your config
        await connectDB();
        console.log("DATABASE_CONNECTED: INITIALIZING_ADMIN_PROVISIONING");

        // Step 2: Define Admin Identity
        const adminEmail = "abdullahtahi001@gmail.com";
        const adminPassword = "pak123456"; // Temporary default password

        // Step 3: Check if user already exists
        const existingUser = await User.findOne({ email: adminEmail });
        if (existingUser) {
            console.log("IDENTITY_EXISTS: Admin is already in the system.");
            process.exit();
        }

        // Step 4: Create Admin User
        // Note: Password hashing User model ke pre-save middleware mein handle hogi
        const admin = new User({
            username: "abdullahtahir",
            email: adminEmail,
            password: adminPassword,
            role: "admin"
        });

        await admin.save();

        console.log("------------------------------------------");
        console.log("SUCCESS: ADMIN_IDENTITY_ESTABLISHED");
        console.log(`IDENTITY: ${adminEmail}`);
        console.log(`HASH_KEY: ${adminPassword}`);
        console.log("------------------------------------------");
        
        process.exit();
    } catch (err) {
        console.error("PROVISIONING_FAILED:", err.message);
        process.exit(1);
    }
};

seedAdmin();
