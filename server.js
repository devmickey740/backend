const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Map categories to their txt files
const questionFiles = {
  letter: "letter.txt",
  essay: "essay.txt",
  report: "report.txt",
  email: "email.txt",
  comprehension: "comprehension.txt",
  situation: "situation.txt",
  precise: "precise.txt"
};

// ✅ API: Get random question
app.get('/api/question/:type', (req, res) => {
  const type = req.params.type.toLowerCase();
  const fileName = questionFiles[type];

  if (!fileName) {
    return res.status(400).json({ error: "Invalid category" });
  }

  const filePath = path.join(__dirname, "questions", fileName);

  try {
    const data = fs.readFileSync(filePath, "utf-8").split("\n").filter(q => q.trim() !== "");
    const randomQuestion = data[Math.floor(Math.random() * data.length)];
    res.json({ question: randomQuestion });
  } catch (err) {
    res.status(500).json({ error: "Failed to load question" });
  }
});

// ✅ API: Submit answer
app.post('/api/submit', (req, res) => {
  const { category, answer } = req.body;

  if (!answer || answer.trim().length < 20) {
    return res.status(400).json({ error: "Answer too short. Please write more." });
  }

  // Mock plagiarism & AI detection (randomized)
  const plagiarismCheck = Math.random() < 0.1; // 10% flagged
  const aiCheck = Math.random() < 0.1;         // 10% flagged

  // Simple scoring system
  const wordCount = answer.trim().split(/\s+/).length;
  let marks = Math.min(100, wordCount); // Max 100
  let strengths = [];
  let weaknesses = [];
  let suggestions = [];

  if (wordCount > 150) strengths.push("Good content length.");
  else weaknesses.push("Answer is too short. Try expanding your ideas.");

  if (!answer.includes("I")) strengths.push("Formal tone maintained.");
  else weaknesses.push("Try using a more formal tone.");

  suggestions.push("Focus on structure: intro, body, conclusion.");
  suggestions.push("Avoid repetition and keep your ideas concise.");

  res.json({
    marks,
    plagiarismCheck,
    aiCheck,
    strengths,
    weaknesses,
    suggestions,
    answer
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
