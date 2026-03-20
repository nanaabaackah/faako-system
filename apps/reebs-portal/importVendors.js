/* eslint-disable no-undef */
import "./runtimeEnv.js";
import fs from "fs";
import Papa from "papaparse";
import { prisma } from "./prismaClient.js";

const cleanText = (value) => (typeof value === "string" ? value.trim() : "");
const shouldReset = process.env.IMPORT_RESET === "true";

async function importVendors() {
  const file = fs.readFileSync("data/vendors.csv", "utf8");
  const { data } = Papa.parse(file, { header: true, skipEmptyLines: true });

  const existing = await prisma.vendor.findMany({
    select: {
      id: true,
      name: true,
      contactName: true,
      email: true,
      phone: true,
      mobileMoneyNumber: true,
      address: true,
      bankName: true,
      bankAccount: true,
      leadTimeDays: true,
      notes: true,
    },
  });
  const existingByName = new Map(
    existing.map((row) => [String(row.name || "").toLowerCase(), row])
  );

  const vendorsToCreate = [];
  let updated = 0;
  let skipped = 0;

  for (const row of data) {
    const name = cleanText(row.name);
    if (!name) {
      skipped += 1;
      continue;
    }

    const record = {
      name,
      contactName: cleanText(row.contactName) || null,
      email: cleanText(row.email) || null,
      phone: cleanText(row.phone) || null,
      mobileMoneyNumber: cleanText(row.mobileMoneyNumber) || null,
      address: cleanText(row.address) || null,
      bankName: cleanText(row.bankName) || null,
      bankAccount: cleanText(row.bankAccount) || null,
      leadTimeDays: Number.isFinite(Number(row.leadTimeDays))
        ? Math.max(0, Number(row.leadTimeDays))
        : null,
      notes: cleanText(row.notes) || null,
    };

    const existingVendor = existingByName.get(name.toLowerCase());
    if (!existingVendor) {
      vendorsToCreate.push(record);
      continue;
    }

    const updates = {};
    if (record.contactName && record.contactName !== existingVendor.contactName) {
      updates.contactName = record.contactName;
    }
    if (record.email && record.email !== existingVendor.email) {
      updates.email = record.email;
    }
    if (record.phone && record.phone !== existingVendor.phone) {
      updates.phone = record.phone;
    }
    if (record.mobileMoneyNumber && record.mobileMoneyNumber !== existingVendor.mobileMoneyNumber) {
      updates.mobileMoneyNumber = record.mobileMoneyNumber;
    }
    if (record.address && record.address !== existingVendor.address) {
      updates.address = record.address;
    }
    if (record.bankName && record.bankName !== existingVendor.bankName) {
      updates.bankName = record.bankName;
    }
    if (record.bankAccount && record.bankAccount !== existingVendor.bankAccount) {
      updates.bankAccount = record.bankAccount;
    }
    if (
      Number.isFinite(record.leadTimeDays) &&
      record.leadTimeDays !== existingVendor.leadTimeDays
    ) {
      updates.leadTimeDays = record.leadTimeDays;
    }
    if (record.notes && record.notes !== existingVendor.notes) {
      updates.notes = record.notes;
    }

    if (!shouldReset) {
      skipped += 1;
    } else if (Object.keys(updates).length) {
      await prisma.vendor.update({ where: { id: existingVendor.id }, data: updates });
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  if (vendorsToCreate.length) {
    await prisma.vendor.createMany({ data: vendorsToCreate });
  }

  console.log(
    `✅ Vendors imported: created ${vendorsToCreate.length}, updated ${updated}, skipped ${skipped}`
  );
}

importVendors()
  .catch((err) => {
    console.error("❌ Vendor import failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
