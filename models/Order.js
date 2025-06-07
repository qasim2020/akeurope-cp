const mongoose = require('mongoose');

const Counter = require('../models/Counter');

const OrderSchema = new mongoose.Schema(
    {
        orderNo: {
            type: Number,
            unique: true,
        },
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
        },
        vippsAgreementId: { type: String, required: false, index: false },
        vippsReference: { type: String, required: false, index: false },
        status: {
            type: String,
            status: {
                type: String,
                enum: [
                    'draft',
                    'aborted',
                    'cancelled',
                    'rejected',
                    'terminated',
                    'stopped',
                    'expired',
                    'authorized',
                    'pending payment',
                    'processing',
                    'paid',
                    'refunded',
                ],
                default: 'draft',
            },
            default: 'draft',
        },
        currency: {
            type: String,
            default: 'USD',
            required: true,
        },
        totalCost: {
            type: Number,
        },
        projects: [
            {
                slug: {
                    type: String,
                    required: true,
                },
                months: {
                    type: Number,
                    required: true,
                },
                totalCostSingleMonth: Number,
                totalCostAllMonths: Number,
                totalCost: Number,
                totalSubscriptionCosts: [Object],
                entries: [
                    {
                        entryId: mongoose.Schema.Types.ObjectId,
                        selectedSubscriptions: [String],
                        totalCost: Number,
                        totalCostAllSubscriptions: Number,
                        costs: [Object],
                    },
                ],
            },
        ],
        monthlySubscription: {
            type: Boolean,
        },
        totalCostSingleMonth: {
            type: Number,
        },
        countryCode: {
            type: String,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

OrderSchema.pre('save', async function (next) {
    const doc = this;

    if (doc.counterId) return next();

    try {
        const counter = await Counter.findOneAndUpdate({ _id: 'Order' }, { $inc: { seq: 1 } }, { new: true, upsert: true });
        doc.orderNo = counter.seq;
        next();
    } catch (error) {
        next(error);
    }
});

const Order = mongoose.model('Order', OrderSchema);

module.exports = Order;
