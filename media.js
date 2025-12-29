const mongoose = require("mongoose");

const mediaSchema = new mongoose.Schema({
  //R2 object key/path
  r2Key: {
    type: String,
    required: true
  },
  // Public URL
  url: {
    type: String,
    required: true
  },
  // Metadata
  filename: String,
  mimeType: String,
  size: Number,  // in bytes
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mediaSchema;