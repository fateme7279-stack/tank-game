// Vercel Serverless Function: واسطه بین بازی و Firebase
// مرورگر فقط با همین سایت حرف می‌زند؛ ارتباط با Firebase از سمت سرور Vercel انجام می‌شود.
const DB = "https://tank-game-f0c38-default-rtdb.firebaseio.com";

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      // تلاش اول: خواندن ۱۰ امتیاز برتر با کوئری (نیاز به .indexOn در Rules دارد)
      let r = await fetch(`${DB}/scores.json?orderBy=${encodeURIComponent('"score"')}&limitToLast=10`);
      // تلاش دوم: اگر ایندکس تعریف نشده بود، همه را بخوان و خودمان مرتب کنیم
      if (!r.ok) r = await fetch(`${DB}/scores.json`);
      if (!r.ok) {
        const detail = (await r.text()).slice(0, 200);
        return res.status(502).json({ error: "firebase_read_failed", status: r.status, detail });
      }
      const data = (await r.json()) || {};
      const rows = Object.entries(data)
        .map(([key, v]) => ({ key, name: String((v && v.name) || ""), score: Number(v && v.score) }))
        .filter(x => Number.isFinite(x.score))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      return res.status(200).json(rows);
    }

    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") body = JSON.parse(body);
      body = body || {};
      const name = String(body.name || "").trim().slice(0, 20) || "قهرمان";
      const grade = String(body.grade || "").trim();
      const school = String(body.school || "").trim().slice(0, 40);
      const score = Number(body.score);
      const GRADES = ["اول", "دوم", "سوم", "چهارم", "پنجم", "ششم"];
      if (!Number.isInteger(score) || score < -30 || score > 70) {
        return res.status(400).json({ error: "invalid_score" });
      }
      if (!GRADES.includes(grade) || !school) {
        return res.status(400).json({ error: "invalid_grade_or_school" });
      }
      const post = (path, data) => fetch(`${DB}/${path}.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const createdAt = { ".sv": "timestamp" };

      // اطلاعات کامل (نام، پایه، مدرسه، امتیاز): خصوصی، فقط از کنسول Firebase دیده می‌شود
      const rp = await post("players", { name, grade, school, score, createdAt });
      if (!rp.ok) return res.status(502).json({ error: "firebase_write_failed", where: "players", status: rp.status });

      // فقط نام و امتیاز: عمومی، برای جدول برترین‌ها
      const rs = await post("scores", { name, score, createdAt });
      if (!rs.ok) return res.status(502).json({ error: "firebase_write_failed", where: "scores", status: rs.status });
      const out = await rs.json(); // { name: "-Nabc..." }
      return res.status(200).json({ key: out.name });
    }

    return res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    return res.status(500).json({ error: "server_error", message: String(e.message || e) });
  }
};
