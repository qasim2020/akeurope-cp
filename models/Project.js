const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, unique: true},
  location: { type: String, required: true },
  currency: { type: String, required: true },
  status: {type:String, required: true },
  fields: { type: Array, default: [] } 
});

module.exports = mongoose.model('Project', ProjectSchema);