import express from "express";
import cors from "cors";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors({
  origin: [
    "http://localhost:5176",
    "http://localhost:8889",
    "https://faako.nanaabaackah.com"
  ]
}));

app.use(express.json({ limit: "64kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "faako-api" });
});

app.post("/api/signup", async (req, res) => {
  res.status(501).json({
    ok: false,
    error: "Signup endpoint not migrated yet"
  });
});

app.listen(port, () => {
  console.log(`Faako API listening on ${port}`);
});