const mongoose = require('mongoose');

const payloadSchema = new mongoose.Schema(
    {
        amount: Number,
        transactionType: String,
        description: String,
        due: String,
        retryDays: Number,
        type: String,
        orderId: String,
        externalId: String,
    },
    {
        _id: false,
    }
);

const vippsChargeRequest = new mongoose.Schema(
    {
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        payload: {
            type: payloadSchema,
            required: true,
        },
        chargeId: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

const Payment = mongoose.model('VippsChargeRequest', vippsChargeRequest);

module.exports = Payment;
