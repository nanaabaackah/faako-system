/* eslint-disable no-undef */
import "../runtimeEnv.js";
import fs from "fs";
import Papa from "papaparse";
import { prisma } from "../prismaClient.js";

const cleanText = (value) => (typeof value === "string" ? value.trim() : "");
const parseOrgId = () => {
  const envOrgId = Number(process.env.ORG_ID || "1");
  return Number.isFinite(envOrgId) && envOrgId > 0 ? envOrgId : 1;
};

async function resetVendorsFromCsv() {
  const organizationId = parseOrgId();
  const csv = fs.readFileSync("data/vendors.csv", "utf8");
  const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });

  const vendors = data
    .map((row) => ({
      organizationId,
      name: cleanText(row.name),
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
    }))
    .filter((row) => row.name);

  if (!vendors.length) {
    throw new Error("No vendors found in data/vendors.csv");
  }

  // Remove old product->vendor links first so vendor cleanup does not fail on FK.
  await prisma.product.updateMany({
    where: { organizationId, vendorId: { not: null } },
    data: { vendorId: null },
  });

  await prisma.vendor.deleteMany({ where: { organizationId } });
  await prisma.vendor.createMany({ data: vendors });

  console.log(
    `✅ Vendor list reset for organization ${organizationId}: ${vendors.length} vendors inserted`
  );
}

resetVendorsFromCsv()
  .catch((error) => {
    console.error("❌ Vendor reset failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
