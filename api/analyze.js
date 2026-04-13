export default async function handler(req, res) {
  try {
    const title = (req.body?.title || "").trim();

    if (!title) {
      return res.status(400).json({ error: "Missing film title" });
    }

    const url = `${process.env.SUPABASE_URL}/rest/v1/films?select=*&limit=1`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    const text = await response.text();

    return res.status(200).json({
      title,
      subtitle: "Supabase test",
      status: "Limited caution",
      status_class: "yellow",
      vigilance_index: 42,
      people_count: 1,
      confidence: "Low",
      generated_at: "2026-04-13",
      hero_note: `HTTP ${response.status} — ${text}`,
      summary: "Supabase request completed.",
      summary_items: ["Fetch completed", "Response received", "Debug mode"],
      breakdown: {
        convictions: 0,
        proceedings: 0,
        accusations: 0,
        controversies: 0
      },
      people: [
        {
          name: "Supabase debug",
          role: "System",
          tag: "Signal",
          tag_class: "yellow",
          desc: url
        }
      ],
      sources: []
    });

  } catch (err) {
    console.error("ERROR ANALYZE:", err);

    return res.status(500).json({
      error: err.message,
      stack: err.stack,
      supabaseUrl: process.env.SUPABASE_URL || "missing",
      keyPrefix: (process.env.SUPABASE_SERVICE_ROLE_KEY || "").slice(0, 12)
    });
  }
}
