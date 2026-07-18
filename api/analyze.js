import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

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

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
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

  const rows = safeJsonParse(text);
  if (!Array.isArray(rows)) {
    throw new Error(`Supabase GET invalid JSON: ${text}`);
  }

  return rows[0]?.payload || null;
}

async function saveFilm(payload) {
  const slug = slugify(payload.title);

  const url = `${process.env.SUPABASE_URL}/rest/v1/films?on_conflict=slug`;

  const row = {
    slug,
    title: payload.title,
    status: payload.status || "Limited caution",
    score: Number(payload.vigilance_index || 0),
    payload,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([row]),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Supabase UPSERT failed: ${response.status} ${text}`);
  }
}

function recordSearch(payload) {
  const previousCount = Number(payload?.search_count || 0);

  return {
    ...payload,
    search_count: Number.isFinite(previousCount) ? previousCount + 1 : 1,
    last_searched_at: new Date().toISOString(),
  };
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
    return res.status(500).json({ error: "OPENAI_API_KEY is missing" });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Supabase variables are missing" });
  }

  try {
    const existing = await getExistingFilm(title);

    if (existing) {
      const tracked = recordSearch(existing);

      // Search tracking must never prevent an existing film from loading.
      try {
        await saveFilm(tracked);
      } catch (trackingError) {
        console.error("FilmCheck search tracking failed", trackingError);
      }

      return res.status(200).json(tracked);
    }

    const prompt = `
You are generating a FilmCheck film record.

Film title: ${title}

Use web search and return ONLY valid JSON.

Important rules:
- keep the tone factual and cautious
- do not overstate accusations
- separate convictions, proceedings, accusations, controversies
- keep people descriptions short
- keep sources short
- make status short
- return concise, readable output

Return exactly this JSON shape:
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
      max_output_tokens: 2200,
    });

    const parsed = safeJsonParse(response.output_text || "");

    if (!parsed) {
      return res.status(502).json({ error: "OpenAI did not return valid JSON" });
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
      search_count: 1,
      last_searched_at: new Date().toISOString(),
    };

    if (!payload.people_count) {
      payload.people_count = payload.people.length;
    }

    await saveFilm(payload);

    return res.status(200).json(payload);
  } catch (err) {
    return res.status(500).json({
      error: err?.message || "Server error",
    });
  }
}
