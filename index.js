const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;
const ChatModel = require("./models/data");
const transcriptRouter = require("./routes/transcriptRoutes");

const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");

const dotenv = require("dotenv").config();

const app = express();
app.use(cors());
const port = process.env.PORT || 5000;
const db_url = process.env.DB_URL;
app.use(express.json());

const MODEL_NAME = "gemini-1.5-flash"; // Updated model
const API_KEY = process.env.API_KEY;

// MongoDB Connection
mongoose.connect(db_url);
mongoose.connection.on("connected", () => {
  console.log("Connected to MongoDB");
});

// Use transcript routes
app.use("/", transcriptRouter);

// Run Chat Function
async function runChat(userInput, chatHistory) {
  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const generationConfig = {
      temperature: 0.9,
      topK: 1,
      topP: 1,
      maxOutputTokens: 2048,
    };

    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ];

    // Ensure chatHistory is an array of messages
    const history = chatHistory?.messages?.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.text }],
    })) || [];

    console.log("Chat History:", history); // Debugging log

    const chat = model.startChat({
      generationConfig,
      safetySettings,
      history,
    });

    const result = await chat.sendMessage(userInput);
    const responseText = await result.response.text(); // Fix missing await

    // Convert URLs in response to clickable links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const responseWithLinks = responseText.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank">${url}</a>`;
    });

    return responseWithLinks;
  } catch (error) {
    console.error("Error in runChat:", error);
    return "Sorry, there was an error processing your request.";
  }
}

// Chat History Route
app.post("/chat-history/:id", async (req, res) => {
  try {
    const chatHistoryId = req.params.id;
    const userInput = req.body?.userInput;

    console.log("User Input:", userInput);
    console.log("Chat History ID:", chatHistoryId);

    if (!ObjectId.isValid(chatHistoryId)) {
      return res.status(400).json({ error: "Invalid chat history ID" });
    }

    const chatData = await ChatModel.findById(chatHistoryId).lean();
    if (!chatData || !chatData.messages) {
      return res.status(404).json({ error: "Chat history not found" });
    }

    if (!userInput) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    // Call AI model
    const response = await runChat(userInput, chatData);
    console.log("AI Response:", response);

    res.json({ response });
  } catch (error) {
    console.error("Error fetching chat history:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
