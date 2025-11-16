// backend/routes/productRoutes.js

const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { uploadToCloudinary } = require('../config/cloudinary');
// NOTE: Agar aapko authentication check karna hai, toh yahan ek middleware add karein

// --- POST /api/products --- (Naya product banayein)
router.post('/', async (req, res) => {
    try {
        const {
            title, artist, price, priceRange, dimensions, size, category,
            medium, style, subject, orientation, country, palette, mainImage,
            smallImages, description, artistBio
        } = req.body;

        // Base64/Data URL ko Cloudinary par upload karein
        const mainImageUrl = await uploadToCloudinary(mainImage);
        if (!mainImageUrl) {
            return res.status(400).json({ msg: 'Main image upload failed' });
        }

        // Small images ko parallel mein upload karein
        const uploadedSmallImages = await Promise.all(
            smallImages.map(imgStr => uploadToCloudinary(imgStr))
        );

        const newProduct = new Product({
            title, artist, price, priceRange, dimensions, size, category,
            medium, style, subject, orientation, country, palette, description, artistBio,
            mainImage: mainImageUrl, // Ab sirf Cloudinary URL save hoga
            smallImages: uploadedSmallImages.filter(url => url !== null), // Ab sirf Cloudinary URLs save honge
        });

        const savedProduct = await newProduct.save();
        res.status(201).json(savedProduct);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- PUT /api/products/:id --- (Product update - MODIFIED FOR BASE64 REMOVAL)
router.put('/:id', async (req, res) => {
    try {
        const productData = req.body;

        // 1. MAIN IMAGE ko handle karein: Agar mainImage Base64 string hai, toh upload karein.
        if (productData.mainImage) {
            // uploadToCloudinary Base64 string ko URL mein convert karta hai.
            // Agar pehle se URL hai ('http' se start), toh wapas wahi URL bhej deta hai (Crucial for edit)
            const mainImageUrl = await uploadToCloudinary(productData.mainImage);
            productData.mainImage = mainImageUrl; // Cloudinary URL se replace karein
        }
        
        // 2. SMALL IMAGES ko handle karein: Agar smallImages mein Base64 strings hain, toh upload karein.
        if (productData.smallImages && Array.isArray(productData.smallImages)) {
            const uploadedSmallImages = await Promise.all(
                productData.smallImages.map(imgStr => uploadToCloudinary(imgStr))
            );
            // Uploaded URLs ko filter karke array se replace karein
            productData.smallImages = uploadedSmallImages.filter(url => url !== null);
        }

        // Ab productData mein sirf Cloudinary URLs hain, Base64 nahi.
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            { $set: productData },
            { new: true, runValidators: true } // runValidators se Schema Guardrail check hoga
        );

        if (!updatedProduct) {
            return res.status(404).json({ msg: 'Product not found' });
        }

        res.json(updatedProduct);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


// ⭐ NEW ENDPOINT: GET /api/products/top-selling
router.get('/top-selling', async (req, res) => {
    try {
        const products = await Product.find()
            .sort({ click_count: -1, createdAt: -1 })
            .limit(9); 
        res.json(products);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


// ⭐ MODIFIED: GET /api/products
router.get('/', async (req, res) => {
    try {
        const products = await Product.find().sort({ click_count: -1, createdAt: -1 }); 
        res.json(products);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


// ⭐ MODIFIED: GET /api/products/:id
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { $inc: { click_count: 1 } },
            { new: true } 
        );

        if (!product) {
            return res.status(404).json({ msg: 'Product not found' });
        }
        res.json(product);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Product not found' });
        }
        res.status(500).send('Server Error');
    }
});


// ⭐ FIXED: DELETE /api/products/:id --- (Product delete)
router.delete('/:id', async (req, res) => {
    try {
        // Product ko ID se find karke delete karein
        const product = await Product.findByIdAndDelete(req.params.id); 

        if (!product) {
            // Agar product nahi mila
            return res.status(404).json({ msg: 'Product not found' });
        }
        
        // Success response
        res.json({ msg: 'Product removed successfully' });

    } catch (err) {
        console.error(err.message);
        // Invalid ObjectId error ko handle karein
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Product not found' });
        }
        res.status(500).send('Server Error');
    }
});


module.exports = router;