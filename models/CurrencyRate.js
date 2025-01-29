const mongoose = require('mongoose');

const CurrencyRateSchema = new mongoose.Schema(
    {
        baseCurrency: {
            type: String,
            required: true
        },
        rates: {
            type: Map,
            of: Number, 
        },
        date: {
            type: Date,
            required: true,
            default: () => new Date().toISOString().split('T')[0], 
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

const CurrencyRate = mongoose.model('CurrencyRate', CurrencyRateSchema);

module.exports = { CurrencyRate };