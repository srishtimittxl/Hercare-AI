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

  // 1. Detect which provider keys are set
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (groqKey || openaiKey) {
    // OpenAI/Groq Flow
    const apiKey = groqKey || openaiKey || "";
    const isGroq = apiKey.startsWith("gsk_");
    const baseUrl = isGroq ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1";
    const model = isGroq ? "llama-3.3-70b-versatile" : "gpt-4o-mini";

    try {
      const apiRes = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
          ],
          stream: true,
        }),
      });

      if (!apiRes.ok) {
        const err = await apiRes.text();
        req.log.error({ status: apiRes.status, err }, "OpenAI/Groq API error");
        res.status(502).json({ error: "AI request failed", detail: err });
        return;
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const reader = apiRes.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value));
      }

      res.end();
      return;
    } catch (err) {
      req.log.error({ err }, "OpenAI/Groq proxy error");
      res.status(500).json({ error: "Internal server error" });
      return;
    }
  }

  if (geminiKey) {
    // Gemini Flow (reverted to v1beta for systemInstructions support)
    const isOauthToken = geminiKey.startsWith("ya29.");
    const url = isOauthToken
      ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse`
      : `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${geminiKey}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (isOauthToken) {
      headers["Authorization"] = `Bearer ${geminiKey}`;
    } else {
      headers["x-goog-api-key"] = geminiKey;
    }

    try {
      const geminiRes = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          contents: messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
        }),
      });

      if (!geminiRes.ok) {
        const err = await geminiRes.text();
        req.log.error({ status: geminiRes.status, err }, "Gemini API error");
        res.status(502).json({ error: "Gemini request failed", detail: err });
        return;
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const reader = geminiRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf("\n");
        while (boundary !== -1) {
          const line = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 1);
          boundary = buffer.indexOf("\n");

          if (line.startsWith("data: ")) {
            const jsonText = line.slice(6).trim();
            try {
              const parsed = JSON.parse(jsonText);
              const textChunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (textChunk) {
                const openAiFormat = {
                  choices: [
                    {
                      delta: {
                        content: textChunk,
                      },
                    },
                  ],
                };
                res.write(`data: ${JSON.stringify(openAiFormat)}\n\n`);
              }
            } catch (e) {
              // Ignore parse errors from partial lines
            }
          }
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
      return;
    } catch (err) {
      req.log.error({ err }, "Gemini proxy error");
      res.status(500).json({ error: "Internal server error" });
      return;
    }
  }

  res.status(500).json({ error: "No API key configured on server" });
});

export default router;
