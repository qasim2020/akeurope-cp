const crypto = require('crypto');
const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema(
    {
        links: [
            {
                entityType: { type: String, required: true },
                entityId: { type: mongoose.Types.ObjectId, required: true },
                entityUrl: { type: String, required: true },
            },
        ],
        category: { type: String, default: 'general' },
        access: [String],
        notes: { type: String },
        name: { type: String, required: true },
        size: { type: String, required: true },
        path: { type: String, required: true },
        secretToken: { type: String, unique: true, default: () => crypto.randomBytes(32).toString('hex') },
        public: { type: Boolean, default: false },
        mimeType: { type: String, required: true },
        uploadedBy: {
            actorType: { type: String },
            actorId: { type: String, required: true },
            actorUrl: { type: String }
        }
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

module.exports = mongoose.model('File', fileSchema);
