const express = require("express");
const router = express.Router();
const transcriptController = require("../controllers/transcriptController");

router.post("/save-transcript", transcriptController.saveTranscript);

module.exports = router;
