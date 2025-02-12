const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const CustomerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, default: 'donor' },
    organization: { type: String },
    location: { type: String },
    password: { type: String },
    status: { type: String, enum: ['active', 'blocked'], default: 'active' },
    emailStatus: { type: String },
    tel: { type: String},
    organization: { type: String},
    anonymous: { type: String},
    countryCode: { type: String},
    inviteToken: String,
    inviteExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
});

CustomerSchema.pre('findOneAndUpdate', async function (next) {
    const update = this.getUpdate();
    if (update.$set && update.$set.password) {
        update.$set.password = await bcrypt.hash(update.$set.password, 10);
    }
    next();
});

CustomerSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

CustomerSchema.methods.comparePassword = function (password) {
    return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('Customer', CustomerSchema);
