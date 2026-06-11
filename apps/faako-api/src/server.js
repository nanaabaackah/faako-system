import express from "express";
import cors from "cors";
import { createRequire } from "node:module";
import {
  createFaakoApiSecurityHeadersMiddleware,
  isFaakoApiAllowedOrigin,
} from "./security/securityHeaders.js";

const require = createRequire(import.meta.url);
const { handler: signupHandler } = require("./signup.cjs");

const app = express();
const port = process.env.PORT || 8889;

app.disable("x-powered-by");
app.use(createFaakoApiSecurityHeadersMiddleware());
app.use(
  cors({
    origin: (origin, callback) => callback(null, isFaakoApiAllowedOrigin(origin)),
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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "faako-api" });
});

const handleSignup = async (req, res) => {
  const result = await signupHandler({
    httpMethod: "POST",
    headers: req.headers,
    body: req.body,
  });

  Object.entries(result.headers || {}).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  return res.status(result.statusCode || 200).send(result.body || "");
};

app.post(["/api/signup", "/signup"], handleSignup);

app.listen(port, () => {
  console.log(`Faako API listening on ${port}`);
});
