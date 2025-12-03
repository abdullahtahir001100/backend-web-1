const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    // Reference to the product being reviewed
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, 'Review must belong to a product.'],
        ref: 'Product', // Assumes your product data is in a 'products' collection
    },
    // Reviewer information
    name: {
        type: String,
        required: [true, 'A reviewer name is required.'],
        trim: true,
        maxlength: 50
    },
    // The actual review text
    review: {
        type: String,
        required: [true, 'Review content cannot be empty.'],
        trim: true,
    },
    // The rating (1 to 5 stars)
    rating: {
        type: Number,
        min: 1,
        max: 5,
        required: [true, 'A rating is required.'],
    },
    // Timestamp for sorting/display
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

// Index to quickly fetch reviews by product
reviewSchema.index({ productId: 1 });

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;