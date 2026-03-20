/* eslint-disable no-undef */
import "./runtimeEnv.js";
import fs from "fs";
import Papa from "papaparse";
import { prisma } from "./prismaClient.js";

const shouldReset = process.env.IMPORT_RESET === "true";

const toCents = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
};

const parseDate = (value) => {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

async function importExpenses() {
  if (shouldReset) {
    await prisma.$executeRaw`TRUNCATE TABLE "expense" RESTART IDENTITY CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "maintenanceLog" RESTART IDENTITY CASCADE`;
    console.log("🔄 Cleared expenses and maintenance logs.");
  } else {
    await prisma.expense.deleteMany();
    await prisma.maintenanceLog.deleteMany();
    console.log("🔄 Cleared expenses and maintenance logs.");
  }

  const filePath = "data/expenses.csv";
  if (!fs.existsSync(filePath)) {
    console.log("ℹ️  Expense import disabled; CSV missing.");
    return;
  }

  const file = fs.readFileSync(filePath, "utf8");
  const { data } = Papa.parse(file, { header: true, skipEmptyLines: true });
  if (!data.length) {
    console.log("No expense rows to import.");
    return;
  }

  const orders = await prisma.order.findMany({
    select: { id: true, deliveryMethod: true },
  });
  const deliveryOrderIds = new Set(
    orders
      .filter((order) => !String(order.deliveryMethod || "").toLowerCase().includes("pickup"))
      .map((order) => order.id)
  );
  const bookingIds = new Set(
    (await prisma.booking.findMany({ select: { id: true } })).map((booking) => booking.id)
  );

  const rows = data.map((row) => ({
    category: row.category,
    amount: toCents(row.amount),
    description: row.description,
    date: parseDate(row.date),
    userId: row.userId ? Number(row.userId) : null,
    orderId: row.orderId ? Number(row.orderId) : null,
    bookingId: row.bookingId ? Number(row.bookingId) : null,
  }));

  const filtered = rows
    .filter((row) => row.category && row.description)
    .map((row) => {
      const orderId = Number.isFinite(row.orderId) ? row.orderId : null;
      const bookingId = Number.isFinite(row.bookingId) ? row.bookingId : null;
      return {
        ...row,
        orderId: orderId && deliveryOrderIds.has(orderId) ? orderId : null,
        bookingId: bookingId && bookingIds.has(bookingId) ? bookingId : null,
      };
    });
  if (!filtered.length) {
    console.log("No expense rows to import.");
    return;
  }

  await prisma.expense.createMany({ data: filtered });
  console.log(`✅ Imported ${filtered.length} expenses.`);
}

importExpenses()
  .catch((err) => {
    console.error("❌ Expense import failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
