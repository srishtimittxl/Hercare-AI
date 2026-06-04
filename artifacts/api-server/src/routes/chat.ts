import { Router } from "express";

const router = Router();

const SYSTEM_PROMPT = `You are HerCare AI, a compassionate and knowledgeable women's health assistant. You provide educational information about:
- Menstrual health and cycle tracking
- PMS and period symptoms
- Nutrition and exercise during different cycle phases
- PCOS awareness and related conditions
- General women's wellness

Always be warm, supportive, and non-judgmental. Always conclude responses that discuss medical topics with:
"This information is educational and not a medical diagnosis. Please consult a healthcare provider for personal medical advice."

Keep responses concise and easy to read. Use simple formatting.`;

router.post("/chat", async (req, res) => {
  const { messages } = req.body as {
    messages: { role: string; content: string }[];
  };

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "OpenAI API key not configured" });
    return;
  }

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
        max_tokens: 512,
      }),
    });

    if (!openaiRes.ok) {
      const err = await openaiRes.text();
      req.log.error({ status: openaiRes.status, err }, "OpenAI API error");
      res.status(502).json({ error: "OpenAI request failed", detail: err });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const reader = openaiRes.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }

    res.end();
  } catch (err) {
    req.log.error({ err }, "Chat proxy error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
