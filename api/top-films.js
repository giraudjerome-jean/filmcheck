function supabaseHeaders() {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Number(value || 0)));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Supabase variables are missing" });
  }

  try {
    const url =
      `${process.env.SUPABASE_URL}/rest/v1/films` +
      "?select=slug,title,status,score,payload" +
      "&order=score.desc" +
      "&limit=100";

    const response = await fetch(url, {
      method: "GET",
      headers: supabaseHeaders(),
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Supabase ranking failed: ${response.status} ${text}`);
    }

    const rows = JSON.parse(text);

    if (!Array.isArray(rows)) {
      throw new Error("Supabase ranking returned invalid data");
    }

    const films = rows
      .map((row) => {
        const rawScore = clampScore(
          row.score ?? row.payload?.vigilance_index
        );
        const storedSearchCount = Number(row.payload?.search_count || 0);
        const searchCount = Number.isFinite(storedSearchCount)
          ? Math.max(1, storedSearchCount)
          : 1;
        const searchWeight = Math.min(
          10,
          Math.log2(searchCount) * 2
        );

        return {
          slug: row.slug || "",
          title: row.title || row.payload?.title || "",
          score: 100 - rawScore,
          raw_score: rawScore,
          ranking_score: rawScore + searchWeight,
          search_count: searchCount,
          status: row.status || row.payload?.status || "",
        };
      })
      .filter((film) => film.title)
      .sort((a, b) => {
        if (b.ranking_score !== a.ranking_score) {
          return b.ranking_score - a.ranking_score;
        }

        if (b.raw_score !== a.raw_score) {
          return b.raw_score - a.raw_score;
        }

        if (b.search_count !== a.search_count) {
          return b.search_count - a.search_count;
        }

        return a.title.localeCompare(b.title);
      })
      .slice(0, 5)
      .map(({ raw_score, ranking_score, ...film }) => film);

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300"
    );

    return res.status(200).json({ films });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Unable to load ranking",
    });
  }
}
