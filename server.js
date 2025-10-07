// server.js - Supports multi-paragraph questions and AI feedback

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ✅ Initialize OpenAI client (set OPENAI_API_KEY in Koyeb or .env)
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ✅ Mapping of categories to text files
const questionFiles = {
  letter: "letter.txt",
  essay: "essay.txt",
  report: "report.txt",
  email: "email.txt",
  comprehension: "comprehension.txt",
  situation: "situation.txt",
  precise: "precise.txt"
};

// ✅ Helper function to parse questions
// Uses ===QUESTION=== delimiter, with fallback to double-newlines
function parseQuestions(content) {
  const DELIMITER = "===QUESTION===";

  if (content.includes(DELIMITER)) {
    return content
      .split(DELIMITER)
      .map(q => q.trim())
      .filter(Boolean);
  } else {
    // fallback: split by 2+ newlines
    return content
      .split(/\n{2,}/)
      .map(q => q.trim())
      .filter(Boolean);
  }
}

// ✅ GET: Fetch a random question
app.get("/api/question/:type", (req, res) => {
  const type = req.params.type.toLowerCase();
  const fileName = questionFiles[type];

  if (!fileName) {
    return res.status(400).json({ error: "Invalid category" });
  }

  const filePath = path.join(__dirname, "questions", fileName);

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const questions = parseQuestions(content);

    if (!questions.length) {
      return res.status(404).json({ error: "No questions found in file" });
    }

    // Pick random question (keep paragraph formatting)
    const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
    return res.json({ question: randomQuestion });
  } catch (err) {
    console.error("❌ Error reading question file:", err);
    return res.status(500).json({ error: "Failed to load question" });
  }
});

// ✅ POST: Evaluate user's answer using AI
app.post("/api/submit/:category", async (req, res) => {
  const { category } = req.params;
  const { answer } = req.body;

  if (!answer || !answer.trim()) {
    return res.status(400).json({ error: "Answer cannot be empty" });
  }

  try {
    // System prompt for evaluator
    const systemPrompt = `
You are an experienced evaluator for descriptive writing tests like bank exams.
Evaluate the student's answer fairly and objectively.
Respond **only** in JSON format with these keys:
{
  "marks": <number between 0-10>,
  "maxMarks": 10,
  "feedback": {
    "strengths": "<2-3 lines>",
    "weaknesses": "<2-3 lines>",
    "suggestions": "<2-3 lines>"
  }
}
`;

    const userPrompt = `Category: ${category}
Student's Answer:
${answer}`;

    // Call OpenAI API
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.4,
      max_tokens: 600
    });

    const aiResponse = completion.choices?.[0]?.message?.content?.trim() || "";

    // Try to parse JSON output safely
    let parsed;
    try {
      parsed = JSON.parse(aiResponse);
    } catch {
      const match = aiResponse.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }

    // Fallback if AI doesn't return valid JSON
    if (!parsed) {
      console.error("⚠️ Invalid AI JSON:", aiResponse);
      const words = answer.split(/\s+/).length;
      parsed = {
        marks: Math.min(10, Math.floor(words / 25)),
        maxMarks: 10,
        feedback: {
          strengths: "Relevant ideas and clear expression.",
          weaknesses: "Structure could be improved.",
          suggestions: "Add examples and use a more formal tone."
        }
      };
    }

    return res.json({
      marks: parsed.marks,
      maxMarks: parsed.maxMarks || 10,
      feedback: parsed.feedback,
      userAnswer: answer
    });
  } catch (err) {
    console.error("❌ OpenAI Evaluation Error:", err);
    return res.status(500).json({ error: "AI evaluation failed. Please try again." });
  }
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
