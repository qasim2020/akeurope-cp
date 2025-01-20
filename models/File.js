const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    links: [
        {
            entityType: { type: String, required: true },
            entityId: { type: mongoose.Types.ObjectId, required: true },
            entityUrl: { type: String, required: true },
        },
    ],
    category: { type: String, default: 'general'},
    access: [String],
    notes: { type: String },
    name: { type: String, required: true },
    size: { type: String, required: true },
    path: { type: String, required: true, unique: true },
    mimeType: { type: String, required: true },
    uploadDate: { type: Date, default: Date.now },
});

module.exports = mongoose.model('File', fileSchema);
