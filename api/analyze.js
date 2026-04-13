export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const title = (req.body?.title || "").trim();

  if (!title) {
    return res.status(400).json({ error: "Missing film title" });
  }

  try {
    const url = `${process.env.SUPABASE_URL}/rest/v1/films?slug=eq.${encodeURIComponent(title.toLowerCase())}&select=payload&limit=1`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    const rows = await response.json();
    const payload = rows?.[0]?.payload;

    if (!payload) {
      return res.status(404).json({ error: "Film not found in database" });
    }

    return res.status(200).json(payload);
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      details: err?.message || "Unknown error"
    });
  }
}
