const express = require('express');
const router = express.Router();
const Order = require('../models/Order');

// ------------------------------------------------------------------
// 1. POST: Create a New Order (Updated to initialize statusUpdates)
// ------------------------------------------------------------------
router.post('/', async (req, res) => {
    try {
        const orderData = req.body;
        
        if (!orderData.customerName || !orderData.items || orderData.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Missing required order details (customer name or items).' });
        }
        
        // ⭐ Initialize statusUpdates for a new order
        orderData.statusUpdates = [{ 
            status: orderData.status || 'Pending', 
            date: Date.now(), 
            note: 'Order placed successfully.' 
        }];

        // ⭐ Default deliveryWeeks if not provided
        if (orderData.deliveryWeeks === undefined) {
             orderData.deliveryWeeks = 2; // Default to 2 weeks
        }

        const newOrder = new Order(orderData);
        const savedOrder = await newOrder.save();

        res.status(201).json({ 
            success: true, 
            message: 'Order placed successfully!', 
            data: savedOrder 
        });

    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            
            return res.status(400).json({
                success: false,
                message: `Validation failed: ${messages.join(', ')}`
            });
        }
        
        console.error('Error placing order:', error.message);
        res.status(500).json({ success: false, message: 'Server Error. Could not process the order.' });
    }
});

// ------------------------------------------------------------------
// 2. GET: Fetch All Orders (Dashboard View) 
// ------------------------------------------------------------------
router.get('/', async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: orders.length, data: orders });
    } catch (error) {
        console.error('Error fetching orders:', error.message);
        res.status(500).json({ success: false, message: 'Server Error. Could not retrieve orders.' });
    }
});

// ------------------------------------------------------------------
// 3. GET: Fetch a Single Order by ID (Detail View) 
// ------------------------------------------------------------------
router.get('/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }
        res.status(200).json({ success: true, data: order });
    } catch (error) {
        console.error('Error fetching order detail:', error.message);
        res.status(500).json({ success: false, message: 'Server Error or Invalid ID.' });
    }
});


// ------------------------------------------------------------------
// 4. PUT: Update Order Status (Admin action)
// ------------------------------------------------------------------
router.put('/:id/status', async (req, res) => {
    try {
        const { status, note } = req.body; 
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Requested']; 

        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid or missing status field.' });
        }
        
        const updateData = { 
            status: status, 
            updatedAt: Date.now(),
            $push: { // Add a new status update entry
                statusUpdates: {
                    status: status,
                    date: Date.now(),
                    note: note || `Status manually changed to ${status}.`
                }
            }
        };

        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            updateData, 
            { new: true, runValidators: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        res.status(200).json({ 
            success: true, 
            message: `Order status updated to ${status}`, 
            data: updatedOrder 
        });

    } catch (error) {
        console.error('Error updating order status:', error.message);
        res.status(500).json({ success: false, message: 'Server Error. Could not update status.' });
    }
});

// ------------------------------------------------------------------
// 5. PUT: Update Delivery Time 
// ------------------------------------------------------------------
router.put('/:id/deliverytime', async (req, res) => {
    try {
        const { deliveryWeeks } = req.body;

        if (deliveryWeeks === undefined || isNaN(parseFloat(deliveryWeeks))) {
            return res.status(400).json({ success: false, message: 'Invalid or missing deliveryWeeks field.' });
        }
        
        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            { deliveryWeeks: parseFloat(deliveryWeeks), updatedAt: Date.now() },
            { new: true, runValidators: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        res.status(200).json({ 
            success: true, 
            message: `Order delivery time updated to ${deliveryWeeks} weeks`, 
            data: updatedOrder 
        });

    } catch (error) {
        console.error('Error updating order delivery time:', error.message);
        res.status(500).json({ success: false, message: 'Server Error or Invalid ID.' });
    }
});

// ------------------------------------------------------------------
// 6. PUT: Request Order Cancellation (Customer action) 
// ------------------------------------------------------------------
router.put('/:id/request-cancellation', async (req, res) => {
    try {
        const orderId = req.params.id;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        // Only allow cancellation request if the order hasn't been shipped, delivered, or cancelled already
        if (order.status === 'Shipped' || order.status === 'Delivered' || order.status === 'Cancelled' || order.status === 'Requested') {
            return res.status(400).json({ success: false, message: `Cannot request cancellation. Order is currently in status: ${order.status}.` });
        }

        const newStatus = 'Requested';

        // Update the status and add a status update history entry
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { 
                status: newStatus, 
                $push: { statusUpdates: { status: newStatus, note: 'Customer requested order cancellation.', date: Date.now() } },
                updatedAt: Date.now() 
            },
            { new: true, runValidators: true }
        );

        res.status(200).json({ 
            success: true, 
            message: 'Cancellation request submitted successfully. Awaiting admin review.', 
            data: updatedOrder 
        });

    } catch (error) {
        console.error('Error requesting order cancellation:', error.message);
        res.status(500).json({ success: false, message: 'Server Error. Could not process cancellation request.' });
    }
});

// ------------------------------------------------------------------
// 7. DELETE: Delete an Order (Admin action) ⭐ NEW ROUTE
// @route   DELETE /api/orders/:id
// @access  Private (Admin Only) - Should be protected
// ------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
    try {
        const deletedOrder = await Order.findByIdAndDelete(req.params.id);

        if (!deletedOrder) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        // Log the deletion (optional, but good practice)
        console.log(`Order deleted: ${req.params.id}`);

        // Return a success message with no content (204 No Content) or a success JSON (200 OK)
        res.status(200).json({ 
            success: true, 
            message: `Order ID ${req.params.id} permanently deleted.`,
            data: deletedOrder
        });
        
    } catch (error) {
        console.error('Error deleting order:', error.message);
        res.status(500).json({ success: false, message: 'Server Error. Could not delete the order.' });
    }
});


module.exports = router;