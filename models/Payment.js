const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        entryId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        subscriptionId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        stripePaymentIntentId: {
            type: String, // Stripe Payment Intent ID for tracking
            required: true,
        },
        amount: {
            type: Number, // Payment amount in the smallest currency unit (e.g., cents for USD)
            required: true,
        },
        currency: {
            type: String, // e.g., 'usd'
            required: true,
        },
        status: {
            type: String,
            enum: ['succeeded', 'failed', 'pending', 'refunded'],
            default: 'pending',
        },
        receiptUrl: {
            type: String, // Stripe-generated URL for the payment receipt
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        updatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt fields
    }
);

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
