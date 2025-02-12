const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const DonorSchema = new mongoose.Schema(
    {
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        organization: { type: String },
        location: { type: String },
        emailStatus: { type: String },
        tel: { type: String },
        anonymous: { type: Boolean, default: false },
        countryCode: { type: String },
        stripeCustomerId: { type: String, unique: true },
        stripePaymentMethodId: { type: String },
        subscriptions: [
            {
                subscriptionId: { type: String, required: true },
                status: { type: String, required: true },
                currentPeriodStart: { type: Date },
                currentPeriodEnd: { type: Date },
                price: { type: Number },
                currency: { type: String },
                interval: { type: String },
                paymentIntentId: { type: String },
                paymentStatus: { type: String },
                paymentMethodId: { type: String },
            },
        ],
        payments: [
            {
                paymentIntentId: { type: String, required: true },
                status: { type: String, required: true },
                amount: { type: Number, required: true },
                currency: { type: String, required: true },
                paymentMethodId: { type: String },
                created: { type: Date, default: Date.now },
            },
        ],
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

module.exports = mongoose.model('Donor', DonorSchema);
