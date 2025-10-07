import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import stringSimilarity from "string-similarity"; // ✅ NEW

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ✅ Initialize OpenAI client
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

// ✅ Helper to parse questions
function parseQuestions(content) {
  const DELIMITER = "===QUESTION===";
  if (content.includes(DELIMITER)) {
    return content.split(DELIMITER).map(q => q.trim()).filter(Boolean);
  } else {
    return content.split(/\n{2,}/).map(q => q.trim()).filter(Boolean);
  }
}

// ✅ Fetch question route
app.get("/api/question/:type", (req, res) => {
  const type = req.params.type.toLowerCase();
  const fileName = questionFiles[type];

  if (!fileName) return res.status(400).json({ error: "Invalid category" });

  const filePath = path.join(process.cwd(), "questions", fileName);
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const questions = parseQuestions(content);
    if (!questions.length) return res.status(404).json({ error: "No questions found" });
    const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
    return res.json({ question: randomQuestion });
  } catch (err) {
    console.error("❌ Error reading question file:", err);
    return res.status(500).json({ error: "Failed to load question" });
  }
});

// ✅ Submit + Evaluate
app.post("/api/submit/:category", async (req, res) => {
  const { category } = req.params;
  const { answer } = req.body;

  if (!answer || !answer.trim()) {
    return res.status(400).json({ error: "Answer cannot be empty" });
  }

  try {
    // ✅ Simple plagiarism detection
    const fileName = questionFiles[category.toLowerCase()];
    const filePath = fileName ? path.join(process.cwd(), "questions", fileName) : null;

    let plagiarismScore = 0;
    if (filePath && fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const questions = parseQuestions(content);
      const match = stringSimilarity.findBestMatch(answer, questions);
      plagiarismScore = match.bestMatch.rating; // 0–1
    }

    // ✅ AI evaluation
    const systemPrompt = `
You are an experienced evaluator for descriptive writing tests like bank exams.
Evaluate the student's answer fairly and objectively.
Respond only in JSON with:
{
  "marks": <0-10>,
  "maxMarks": 10,
  "feedback": {
    "strengths": "<2-3 lines>",
    "weaknesses": "<2-3 lines>",
    "suggestions": "<2-3 lines>"
  }
}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Category: ${category}\nStudent's Answer:\n${answer}` }
      ],
      temperature: 0.4,
      max_tokens: 600
    });

    const aiResponse = completion.choices?.[0]?.message?.content?.trim() || "";
    let parsed;
    try {
      parsed = JSON.parse(aiResponse);
    } catch {
      const match = aiResponse.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }

    if (!parsed) {
      parsed = {
        marks: 5,
        maxMarks: 10,
        feedback: {
          strengths: "Good attempt with relevant ideas.",
          weaknesses: "Needs improvement in structure.",
          suggestions: "Work on sentence flow and clarity."
        }
      };
    }

    // ✅ Apply plagiarism penalty
    if (plagiarismScore > 0.7) {
      parsed.marks = Math.max(0, parsed.marks - Math.round(plagiarismScore * 10 * 0.5));
      parsed.feedback.weaknesses += `\n⚠️ Possible plagiarism detected (similarity ${(plagiarismScore * 100).toFixed(1)}%). Marks reduced.`;
    }

    return res.json({
      marks: parsed.marks,
      maxMarks: parsed.maxMarks || 10,
      feedback: parsed.feedback,
      userAnswer: answer
    });
  } catch (err) {
    console.error("❌ Evaluation Error:", err);
    return res.status(500).json({ error: "Evaluation failed. Please try again." });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
