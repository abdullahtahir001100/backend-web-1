
// 1. Important Modules Ko Import Karein
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors'); 

// Custom files ko import karein
const connectDB = require('./config/db'); // Apni Database Connection file
const productRoutes = require('./routes/productRoutes'); // Assuming this file exists
const contactRoutes = require('./routes/contactRoutes'); // Assuming this file exists
const orderRoutes = require('./routes/orderRoutes'); // Assuming this file exists
const authAndUserRoutes = require('./routes/authAndUserRoutes');
// **NEW: Dashboard Routes ko import karein**
const dashboardRoutes = require('./routes/dashboardRoutes'); 

// 2. Environment Variables Ko Load Karein
dotenv.config();

// 3. Database Ko Connect Karein
connectDB(); 

// 4. Express App Ko Initialize Karein
const app = express();

// **Static Files ko Serve karein (Agar aap frontend isi server se serve kar rahe hain)**
app.use(express.static('public'));

// 5. Middlewares Ko Configure Karein
app.use(cors()); 
// Body Parser: Incoming request bodies ko JSON format mein parse karne ke liye
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 6. Root Route (Testing)
app.get('/', (req, res) => {
    res.send('API is running successfully!');
});

// 7. Routes Ko Link Karein (Crucial for routing)
app.use('/api/products', productRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/orders', orderRoutes);

// **NEW: Dashboard Analytics Route ko Link Karein**
app.use('/api/v1', dashboardRoutes); 
app.use('/api', authAndUserRoutes);
// 8. Server Ko Start Karein
const PORT = process.env.PORT || 5000; 

app.listen(PORT, () =>
    console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
);