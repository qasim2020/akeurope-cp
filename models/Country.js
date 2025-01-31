const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  flag: { type: String, required: true }, 
  currency: {
    code: { type: String, default: 'N/A' }, 
    symbol: { type: String, default: 'N/A' } 
  },
  callingCodes: { type: [String], default: ['N/A'] } 
});

module.exports = mongoose.model('Country', countrySchema);