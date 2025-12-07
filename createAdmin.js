// createAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); // adjust path if needed

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const hashed = await bcrypt.hash('password123', 10);

    const admin = await User.findOneAndUpdate(
      { email: 'admin@yourapp.com' },
      {
        firstName: 'Super',
        lastName: 'Admin',
        username: 'superadmin',
        email: 'admin@yourapp.com',
        phone: '+923001234567',
        password: hashed,
        role: 'admin',
        profilePic: '/images/default_avatar.png'
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('Admin created/updated:');
    console.log('→ Email:', admin.email);
    console.log('→ Password: password123');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

createAdmin();