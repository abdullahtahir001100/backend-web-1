// server.js

// 1. Important Modules Ko Import Karein
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors'); 
const cookieParser = require('cookie-parser'); // <-- CRITICAL: For reading the authToken cookie
const mongoose = require('mongoose');

// Custom files ko import karein
const connectDB = require('./config/db'); // Apni Database Connection file
const productRoutes = require('./routes/productRoutes'); 
const contactRoutes = require('./routes/contactRoutes'); 
const orderRoutes = require('./routes/orderRoutes'); 
const dashboardRoutes = require('./routes/dashboardRoutes'); 
const authAndUserRoutes = require('./routes/authAndUserRoutes'); // NEW: Combined auth and user routes

// 2. Environment Variables Ko Load Karein
dotenv.config();

// 3. Database Ko Connect Karein
// NOTE: Since you did not provide config/db.js, I will use a simple connection here.
// You must ensure your actual connectDB() function connects to the MONGO_URI in .env.
const connectDB_simple = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};
connectDB_simple();

// 4. Express App Ko Initialize Karein
const app = express();

// **Static Files ko Serve karein**
app.use(express.static('public'));

// 5. Middlewares Ko Configure Karein
app.use(cookieParser()); // Use cookie parser BEFORE routes
app.set('trust proxy', 1); // CRITICAL: Required for secure cookies (and getting real IP if behind proxy)

app.use(cors({
    // Allow your development origins (FE: 5500, BE: 5000)
    origin: ["http://localhost:5500", "http://127.0.0.1:5501", "http://localhost:3000"],
    credentials: true, // CRITICAL: Allows cookies to be sent/received
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Set-Cookie']
}));

// Body Parser: Incoming request bodies ko JSON format mein parse karne ke liye
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

// ⭐ Core Authentication and User Routes
app.use('/api', authAndUserRoutes); // This mounts auth and user routes under /api

// 8. Error Handling Middleware (Recommended last middleware)
app.use((err, req, res, next) => {
    console.error('Error details:', err);
    res.status(500).json({ success: false, error: 'Something broke!', details: err.message });
});


// 9. Start Server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    // Close server & exit process
    server.close(() => process.exit(1));
});