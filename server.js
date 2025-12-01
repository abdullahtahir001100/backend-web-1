// server.js

// 1. Important Modules Ko Import Karein
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors'); 

// Custom files ko import karein
const connectDB = require('./config/db'); 
const productRoutes = require('./routes/productRoutes'); 
const contactRoutes = require('./routes/contactRoutes'); 
const orderRoutes = require('./routes/orderRoutes'); 
const dashboardRoutes = require('./routes/dashboardRoutes'); 
const authAndUserRoutes = require('./routes/authAndUserRoutes');

// 2. Environment Variables Ko Load Karein
dotenv.config();

// 3. Database Ko Connect Karein
connectDB(); 

// 4. Express App Ko Initialize Karein
const app = express();

// Static Files ko Serve karein 
app.use(express.static('public'));

// ---# 5. Middleware Configuration

// 🌟 CORRECTED CORS CONFIGURATION START 🌟
const allowedOrigins = [
    'http://localhost:5500', 
    'http://127.0.0.1:5501', // Your local development origin
    'http://localhost:3000',
    // PRODUCTION: Add your Vercel/live frontend URL(s) here (e.g., 'https://your-frontend.com')
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or same-origin requests)
        if (!origin) return callback(null, true); 
        
        // Check if the requesting origin is in the allowed list
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allow all necessary methods, including OPTIONS for preflight
    credentials: true, // CRITICAL: Allows cookies/Authorization headers to be sent/received
    allowedHeaders: ['Content-Type', 'Authorization'], // Specify headers used by your client
    exposedHeaders: ['Set-Cookie'] // Explicitly expose headers you want the client to read
}));
// 🌟 CORRECTED CORS CONFIGURATION END 🌟

// Body Parser: Incoming request bodies ko JSON format mein parse karne ke liye
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ---## 6. Route Setup

// Root Route (Testing)
app.get('/', (req, res) => {
    res.send('API is running successfully!');
});

// Existing Core Routes
app.use('/api/products', productRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/orders', orderRoutes);

// Dashboard Analytics Route 
app.use('/api/v1', dashboardRoutes); 

// Authentication and User Routes
app.use('/api', authAndUserRoutes);

// ---## 7. Server Start

const PORT = process.env.PORT || 5000; 

app.listen(PORT, () =>
    console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
);