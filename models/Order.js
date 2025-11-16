const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    // --- CUSTOMER DETAILS ---
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    customerPhone: { type: String, required: true },

    // --- SHIPPING DETAILS ---
    shippingAddress: {
      streetAddress: { type: String, required: true },
      city: { type: String, required: true },
      province: { type: String, required: true },
      country: { type: String, required: true },
      zipCode: { type: String, required: true }
    },

    geoLocation: {
      latitude: { type: Number },
      longitude: { type: Number }
    },

    notes: { type: String },

    // --- PRODUCT DETAILS ---
    items: [
      {
        productId: { type: String, required: true },
        productName: { type: String, required: true },
        variant: { type: String },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        imageUrl: { type: String } 
      }
    ],

    // --- FINANCIAL SUMMARY ---
    subtotalAmount: { type: Number, required: true },
    shippingFee: { type: Number, required: true },
    discountCode: { type: String },
    discountAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },

    paymentMethod: {
      type: String,
      enum: ['cod', 'card', 'bank', 'easypaisa'], 
      default: 'cod'
    },

    // --- STATUS & TRACKING ---
    status: {
      type: String,
      enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Requested'],
      default: 'Pending'
    },
    
    // ⭐ Estimated Delivery Time in weeks (used for timeline calculation)
    deliveryWeeks: {
      type: Number,
      default: 2 
    },
    
    // ⭐ Timeline History (logs all status changes)
    statusUpdates: [
      {
        status: { type: String, required: true },
        date: { type: Date, default: Date.now },
        note: { type: String }
      }
    ]
  },
  { timestamps: true } // Adds createdAt and updatedAt fields automatically
);

module.exports = mongoose.model('Order', orderSchema);