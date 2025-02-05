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
const MODEL_NAME = "gemini-1.5-flash";
const API_KEY = process.env.API_KEY;

mongoose.connect(db_url);

mongoose.connection.on("connected", () => {
  console.log("Connected to MongoDB");
});

app.use("/", transcriptRouter);

async function runChat(userInput, chatHistory) {
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const generationConfig = {
    temperature: 0.7, // Adjusted for better balance between creativity and coherence
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

  // Prepare chat history for the model
  const history = chatHistory.messages.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.text }],
  }));

  // Start chat session
  const chat = model.startChat({
    generationConfig,
    safetySettings,
    history,
  });

  const result = await chat.sendMessage(userInput);
  const responseText = result.response.text();

  // Check if the response contains a URL and format it
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const responseWithLinks = responseText.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank">${url}</a>`;
  });

  return responseWithLinks;
}

// Handle chatbot requests
app.post("/chat-history/:id", async (req, res) => {
  try {
    const chatHistoryId = req.params.id;
    const userInput = req.body?.userInput;

    console.log("User Input:😀", userInput);
    console.log("Chat History ID:", chatHistoryId);

    if (!ObjectId.isValid(chatHistoryId)) {
      return res.status(400).json({ error: "Invalid chat history ID" });
    }

    const chatData = await ChatModel.findById(chatHistoryId);
    if (!chatData) {
      return res.status(404).json({ error: "Chat history not found" });
    }

    if (!userInput) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    // Pass chatHistory to runChat function
    const response = await runChat(userInput, chatData);
    console.log("Response:😀", response);

    res.json({ response });
  } catch (error) {
    console.error("Error fetching chat history:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
