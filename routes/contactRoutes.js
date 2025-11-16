const express = require('express');
const router = express.Router();
const ContactMessage = require('../models/ContactMessage'); 

// Note: Production environment mein, aapko yahan 'protect' ya 'admin' middleware add karna chahiye 
// taake GET, PUT, aur DELETE routes sirf authorized users ke liye kaam karein.

// ------------------------------------------------------------------
// 1. POST: Submit Contact Message (Frontend form submit)
// @route   POST /api/contact
// @access  Public
// ------------------------------------------------------------------
router.post('/', async (req, res) => {
    try {
        const { firstName, lastName, email, contactDetails, message } = req.body;
        
        // Validation: Zaroori fields check karein
        if (!firstName || !lastName || !email || !contactDetails || !message) {
            return res.status(400).json({ 
                success: false,
                message: 'Please fill in all required fields.' 
            });
        }

        const newContactMessage = new ContactMessage({
            firstName,
            lastName,
            email,
            contactDetails,
            message
        });

        const savedMessage = await newContactMessage.save();
        
        res.status(201).json({ 
            success: true,
            message: 'Your message has been received successfully!', 
            data: savedMessage 
        });

    } catch (error) {
        console.error('Error saving contact message:', error.message);
        res.status(500).json({ 
            success: false,
            message: 'Server Error. Could not process your request.' 
        });
    }
});


// ------------------------------------------------------------------
// 2. GET: Fetch All Contact Messages (Dashboard view)
// @route   GET /api/contact
// @access  Private (Admin only)
// ------------------------------------------------------------------
router.get('/', async (req, res) => {
    try {
        // Messages ko naye se purane tarteeb (descending order) mein sort karein
        const messages = await ContactMessage.find().sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: messages.length,
            data: messages
        });

    } catch (error) {
        console.error('Error fetching contact messages:', error.message);
        res.status(500).json({ 
            success: false,
            message: 'Server Error. Could not retrieve messages.' 
        });
    }
});


// ------------------------------------------------------------------
// 3. PUT: Mark Message as Read (Dashboard action)
// @route   PUT /api/contact/:id/read
// @access  Private (Admin only)
// ------------------------------------------------------------------
router.put('/:id/read', async (req, res) => {
    try {
        const messageId = req.params.id;

        const message = await ContactMessage.findByIdAndUpdate(
            messageId,
            { isRead: true },
            { new: true, runValidators: true } // naya updated document return karein
        );

        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        res.status(200).json({ 
            success: true, 
            message: 'Message marked as read', 
            data: message 
        });

    } catch (error) {
        console.error('Error marking message as read:', error.message);
        res.status(500).json({ success: false, message: 'Server Error or Invalid ID format' });
    }
});


// ------------------------------------------------------------------
// 4. DELETE: Delete a Contact Message (Dashboard action)
// @route   DELETE /api/contact/:id
// @access  Private (Admin only)
// ------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
    try {
        const messageId = req.params.id;

        const result = await ContactMessage.findByIdAndDelete(messageId);

        if (!result) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        res.status(200).json({ 
            success: true, 
            message: 'Message deleted successfully' 
        });

    } catch (error) {
        console.error('Error deleting contact message:', error.message);
        res.status(500).json({ success: false, message: 'Server Error or Invalid ID format' });
    }
});


module.exports = router;