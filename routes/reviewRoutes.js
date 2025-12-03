const express = require('express');
const Review = require('../models/reviewModel'); // Assuming correct path to Mongoose model
const mongoose = require('mongoose');

const router = express.Router();

// ------------------------------------------------------------------
// 1. GET Reviews - Reads all reviews for a specific product
// ------------------------------------------------------------------
// @desc    Get all reviews for a specific product
// @route   GET /api/reviews?productId=<id>
router.get('/', async (req, res) => {
    try {
        // Read productId from query parameters (e.g., req.query.productId)
        const productId = req.query.productId; 

        if (!productId) {
            return res.status(400).json({ success: false, message: 'Missing Product ID query parameter.' });
        }

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid Product ID format.' });
        }

        // Find reviews and sort by newest first
        const reviews = await Review.find({ productId: productId }).sort({ createdAt: -1 });

        // Calculate average rating
        const totalReviews = reviews.length;
        const averageRating = totalReviews > 0 
            ? (reviews.reduce((acc, review) => acc + review.rating, 0) / totalReviews).toFixed(1)
            : 0;

        res.status(200).json({
            success: true,
            total: totalReviews,
            averageRating: parseFloat(averageRating),
            data: reviews,
        });
    } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).json({ success: false, message: 'Server error while fetching reviews.' });
    }
});

// ------------------------------------------------------------------
// 2. POST Review - Creates a new review
// ------------------------------------------------------------------
// @desc    Submit a new review for a product
// @route   POST /api/reviews
router.post('/', async (req, res) => {
    try {
        // Expects { productId, name, review, rating, userId (optional/recommended) } in the request body
        const { productId, name, review, rating, userId } = req.body; // Added userId handling
        
        // Basic validation
        if (!productId || !name || !review || !rating) {
            return res.status(400).json({ success: false, message: 'Missing required fields: productId, name, review, and rating.' });
        }
        
        const numericRating = parseInt(rating);
        if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
            return res.status(400).json({ success: false, message: 'Rating must be a number between 1 and 5.' });
        }

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid Product ID format.' });
        }

        const newReview = await Review.create({
            productId,
            name,
            review,
            rating: numericRating,
            userId: userId || null, // Save the userId from the front-end for later verification
        });

        res.status(201).json({
            success: true,
            message: 'Review submitted successfully!',
            data: newReview,
        });
    } catch (error) {
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join(', ') });
        }
        console.error("Error submitting review:", error);
        res.status(500).json({ success: false, message: 'Server error while submitting review.' });
    }
});

// ------------------------------------------------------------------
// 3. PUT Review - Updates an existing review (for Edit functionality)
// ------------------------------------------------------------------
// @desc    Update a specific review
// @route   PUT /api/reviews/:id
router.put('/:id', async (req, res) => {
    try {
        const reviewId = req.params.id;
        const { review, rating } = req.body; 

        // Basic validation
        if (!review || !rating) {
            return res.status(400).json({ success: false, message: 'Missing review text or rating.' });
        }

        const numericRating = parseInt(rating);
        if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
            return res.status(400).json({ success: false, message: 'Rating must be a number between 1 and 5.' });
        }
        
        if (!mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({ success: false, message: 'Invalid Review ID format.' });
        }
        
        // Find the review and update it
        const updatedReview = await Review.findByIdAndUpdate(
            reviewId,
            { review, rating: numericRating, updatedAt: new Date() },
            { new: true, runValidators: true } // Returns the new document and runs validators
        );

        if (!updatedReview) {
            return res.status(404).json({ success: false, message: 'Review not found.' });
        }

        res.status(200).json({ success: true, message: 'Review updated successfully!', data: updatedReview });
    } catch (error) {
        console.error("Error updating review:", error);
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join(', ') });
        }
        res.status(500).json({ success: false, message: 'Server error while updating review.' });
    }
});

// ------------------------------------------------------------------
// 4. DELETE Review - Deletes an existing review
// ------------------------------------------------------------------
// @desc    Delete a specific review
// @route   DELETE /api/reviews/:id
router.delete('/:id', async (req, res) => {
    try {
        const reviewId = req.params.id;
        
        if (!mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({ success: false, message: 'Invalid Review ID format.' });
        }

        const deletedReview = await Review.findByIdAndDelete(reviewId);

        if (!deletedReview) {
            return res.status(404).json({ success: false, message: 'Review not found.' });
        }

        res.status(200).json({ success: true, message: 'Review deleted successfully.' });
    } catch (error) {
        console.error("Error deleting review:", error);
        res.status(500).json({ success: false, message: 'Server error while deleting review.' });
    }
});


module.exports = router;