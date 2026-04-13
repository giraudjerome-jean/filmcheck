export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const title = (req.body?.title || "").trim();

  if (!title) {
    return res.status(400).json({ error: "Missing film title" });
  }

  return res.status(200).json({
    title,
    subtitle: "Backend test OK",
    status: "Limited caution",
    status_class: "yellow",
    vigilance_index: 42,
    people_count: 1,
    confidence: "Low",
    generated_at: "2026-04-13",
    hero_note: "The API route is working.",
    summary: "Temporary backend test.",
    summary_items: ["POST works", "Route works", "Render works"],
    breakdown: {
      convictions: 0,
      proceedings: 0,
      accusations: 0,
      controversies: 0
    },
    people: [
      {
        name: "Test person",
        role: "System",
        tag: "Signal",
        tag_class: "yellow",
        desc: "Temporary test response."
      }
    ],
    sources: [
      {
        title: "Test source",
        url: "https://example.com",
        domain: "example.com",
        note: "Temporary test source."
      }
    ]
  });
}
