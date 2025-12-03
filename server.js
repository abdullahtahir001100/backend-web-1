// server.js

// 1. Important Modules Ko Import Karein
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors'); 
const mongoose = require('mongoose'); // Add mongoose explicitly for the fix
const cookieParser = require('cookie-parser'); // Add cookie-parser for auth

// ⭐ CRITICAL FIX: Load ALL Mongoose Model Schemas HERE
// This ensures Mongoose registers them before any controller/route tries to use them.
require('./models/User'); 
require('./models/Activity'); 
// Agar aapke paas Order.js aur ContactMessage.js bhi hain, unhe bhi yahan import karein:
// require('./models/Order'); 
// require('./models/ContactMessage'); 

// Custom files ko import karein
const connectDB = require('./config/db'); 
const productRoutes = require('./routes/productRoutes'); 
const contactRoutes = require('./routes/contactRoutes'); 
const orderRoutes = require('./routes/orderRoutes'); 
const dashboardRoutes = require('./routes/dashboardRoutes'); 



// 2. Environment Variables Ko Load Karein
dotenv.config();

// 3. Database Ko Connect Karein
// Yeh hamesha model imports aur route imports ke beech mein aana chahiye
connectDB(); 

// 4. Express App Ko Initialize Karein
const app = express();

// **Static Files ko Serve karein**
app.use(express.static('public'));

// 5. Middlewares Ko Configure Karein
app.use(cookieParser()); // Use cookie parser BEFORE routes
app.set('trust proxy', 1); // CRITICAL: Required for secure cookies on Vercel

app.use(cors({
    origin: "*", // Production mein specific domain use karein
    credentials: true, // CRITICAL: Allows cookies to be sent/received
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Set-Cookie']
}));

// Body Parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 6. Root Route (Testing)
app.get('/', (req, res) => {
    res.send('API is running successfully!');
});

// 7. Routes Ko Link Karein
app.use('/api/products', productRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/v1', dashboardRoutes); 

// ⭐ Authentication and User Routes
// app.use('/api', authAndUserRoutes);


// 8. Server Ko Start Karein
const PORT = process.env.PORT || 5000; 
const server = app.listen(PORT, () =>
    console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
);

// 9. Handle Unhandled Rejections
process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    // Close server & exit process
    server.close(() => process.exit(1));
});