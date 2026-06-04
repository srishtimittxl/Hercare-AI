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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "OpenAI API key not configured" });
    return;
  }

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

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!openaiRes.ok) {
      const err = await openaiRes.text();
      req.log.error({ status: openaiRes.status, err }, "OpenAI recommendations error");
      res.status(502).json({ error: "OpenAI request failed" });
      return;
    }

    const data = (await openaiRes.json()) as {
      choices: { message: { content: string } }[];
    };
    const content = data.choices[0]?.message?.content ?? "[]";

    let recommendations: unknown[];
    try {
      recommendations = JSON.parse(content);
    } catch {
      const match = content.match(/\[[\s\S]*\]/);
      recommendations = match ? JSON.parse(match[0]) : [];
    }

    res.json({ recommendations });
  } catch (err) {
    req.log.error({ err }, "Recommendations error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
