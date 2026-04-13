export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const title = (req.body?.title || "").trim();

  if (!title) {
    return res.status(400).json({ error: "Missing film title" });
  }

  try {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/films?select=*&limit=1`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    const text = await response.text();

    if (!response.ok) {
      return res.status(500).json({
        error: "Supabase failed",
        details: text,
      });
    }

    return res.status(200).json({
      title,
      subtitle: "Supabase OK",
      status: "Limited caution",
      status_class: "yellow",
      vigilance_index: 42,
      people_count: 1,
      confidence: "Low",
      generated_at: "2026-04-13",
      hero_note: text,
      summary: "Supabase connection works",
      summary_items: ["Connected", "Query OK", "API OK"],
      breakdown: {
        convictions: 0,
        proceedings: 0,
        accusations: 0,
        controversies: 0,
      },
      people: [
        {
          name: "Supabase",
          role: "System",
          tag: "Signal",
          tag_class: "yellow",
          desc: "Connection test",
        },
      ],
      sources: [],
    });
  } catch (e) {
    return res.status(500).json({
      error: "Fetch crashed",
      details: e.message,
    });
  }
}
