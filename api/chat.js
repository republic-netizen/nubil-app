// This runs on the server (Vercel), never in the student's browser.
// The API key stays here and is never sent to the frontend.

const SUBJECT_SYSTEM_PROMPTS = {
  General: "You are a patient, encouraging study tutor helping a student with any school subject.",
  Math: "You are a math tutor. Show reasoning step by step and check the student's own work when they share it.",
  Science: "You are a science tutor covering biology, chemistry, physics, and earth science. Use clear real-world analogies.",
  History: "You are a history tutor. Emphasize cause and effect, context, and how events connect.",
  Writing: "You are a writing and English tutor. Help with structure, grammar, clarity, and argument strength.",
  Languages: "You are a language-learning tutor. Help with vocabulary, grammar rules, and practice conversation.",
  "Test prep": "You are a test-prep tutor. Offer practice questions, explain reasoning, and point out common mistakes."
};

const SCOPE_AND_STYLE_RULES =
  "Answer only questions related to studying and schoolwork: subject explanations, homework help, " +
  "exam prep, study techniques, and academic concepts. If the student asks something unrelated to " +
  "studying (personal advice unrelated to school, entertainment, general chit-chat, or anything " +
  "outside academic subjects), politely decline and redirect them back to their studies in one short " +
  "sentence. Keep every answer concise and precise: get to the point in as few words as possible " +
  "while still being clear, use short sentences, avoid unnecessary repetition or filler, and favor " +
  "direct explanations over long-winded ones. Break multi-step problems into short numbered steps " +
  "rather than dense paragraphs. Prefer guiding the student toward the answer over just stating it " +
  "outright for homework-style questions, but keep the guidance brief.";

// Simple in-memory rate limiter. Resets when the function cold-starts, so it's
// not perfect, but it stops runaway costs from a single user hammering the API.
// For real production traffic, move this to a proper store (e.g. Redis/Upstash).
const requestLog = new Map();
const MAX_REQUESTS_PER_WINDOW = 20;
const WINDOW_MS = 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = requestLog.get(ip) || [];
  const recent = entry.filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  requestLog.set(ip, recent);
  return recent.length > MAX_REQUESTS_PER_WINDOW;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  if (isRateLimited(ip)) {
    res.status(429).json({ error: "Too many messages. Please wait a moment and try again." });
    return;
  }

  const { subject, messages, password } = req.body || {};

  if (!process.env.APP_PASSWORD) {
    res.status(500).json({ error: "Server is missing APP_PASSWORD. Set it in your deployment's environment variables." });
    return;
  }

  if (password !== process.env.APP_PASSWORD) {
    res.status(401).json({ error: "Incorrect password." });
    return;
  }

  // Password-check-only request from the gate screen — don't call the AI.
  if (req.body?.verifyOnly) {
    res.status(200).json({ ok: true });
    return;
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "Missing messages" });
    return;
  }

  // Cap history sent to the API to control cost and latency.
  const trimmedMessages = messages.slice(-20);

  const subjectPrompt = SUBJECT_SYSTEM_PROMPTS[subject] || SUBJECT_SYSTEM_PROMPTS.General;
  const systemPrompt = `${subjectPrompt} ${SCOPE_AND_STYLE_RULES}`;

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "Server is missing ANTHROPIC_API_KEY. Set it in your deployment's environment variables." });
    return;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 500,
        system: systemPrompt,
        messages: trimmedMessages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      res.status(response.status).json({ error: data?.error?.message || "AI service error" });
      return;
    }

    const textBlock = (data.content || []).find((b) => b.type === "text");
    res.status(200).json({ reply: textBlock ? textBlock.text : "" });
  } catch (err) {
    res.status(502).json({ error: "Could not reach the AI service. Please try again." });
  }
}
