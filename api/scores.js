// Vercel Serverless Function: واسطه بین بازی و Firebase
// مرورگر فقط با همین سایت حرف می‌زند؛ ارتباط با Firebase از سمت سرور Vercel انجام می‌شود.
const DB = "https://tank-game-f0c38-default-rtdb.firebaseio.com";

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const url = `${DB}/scores.json?orderBy=${encodeURIComponent('"score"')}&limitToLast=10`;
      const r = await fetch(url);
      if (!r.ok) return res.status(502).json({ error: "firebase_read_failed", status: r.status });
      const data = (await r.json()) || {};
      const rows = Object.entries(data)
        .map(([key, v]) => ({ key, name: String(v.name || ""), score: Number(v.score) }))
        .sort((a, b) => b.score - a.score);
      return res.status(200).json(rows);
    }

    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") body = JSON.parse(body);
      const name = String((body && body.name) || "").trim().slice(0, 20) || "قهرمان";
      const score = Number(body && body.score);
      if (!Number.isInteger(score) || score < -30 || score > 70) {
        return res.status(400).json({ error: "invalid_score" });
      }
      const r = await fetch(`${DB}/scores.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, score, createdAt: { ".sv": "timestamp" } }),
      });
      if (!r.ok) return res.status(502).json({ error: "firebase_write_failed", status: r.status });
      const out = await r.json(); // { name: "-Nabc..." }
      return res.status(200).json({ key: out.name });
    }

    return res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    return res.status(500).json({ error: "server_error", message: String(e.message || e) });
  }
};
