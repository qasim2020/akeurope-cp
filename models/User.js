const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: { type: String, enum: ['admin', 'editor', 'viewer'], default: 'viewer' },
  status: { type: String, default: 'pending' },
  invitationStatus: { type: Boolean, default: false },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  inviteToken: String,
  inviteExpires: Date
});

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.methods.comparePassword = function (password) {
  if (this.password == undefined) return false;
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', UserSchema);
