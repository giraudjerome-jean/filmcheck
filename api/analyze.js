import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function safeJsonParse(text) {
  if (!text) return null;

  const cleaned = String(text)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(cleaned);
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

function normalizePeople(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(Boolean)
    .map((item) => ({
      name: item.name || "",
      role: item.role || "",
      tag: item.tag || "Signal",
      tag_class: item.tag_class || "yellow",
      desc: item.desc || "",
    }))
    .filter((item) => item.name);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function supabaseHeaders() {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function getExistingFilm(title) {
  const slug = slugify(title);
  const url =
    `${process.env.SUPABASE_URL}/rest/v1/films` +
    `?slug=eq.${encodeURIComponent(slug)}` +
    `&select=payload` +
    `&limit=1`;

  const response = await fetch(url, {
    method: "GET",
    headers: supabaseHeaders(),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Supabase GET failed: ${response.status} ${text}`);
  }

  let data = [];
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Supabase GET invalid JSON: ${text}`);
  }

  return data?.[0]?.payload || null;
}

async function saveFilm(payload) {
  const slug = slugify(payload.title);
  const url =
    `${process.env.SUPABASE_URL}/rest/v1/films?on_conflict=slug`;

  const body = [
    {
      slug,
      title: payload.title,
      status: payload.status || "Limited caution",
      score: Number(payload.vigilance_index || 0),
      payload,
      updated_at: new Date().toISOString(),
    },
  ];

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Supabase UPSERT failed: ${response.status} ${text}`);
  }
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
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured" });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Supabase environment variables are missing" });
  }

  try {
    const existing = await getExistingFilm(title);

    if (existing) {
      return res.status(200).json(existing);
    }

    const prompt = `
You are generating a FilmCheck film record.

Film title: ${title}

Use web search to research the film and return ONLY valid JSON.

Rules:
- status must be very short
- never return long editorial sentences in status
- keep descriptions concise
- be cautious with legal sensitivity
- separate convictions, proceedings, accusations, controversies

Return:
{
  "title": string,
  "subtitle": string,
  "status": "Low vigilance" | "Limited caution" | "Moderate caution" | "High caution",
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
`;

    const response = await openai.responses.create({
      model: "gpt-5.4",
      input: prompt,
      tools: [{ type: "web_search" }],
      max_output_tokens: 2500,
    });

    const text = response.output_text || "";
    const parsed = safeJsonParse(text);

    if (!parsed) {
      return res.status(502).json({ error: "Invalid JSON returned by OpenAI" });
    }

    const payload = {
      title: parsed.title || title,
      subtitle: parsed.subtitle || "",
      status: parsed.status || "Limited caution",
      status_class: parsed.status_class || "yellow",
      vigilance_index: Number(parsed.vigilance_index || 0),
      people_count: Number(parsed.people_count || 0),
      confidence: parsed.confidence || "Low",
      generated_at: parsed.generated_at || todayIsoDate(),
      hero_note: parsed.hero_note || parsed.summary || "",
      summary: parsed.summary || "",
      summary_items: Array.isArray(parsed.summary_items) ? parsed.summary_items.slice(0, 3) : [],
      breakdown: {
        convictions: Number(parsed?.breakdown?.convictions || 0),
        proceedings: Number(parsed?.breakdown?.proceedings || 0),
        accusations: Number(parsed?.breakdown?.accusations || 0),
        controversies: Number(parsed?.breakdown?.controversies || 0),
      },
      people: normalizePeople(parsed.people),
      sources: normalizeSources(parsed.sources),
    };

    if (!payload.people_count) {
      payload.people_count = payload.people.length;
    }

    await saveFilm(payload);

    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Unexpected server error",
    });
  }
}
