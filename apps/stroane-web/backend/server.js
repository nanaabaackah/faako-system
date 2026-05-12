/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import prismaPkg from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  createApiRateLimitMiddleware,
  createCorsOriginValidator,
  createSecurityHeadersMiddleware,
  createUnsafeApiDefaultDenyMiddleware,
  resolveAllowedOrigins,
  resolveTrustProxySetting,
} from "./security.js";
import { createAuthRouter } from "./src/routes/auth.js";

dotenv.config();

const { PrismaClient } = prismaPkg;

// Initialize Prisma Client with PostgreSQL adapter
const connectionString = process.env.DATABASE_URL;

let prisma;
if (connectionString) {
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
} else {
  prisma = new PrismaClient();
}

const app = express();
const PORT = process.env.PORT || 3000;
const trustProxySetting = resolveTrustProxySetting(process.env);

app.disable("x-powered-by");
if (trustProxySetting) {
  app.set("trust proxy", trustProxySetting);
}

// CORS — only allow explicitly configured origins; fail closed in production.
const allowedOrigins = resolveAllowedOrigins(process.env);
app.use(
  cors({
    origin: createCorsOriginValidator({ allowedOrigins }),
    credentials: true,
  })
);
app.use(createSecurityHeadersMiddleware());
app.use(express.json({ limit: "1mb" }));
app.use("/api", createApiRateLimitMiddleware());

// Auth routes — registered before the default-deny middleware so POST/PATCH are allowed
app.use("/api/auth", createAuthRouter(prisma));

// All other /api routes: deny write methods until they are implemented
app.use("/api", createUnsafeApiDefaultDenyMiddleware());

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Product routes (skeleton)
app.get("/api/products", async (req, res) => {
  try {
    // TODO: Implement get all products
    res.json({ message: "Get all products - not implemented yet" });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    // TODO: Implement get product by id
    const id = Number.parseInt(String(req.params.id || ""), 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    res.json({ message: `Get product ${id} - not implemented yet` });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err?.statusCode || 500).json({
    error: err?.statusCode ? err.message : "Internal server error",
  });
});

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

// Start server
if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`Stroane backend server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  });
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});
