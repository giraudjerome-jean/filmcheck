import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const title = (req.body?.title || "").trim();

  if (!title) {
    return res.status(400).json({ error: "Missing film title" });
  }

  if (!process.env.SUPABASE_URL) {
    return res.status(500).json({ error: "SUPABASE_URL missing" });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY missing" });
  }

  try {
    const { data, error } = await supabase
      .from("films")
      .select("*")
      .limit(1);

    if (error) {
      return res.status(500).json({
        error: "Supabase query failed",
        details: error.message,
      });
    }

    return res.status(200).json({
      title,
      subtitle: "Supabase test OK",
      status: "Limited caution",
      status_class: "yellow",
      vigilance_index: 42,
      people_count: 1,
      confidence: "Low",
      generated_at: "2026-04-13",
      hero_note: "Supabase is reachable.",
      summary: "Temporary Supabase validation response.",
      summary_items: [
        "API route works",
        "Supabase credentials work",
        "films table is reachable"
      ],
      breakdown: {
        convictions: 0,
        proceedings: 0,
        accusations: 0,
        controversies: 0
      },
      people: [
        {
          name: "Supabase test",
          role: "System",
          tag: "Signal",
          tag_class: "yellow",
          desc: `Rows readable: ${Array.isArray(data) ? data.length : 0}`
        }
      ],
      sources: [
        {
          title: "Internal test",
          url: "https://example.com",
          domain: "example.com",
          note: "Supabase connectivity check"
        }
      ]
    });
  } catch (error) {
    return res.status(500).json({
      error: "Unexpected Supabase error",
      details: error?.message || "Unknown error"
    });
  }
}
