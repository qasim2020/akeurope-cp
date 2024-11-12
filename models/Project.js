const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, unique: true},
  location: { type: String },
  status: {type:String },
  fields: { type: Array, default: [] } 
});

module.exports = mongoose.model('Project', ProjectSchema);