const mongoose = require('mongoose');

const TrackerSchema = new mongoose.Schema(
    {
        referrer: String,
        fullUrl: String,
        hostname: String,
        path: String,
        utm: String,
        language: String,
        userAgent: String,
        timezone: String,
        screen: Object,
        platform: String,
        utm: Object,
        geo: Object,
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

const Tracker = mongoose.model('Tracker', TrackerSchema);

module.exports = { Tracker };