import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import multer from "multer";
import fs from "fs";
import { createRequire } from "module";

dotenv.config();

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse").default;

const app = express();
app.use(cors());
app.use(express.json());

console.log("GROQ KEY:", process.env.GROQ_API_KEY ? "FOUND" : "NOT FOUND");

const upload = multer({ dest: "uploads/" });

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// ---------------- FILE TEXT EXTRACT ----------------
async function extractFileText(file) {
  const ext = file.originalname.split(".").pop().toLowerCase();

  if (ext === "pdf") {
    const buffer = fs.readFileSync(file.path);
    const data = await pdfParse(buffer);
    return data.text || "";
  }

  if (["jpg", "jpeg", "png"].includes(ext)) {
    return "User uploaded an image.";
  }

  return "";
}

// ---------------- CHAT API ----------------
app.post("/chat", upload.single("file"), async (req, res) => {
  try {
    const question = req.body.question;

    if (!question) {
      return res.json({ reply: "Question likho" });
    }

    let fileText = "";

    if (req.file) {
      try {
        fileText = await extractFileText(req.file);
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error("FILE READ ERROR:", err);
      }
    }

    const messages = [];

    if (fileText.trim()) {
      messages.push({
        role: "system",
        content: `Use document only if relevant:\n${fileText.substring(0, 3000)}`
      });
    }

    messages.push({
      role: "user",
      content: question
    });

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages
    });

    res.json({
      reply:
        completion?.choices?.[0]?.message?.content ||
        "No response from AI"
    });

  } catch (error) {
    console.error("CHAT ERROR:", error);
    res.status(500).json({ reply: "Server Error" });
  }
});

// ---------------- LOGIN API ----------------
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (username === "admin" && password === "1234") {
    res.json({
      success: true,
      token: "JWT_SAMPLE_TOKEN",
      user: { name: "Admin User" }
    });
  } else {
    res.status(401).json({
      success: false,
      message: "Invalid credentials"
    });
  }
});

// ---------------- SERVER START ----------------
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
