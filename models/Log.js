const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    entityType: String,
    entityId: mongoose.Schema.Types.ObjectId,
    actorType: String,
    actorId: mongoose.Schema.Types.ObjectId,
    action: String,
    changes: [],
    url: String, 
    timestamp: { type: Date, default: Date.now },
    color: String,
    isNotification: { type: Boolean, default: false },
    isRead: { type: Boolean, default: false },
    expiresAt: Date,
});

module.exports = mongoose.model('Log', logSchema);
