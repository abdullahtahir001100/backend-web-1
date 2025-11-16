// backend/models/Product.js

const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
    {
        // CORE FIELDS (Aapke purane schema ke anusaar)
        title: { type: String, required: true },
        artist: { type: String, required: true },
        price: { type: Number, required: true },

        // FILTER/FORM FIELDS
        priceRange: { type: String },
        dimensions: { type: String },
        size: { type: String },
        category: { type: String },
        medium: { type: String },
        style: { type: String },
        subject: { type: String },
        orientation: { type: String },
        country: { type: [String] },
        palette: { type: [String] }, 

        // IMAGE/DESCRIPTION FIELDS
        mainImage: { type: String }, 
        smallImages: { type: [String] }, 
        description: { type: String },
        artistBio: { type: String },
        
        // ⭐ NAYA FIELD: Click count
        click_count: { 
            type: Number, 
            default: 0 // Shuru mein 0 clicks
        },
    },
    {
        timestamps: true // Adds createdAt and updatedAt
    }
);

module.exports = mongoose.model('Product', ProductSchema);