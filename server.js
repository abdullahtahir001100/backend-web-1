// 1. Important Modules Ko Import Karein
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser'); // <-- CRITICAL: For reading the authToken cookie
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid'); // Utility for generating Session IDs

// Custom files ko import karein
// const connectDB = require('./config/db'); // Apni Database Connection file
const productRoutes = require('./routes/productRoutes');
const contactRoutes = require('./routes/contactRoutes');
const orderRoutes = require('./routes/orderRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const activityRoutes = require('./routes/activityRoutes'); 

// 2. Environment Variables Ko Load Karein
dotenv.config();

// 3. Database Ko Connect Karein
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
app.use(express.json()); // Body parser for application/json
app.use(express.urlencoded({ extended: false })); // Body parser for forms

// CRITICAL: Cookie parser MUST be before CORS and Routes
app.use(cookieParser()); 
app.set('trust proxy', 1); // Required for secure cookies (and getting real IP from proxy)


// --- CORS CONFIGURATION (Now supports all domains for dev) ---
const corsOptions = {
    // Development mein, request bhejne wale origin ko hi echo back karein
    // Kyunki credentials: true ke saath origin: '*' use nahi ho sakta
    origin: "https://website-kappa-woad.vercel.app",
    credentials: true, // Allow cookies to be sent/received
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
// -----------------------------------------------------------



app.use('/api/auth', authRoutes); 
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/v1', dashboardRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/activity', activityRoutes);


// 7. Global Error Handler (Must be last middleware)
app.use((err, req, res, next) => {
    // [Error handling logic omitted for brevity]
    console.error(err.stack);
    res.status(err.statusCode || 500).json({ 
        success: false, 
        error: err.message || 'Server Error' 
    });
});


// 8. Server Ko Start Karein
const PORT = process.env.PORT || 8000;

const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    // Close server & exit process
    server.close(() => process.exit(1));
});
