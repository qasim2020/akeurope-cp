const mongoose = require('mongoose');
const { getSocket } = require('../sockets/index');

const logSchema = new mongoose.Schema({
    entityType: String,
    entityId: mongoose.Schema.Types.ObjectId,
    actorType: String,
    actorId: mongoose.Schema.Types.ObjectId,
    action: String,
    changes: [],
    timestamp: { type: Date, default: Date.now },
    color: String,
    isNotification: { type: Boolean, default: false },
    isRead: { type: Boolean, default: false },
    isReadByCustomer: { type: Boolean, default: false },
    expiresAt: Date,
});

logSchema.post('save', function (doc) {
    if (doc.isNotification) {
        const io = getSocket();
        io.emit('new-notification');
    }
});

module.exports = mongoose.model('Log', logSchema);
