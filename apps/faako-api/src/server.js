import express from "express";
import cors from "cors";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { handler: signupHandler } = require("./signup.cjs");

const app = express();
const port = process.env.PORT || 4000;

app.use(
  cors({
    origin: [
      "http://localhost:5175",
      "http://localhost:5176",
      "http://localhost:8889",
      "https://faako.nanaabaackah.com",
    ],
  })
);

app.use(
  express.text({
    type: ["application/json", "application/x-www-form-urlencoded"],
    limit: "64kb",
  })
);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "faako-api" });
});

app.post("/api/signup", async (req, res) => {
  const result = await signupHandler({
    httpMethod: "POST",
    headers: req.headers,
    body: req.body,
  });

  Object.entries(result.headers || {}).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  return res.status(result.statusCode || 200).send(result.body || "");
});

app.listen(port, () => {
  console.log(`Faako API listening on ${port}`);
});