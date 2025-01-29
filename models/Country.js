const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  flag: { type: String, required: true }, 
  currency: {
    code: { type: String, required: true },
    symbol: { type: String, required: true }
  }
});

module.exports = mongoose.model('Country', countrySchema);