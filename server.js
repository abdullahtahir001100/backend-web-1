// server.js

// 1. Important Modules Ko Import Karein
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors'); 
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const path = require('path'); // Standard Node.js module

// 2. Custom Mongoose Models Ko **FIRST** Import Karein
// This is the CRITICAL FIX for Vercel crashes related to Mongoose models.
// Importing them here ensures they are registered before any controller/middleware tries to use them.
require('./models/User'); // Loads the User model schema and registers it with Mongoose
require('./models/Activity'); // Loads the Activity model schema and registers it with Mongoose
// Agar aapke paas Order.js aur ContactMessage.js bhi hain, unhe bhi yahan import karein:
// require('./models/Order'); 
// require('./models/ContactMessage'); 


// 3. Custom Utility and Route Files Ko Import Karein
const connectDB = require('./config/db'); // Apni Database Connection file
const productRoutes = require('./routes/productRoutes'); 
const contactRoutes = require('./routes/contactRoutes'); 
const orderRoutes = require('./routes/orderRoutes'); 
const dashboardRoutes = require('./routes/dashboardRoutes'); 
// NOTE: I am using 'authAndUserRoutes' as per your original error context, 
// though your provided snippet used 'auth'. I'll stick to the original error-causing name.
const authAndUserRoutes = require('./routes/auth'); 


// 4. Environment Variables Ko Load Karein
dotenv.config(); // ⭐ Yeh hamesha Mongoose connection se pehle aana chahiye


// 5. Database Ko Connect Karein
// NOTE: Assuming your actual connectDB() function handles the Mongoose connection.
// Agar aapke paas connectDB.js file nahi hai, neeche wala block use karein.
// connectDB(); // Use your original connectDB() function
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


// 6. Express App Ko Initialize Karein
const app = express();


// 7. Middlewares Ko Configure Karein
app.use(cookieParser());
app.set('trust proxy', 1); // Vercel and other cloud platforms ke liye zaruri

app.use(cors({
    origin: "*", // Production mein specific domain use karein
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Set-Cookie'],
}));

// Body Parser: Incoming request bodies ko JSON format mein parse karne ke liye
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


// **Static Files ko Serve karein (Agar aap frontend isi server se serve kar rahe hain)**
app.use(express.static(path.join(__dirname, 'public')));


// 8. Routes Ko Link Karein
app.get('/', (req, res) => {
    res.send('API is running successfully!');
});

// Existing Core Routes
app.use('/api/products', productRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/orders', orderRoutes);

// Existing Dashboard Analytics Route
app.use('/api/v1', dashboardRoutes); 

// ⭐ Authentication and User Routes (The previously error-causing route)
app.use('/api', authAndUserRoutes);


// 9. Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: 'Something broke! Server Error.' });
});


// 10. Start Server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});


// 11. Handle Unhandled Rejections
process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    // Close server & exit process
    server.close(() => process.exit(1));
});