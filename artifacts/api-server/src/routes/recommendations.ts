import { Router } from "express";

const router = Router();

router.post("/recommendations", async (req, res) => {
  const { phase, cycleDay, recentMoods, recentSymptoms, healthProfile } = req.body as {
    phase: string;
    cycleDay: number | null;
    recentMoods: string[];
    recentSymptoms: { symptom: string; severity: string }[];
    healthProfile: {
      periodRegularity: string;
      typicalFlow: string;
      averageCycleLength: number;
      ageGroup: string;
      conditions: string[];
      dietType: string;
      name: string;
    };
  };

  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const conditionText =
    healthProfile.conditions?.length > 0 && !healthProfile.conditions.includes("None")
      ? `Known conditions: ${healthProfile.conditions.join(", ")}.`
      : "No known conditions.";

  const moodText =
    recentMoods.length > 0
      ? `Recent moods: ${recentMoods.slice(0, 5).join(", ")}.`
      : "No recent mood data.";

  const symptomText =
    recentSymptoms.length > 0
      ? `Recent symptoms: ${recentSymptoms
          .slice(0, 5)
          .map((s) => `${s.symptom} (${s.severity})`)
          .join(", ")}.`
      : "No recent symptom data.";

  const prompt = `You are a women's health expert with deep knowledge of Ayurveda and Indian nutrition.

User profile:
- Name: ${healthProfile.name || "User"}
- Age group: ${healthProfile.ageGroup || "Unknown"}
- Period regularity: ${healthProfile.periodRegularity || "Unknown"}
- Typical flow: ${healthProfile.typicalFlow || "Unknown"}
- Average cycle length: ${healthProfile.averageCycleLength || 28} days
- Diet type: ${healthProfile.dietType || "Vegetarian"}
- ${conditionText}

Current cycle data:
- Phase: ${phase || "Unknown"}
- Cycle day: ${cycleDay ?? "Unknown"}
- ${moodText}
- ${symptomText}

Generate exactly 4 personalized wellness recommendations for this woman based on her current cycle phase and health profile. Focus heavily on:
1. Indian foods and ingredients (dal, sabzi, roti, rice, ghee, turmeric, ajwain, methi, jaggery, coconut, etc.) suited to her diet type
2. Ayurvedic herbs and home remedies common in Indian households
3. Specific exercises appropriate for the phase
4. Self-care practices

Respond ONLY with a valid JSON array of exactly 4 objects. No markdown. No extra text. Each object:
{
  "title": "short title (3-5 words)",
  "description": "2-3 sentence actionable advice with specific Indian food names or practices",
  "category": one of "diet" | "exercise" | "self-care" | "supplement",
  "icon": one of "coffee" | "sun" | "moon" | "activity" | "heart" | "zap" | "droplet" | "leaf"
}`;

  if (groqKey || openaiKey) {
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
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }),
      });

      if (!apiRes.ok) {
        const err = await apiRes.text();
        req.log.error({ status: apiRes.status, err }, "OpenAI/Groq recommendations API error");
        res.status(502).json({ error: "AI request failed" });
        return;
      }

      const data = (await apiRes.json()) as any;
      const content = data.choices?.[0]?.message?.content ?? "[]";

      let recommendations: unknown[];
      try {
        recommendations = JSON.parse(content);
      } catch {
        const match = content.match(/\[[\s\S]*\]/);
        recommendations = match ? JSON.parse(match[0]) : [];
      }

      // Handle wrapper object if LLM returned { "recommendations": [...] } instead of raw array
      if (recommendations && !Array.isArray(recommendations) && typeof recommendations === "object") {
        const keys = Object.keys(recommendations);
        if (keys.length === 1 && Array.isArray((recommendations as any)[keys[0]])) {
          recommendations = (recommendations as any)[keys[0]];
        }
      }

      res.json({ recommendations });
      return;
    } catch (err) {
      req.log.error({ err }, "OpenAI/Groq recommendations error");
      res.status(500).json({ error: "Internal server error" });
      return;
    }
  }

  if (geminiKey) {
    const isOauthToken = geminiKey.startsWith("ya29.");
    const url = isOauthToken
      ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
      : `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;

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
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      });

      if (!geminiRes.ok) {
        const err = await geminiRes.text();
        req.log.error({ status: geminiRes.status, err }, "Gemini recommendations error");
        res.status(502).json({ error: "Gemini request failed" });
        return;
      }

      const data = (await geminiRes.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";

      let recommendations: unknown[];
      try {
        recommendations = JSON.parse(content);
      } catch {
        const match = content.match(/\[[\s\S]*\]/);
        recommendations = match ? JSON.parse(match[0]) : [];
      }

      // Handle wrapper object if LLM returned { "recommendations": [...] }
      if (recommendations && !Array.isArray(recommendations) && typeof recommendations === "object") {
        const keys = Object.keys(recommendations);
        if (keys.length === 1 && Array.isArray((recommendations as any)[keys[0]])) {
          recommendations = (recommendations as any)[keys[0]];
        }
      }

      res.json({ recommendations });
      return;
    } catch (err) {
      req.log.error({ err }, "Gemini recommendations error");
      res.status(500).json({ error: "Internal server error" });
      return;
    }
  }

  res.status(500).json({ error: "No API key configured on server" });
});

export default router;
