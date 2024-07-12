const mongoose = require("mongoose");

const transcriptSchema = new mongoose.Schema({
  userId: String, // Add userId field
  transcripts: [
    {
      transcript: [
        {
          sender: String,
          message: String,
          timestamp: { type: Date, default: Date.now },
        },
      ],
    },
  ],
});

module.exports = mongoose.model("Transcript", transcriptSchema);
