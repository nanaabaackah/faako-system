/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import prismaPkg from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

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

// Middleware
app.use(cors());
app.use(express.json());

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
    const { id } = req.params;
    res.json({ message: `Get product ${id} - not implemented yet` });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Stroane backend server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});
