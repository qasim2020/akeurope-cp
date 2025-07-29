const mongoose = require('mongoose');

const SponsorshipSchema = new mongoose.Schema(
    {
        entryId: mongoose.Schema.Types.ObjectId,
        customerId: mongoose.Schema.Types.ObjectId,
        orderId: mongoose.Schema.Types.ObjectId,
        projectSlug: String,
        startedAt: Date,
        stoppedAt: Date,
        reasonStopped: String,
        daysSponsored: Number,
        totalPaid: String,
    },
    {
        versionKey: false,
        timestamps: true
    }
);

SponsorshipSchema.index({ customerId: 1, entryId: 1, orderId: 1 });

const Sponsorship = mongoose.model('Sponsorship', SponsorshipSchema);

module.exports = Sponsorship;
