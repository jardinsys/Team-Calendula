const mongoose = require("mongoose");

const mediaSchema = new mongoose.Schema({
  //R2 object key/path (optional for imported external URLs)
  r2Key: {
    type: String,
  },
  // Which R2 bucket this media is stored in ('app' or 'discord')
  bucket: {
    type: String,
    enum: ['app', 'discord'],
    default: 'app'
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