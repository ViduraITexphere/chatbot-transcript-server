const mongoose = require("mongoose");
const TranscriptModel = require("../models/transcript");

exports.saveTranscript = async (req, res) => {
  console.log("req.body:", req.body);
  try {
    const { objectId, transcript } = req.body;
    console.log("objectId:", objectId);
    console.log("transcript:", transcript);

    // Create a new document with a unique ObjectId
    const newChatData = new TranscriptModel({
      userId: objectId,
      transcripts: [{ transcript }],
      // timestamp: { type: Date, default: Date.now },
    });

    await newChatData.save();
    return res.status(201).json({ message: "Transcript saved successfully" });
  } catch (error) {
    console.error("Error saving transcript:", error); // Detailed logging
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
