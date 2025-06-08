const mongoose = require('mongoose');

const Counter = require('./Counter');

const VariantSchema = new mongoose.Schema({
    name: { type: String, required: true },
    id: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, default: 0 },
    orderedCost: { type: Number, default: 0 },
});

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    desc: { type: String, required: true },
    id: { type: String, required: true },
    variants: { type: [VariantSchema], default: [] },
    orderedCost: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
});

const SubscriptionRecordSchema = new mongoose.Schema(
    {
        orderNo: { type: String },
        customerId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Customer' },
        vippsAgreementId: { type: String, required: false, index: false },
        vippsReference: { type: String, required: false, index: false },
        currency: { type: String, required: true },
        total: { type: Number, required: true },
        totalAllTime: { type: Number, required: true },
        monthlySubscription: { type: Boolean, default: false },
        countryCode: { type: String, required: true },
        projectSlug: { type: String, required: true },
        products: { type: [ProductSchema], default: [], required: false },
        cloudflareIp: { type: String, required: false, index: false },
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
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

SubscriptionRecordSchema.pre('save', async function (next) {
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

const Subscription = mongoose.model('SubscriptionRecord', SubscriptionRecordSchema);

module.exports = Subscription;
