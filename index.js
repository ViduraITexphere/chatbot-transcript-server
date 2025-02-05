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

// Ensure API_KEY is set
if (!process.env.API_KEY) {
  console.error("API_KEY is not set in the environment variables.");
  process.exit(1); // Exit the application if the API key is missing
}
console.log("API_KEY:", process.env.API_KEY);

// Update the model name here
const MODEL_NAME = "gemini-1.5-flash"; // Use "gemini-1.5-pro" if needed

mongoose.connect(db_url);
mongoose.connection.on("connected", () => {
  console.log("Connected to MongoDB");
});
mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

app.use("/", transcriptRouter);

// Updated runChat function using generateContent
async function runChat(userInput, chatHistory) {
  const genAI = new GoogleGenerativeAI(process.env.API_KEY);

  // Define the JSON schema for structured responses
  const schema = {
    description: "Chatbot response",
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "Response text from the chatbot",
        nullable: false,
      },
    },
    required: ["text"],
  };

  // Get the generative model with the specified configuration
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.9,
      topK: 1,
      topP: 1,
      maxOutputTokens: 2048,
    },
    safetySettings: [
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
    ],
  });

  // Generate content using the model
  try {
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: userInput }],
        },
      ],
      responseMimeType: "application/json",
      responseSchema: schema,
    });

    // Extract and return the response
    const responseText = result.response.text();
    console.log("Raw response from model:", responseText);

    // Parse the JSON response
    try {
      const jsonResponse = JSON.parse(responseText);
      return jsonResponse.text;
    } catch (parseError) {
      console.error("Error parsing JSON response:", parseError);
      return "Sorry, I encountered an issue processing your request.";
    }
  } catch (modelError) {
    console.error("Error generating content from the model:", modelError);
    return "Sorry, I encountered an issue generating a response.";
  }
}

// Route to handle chat history
app.post("/chat-history/:id", async (req, res) => {
  try {
    const chatHistoryId = req.params.id;
    const userInput = req.body?.userInput;

    console.log("Received request with chatHistoryId:", chatHistoryId);
    console.log("User input:", userInput);

    // Validate chatHistoryId
    if (!ObjectId.isValid(chatHistoryId)) {
      console.error("Invalid chatHistoryId:", chatHistoryId);
      return res.status(400).json({ error: "Invalid chat history ID" });
    }

    // Fetch chat history from the database
    const chatData = await ChatModel.findById(chatHistoryId);
    if (!chatData) {
      console.error("Chat history not found for ID:", chatHistoryId);
      return res.status(404).json({ error: "Chat history not found" });
    }

    // Validate user input
    if (!userInput) {
      console.error("Invalid request body. Missing userInput.");
      return res.status(400).json({ error: "Invalid request body" });
    }

    // Call the runChat function
    try {
      const response = await runChat(userInput, chatData);
      console.log("Response from runChat:", response);
      res.json({ response });
    } catch (chatError) {
      console.error("Error in runChat:", chatError);
      res.status(500).json({ error: "Error processing chat request" });
    }
  } catch (error) {
    console.error("Error fetching chat history:", error.stack);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
