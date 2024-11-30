const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const CustomerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, default: 'viewer' }, 
    organization: { type: String },
    location: { type: String },
    password: { type : String },
    status: { type: String, enum: ['active', 'blocked'], default: 'active' },
    emailStatus: { type: String },
    projects: [{ type: String, ref: 'Project' }],
    subscriptions: [{ type: mongoose.Types.ObjectId }],
    inviteToken: String,
    inviteExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    isBoarded: { type: String, defualt: false },
    isBoardingAtStep: String
});

// Hash the password before saving it
CustomerSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

CustomerSchema.methods.comparePassword = function (password) {
    return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('Customer', CustomerSchema);