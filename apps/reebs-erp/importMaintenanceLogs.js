/* eslint-disable no-undef */
import "./runtimeEnv.js";
import fs from "fs";
import Papa from "papaparse";
import { prisma } from "./prismaClient.js";

const shouldReset = process.env.IMPORT_RESET === "true";

const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

async function importMaintenanceLogs() {
  const filePath = "data/maintenance_logs.csv";
  if (!fs.existsSync(filePath)) {
    console.log("ℹ️  Maintenance log CSV missing; skipping import.");
    return;
  }

  const file = fs.readFileSync(filePath, "utf8");
  const { data } = Papa.parse(file, { header: true, skipEmptyLines: true });

  const products = await prisma.product.findMany({ select: { id: true, name: true } });
  const productByName = new Map(
    products.map((product) => [String(product.name || "").toLowerCase(), product.id])
  );

  const logsToCreate = [];

  for (const row of data) {
    const productName = cleanText(row.productName);
    const productId = productByName.get(productName.toLowerCase());
    if (!productId) continue;

    const issue = cleanText(row.issue);
    if (!issue) continue;

    const type = cleanText(row.type) || "repair";
    const costValue = Number(row.cost);
    const costCents = Number.isFinite(costValue) ? Math.max(0, Math.round(costValue * 100)) : 0;
    const status = cleanText(row.status).toLowerCase() || "open";
    const notes = cleanText(row.notes) || null;
    const createdAt = toDate(row.createdAt) || new Date();
    const resolvedAt = toDate(row.resolvedAt);

    logsToCreate.push({
      productId,
      issue,
      type,
      cost: costCents,
      status,
      notes,
      createdAt,
      resolvedAt,
      updatedAt: createdAt,
    });
  }

  if (!logsToCreate.length) {
    console.log("No maintenance logs to import.");
    return;
  }

  await prisma.maintenanceLog.createMany({ data: logsToCreate });

  const openProductIds = [
    ...new Set(logsToCreate.filter((log) => log.status === "open").map((log) => log.productId)),
  ];
  if (shouldReset && openProductIds.length) {
    await prisma.product.updateMany({
      where: { id: { in: openProductIds } },
      data: { isActive: false },
    });
  }

  console.log(`✅ Imported ${logsToCreate.length} maintenance logs.`);
}

importMaintenanceLogs()
  .catch((err) => {
    console.error("❌ Maintenance import failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
