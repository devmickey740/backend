const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 🔑 Load your OpenAI API key from environment variable
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Map category -> file
const questionFiles = {
  letter: "letter.txt",
  essay: "essay.txt",
  report: "report.txt",
  email: "email.txt",
  comprehension: "comprehension.txt",
  situation: "situation.txt",
  precise: "precise.txt"
};

// ✅ Get random question
app.get("/api/question/:type", (req, res) => {
  const type = req.params.type.toLowerCase();
  const fileName = questionFiles[type];

  if (!fileName) {
    return res.status(400).json({ error: "Invalid category" });
  }

  const filePath = path.join(__dirname, "questions", fileName);

  try {
    const lines = fs.readFileSync(filePath, "utf-8")
      .split("\n")
      .filter(l => l.trim() !== "");

    const randomQ = lines[Math.floor(Math.random() * lines.length)];
    res.json({ question: randomQ });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load question" });
  }
});

// ✅ Submit answer (AI-Powered)
app.post("/api/submit/:category", async (req, res) => {
  const { category } = req.params;
  const { answer } = req.body;

  if (!answer || !answer.trim()) {
    return res.status(400).json({ error: "Answer cannot be empty" });
  }

  try {
    // Ask GPT to evaluate the answer
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",  // lightweight + fast
      messages: [
        {
          role: "system",
          content: `You are an evaluator for descriptive writing exams like bank exams. 
          Your job is to evaluate the student's answer, give marks out of 10, list strengths, weaknesses, and suggestions for improvement. 
          Respond in JSON with keys: marks, maxMarks, strengths, weaknesses, suggestions.`
        },
        {
          role: "user",
          content: `Category: ${category}\n\nAnswer: ${answer}`
        }
      ],
      temperature: 0.5
    });

    // Parse response
    let feedback;
    try {
      feedback = JSON.parse(completion.choices[0].message.content);
    } catch (err) {
      console.error("AI Response parsing failed:", completion.choices[0].message.content);
      feedback = {
        marks: 5,
        maxMarks: 10,
        strengths: "Good attempt.",
        weaknesses: "Evaluation failed, default feedback applied.",
        suggestions: "Try to structure your answer better."
      };
    }

    res.json({
      marks: feedback.marks,
      maxMarks: feedback.maxMarks || 10,
      feedback,
      userAnswer: answer
    });

  } catch (err) {
    console.error("OpenAI API Error:", err);
    res.status(500).json({ error: "AI evaluation failed." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
