const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const DonorSchema = new mongoose.Schema(
    {
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        organization: { type: String },
        address: { type: String },
        emailStatus: { type: String },
        tel: { type: String },
        anonymous: { type: Boolean, default: false },
        countryCode: { type: String },
        vippsToken: { type: String },
        vippsCustomerId: { type: String, index: false },
        vippsCustomerSub: { type: String, index: false },
        stripeCustomerId: { type: String, index: false },
        stripePaymentMethodId: { type: String, index: false },
        subscriptions: [
            {
                orderId: { type: mongoose.Schema.Types.ObjectId },
                paymentMethodType: { type: String },
                subscriptionId: { type: String },
                status: { type: String },
                currentPeriodStart: { type: Date },
                currentPeriodEnd: { type: Date },
                price: { type: Number },
                currency: { type: String },
                interval: { type: String },
                paymentIntentId: { type: String },
                paymentStatus: { type: String },
                paymentMethodId: { type: String },
                created: { type: Date, default: Date.now },
            },
        ],
        payments: [
            {
                orderId: { type: mongoose.Schema.Types.ObjectId },
                paymentMethodType: { type: String },
                paymentIntentId: { type: String },
                status: { type: String },
                amount: { type: Number },
                currency: { type: String },
                paymentMethodId: { type: String },
                invoiceId: { type: String },
                created: { type: Date, default: Date.now },
            },
        ],
        vippsPayments: [{ type: Object }],
        vippsAgreements: [{ type: Object }],
        vippsCharges: [{ type: Object }],
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

module.exports = mongoose.model('Donor', DonorSchema);