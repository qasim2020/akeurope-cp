const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
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
        stripeSubscriptionId: {
            type: String, // To store the subscription ID from Stripe
            required: true,
        },
        stripePaymentMethodId: {
            type: String, // To store the payment method ID from Stripe
        },
        status: {
            type: String,
            enum: ['active', 'canceled', 'pending', 'incomplete', 'incomplete_expired', 'trialing'],
            default: 'pending',
        },
        startDate: {
            type: Date,
            default: Date.now,
        },
        endDate: {
            type: Date, // Can be null for active subscriptions
        },
        trialEnd: {
            type: Date, // If a trial period is provided
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

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;
