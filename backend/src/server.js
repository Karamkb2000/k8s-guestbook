const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const pool = new Pool({
  host: process.env.PGHOST || "database",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

async function init() {
  for (let i = 0; i < 30; i++) {
    try {
      await pool.query(
        "CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, author TEXT NOT NULL DEFAULT 'anon', text TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())"
      );
      const existing = await pool.query("SELECT COUNT(*)::int AS n FROM messages");
      if (existing.rows[0].n === 0) {
        await pool.query(
          "INSERT INTO messages (author, text) VALUES ($1, $2), ($3, $4), ($5, $6)",
          [
            "karam", "Welcome to the guestbook running on Kubernetes!",
            "ahmad", "The frontend proxies /api to the backend service by name.",
            "leen", "Messages are stored in Postgres with a PersistentVolume.",
          ]
        );
      }
      console.log("database ready");
      return;
    } catch (err) {
      console.log("waiting for database:", err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error("database not reachable");
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", pod: process.env.HOSTNAME || "unknown" });
});

app.get("/api/messages", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, author, text, created_at FROM messages ORDER BY id DESC LIMIT 50"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/messages", async (req, res) => {
  const text = (req.body.text || "").trim();
  const author = (req.body.author || "anon").trim() || "anon";
  if (!text) {
    return res.status(400).json({ error: "text is required" });
  }
  try {
    const result = await pool.query(
      "INSERT INTO messages (author, text) VALUES ($1, $2) RETURNING id, author, text, created_at",
      [author, text]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = Number(process.env.PORT || 3000);

init()
  .then(() => {
    app.listen(PORT, () => console.log(`backend listening on ${PORT}`));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
