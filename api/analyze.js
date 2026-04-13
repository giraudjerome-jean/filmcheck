import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeSources(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(Boolean)
    .map((item) => ({
      title: item.title || "",
      url: item.url || "",
      domain: item.domain || "",
      note: item.note || "",
    }))
    .filter((item) => item.title || item.url);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const title = (req.body?.title || "").trim();

  if (!title) {
    return res.status(400).json({ error: "Missing film title" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured on the server" });
  }

  try {
    const prompt = `
You are generating a FilmCheck film record.

Film title: ${title}

Use web search to research the film and return ONLY valid JSON.
Be careful with legal sensitivity:
- clearly separate convictions, proceedings, accusations, controversies
- do not overstate claims
- when uncertain, say so
- prefer a cautious, factual tone

Return this exact JSON shape:
{
  "title": string,
  "subtitle": string,
  "status": string,
  "status_class": "green" | "yellow" | "orange" | "red",
  "vigilance_index": number,
  "people_count": number,
  "confidence": "Low" | "Medium" | "High",
  "generated_at": string,
  "hero_note": string,
  "summary": string,
  "summary_items": [string, string, string],
  "breakdown": {
    "convictions": number,
    "proceedings": number,
    "accusations": number,
    "controversies": number
  },
  "people": [
    {
      "name": string,
      "role": string,
      "tag": string,
      "tag_class": "green" | "yellow" | "orange" | "red",
      "desc": string
    }
  ],
  "sources": [
    {
      "title": string,
      "url": string,
      "domain": string,
      "note": string
    }
  ]
}

If there is not enough reliable information, still return a conservative record with low confidence.
`;

    const response = await client.responses.create({
      model: "gpt-5.4",
      input: prompt,
      tools: [{ type: "web_search" }],
      max_output_tokens: 2500
    });

    const text = response.output_text || "";
    const parsed = safeJsonParse(text);

    if (!parsed) {
      return res.status(502).json({
        error: "The model did not return valid JSON. Try again or tighten the prompt."
      });
    }

    parsed.sources = normalizeSources(parsed.sources);
    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Unexpected server error"
    });
  }
}
