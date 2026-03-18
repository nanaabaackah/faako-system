/* eslint-disable no-undef */
import "./runtimeEnv.js";
import { prisma } from "./prismaClient.js";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse";
import { hashPassword } from "./utils/passwords.js";

const shouldReset = process.env.IMPORT_RESET === "true";
const SYSTEM_ADMIN_EMAIL = "system_admin@reebs.com";

const readCsv = (filePath) =>
  new Promise((resolve, reject) => {
    const fullPath = path.resolve(filePath);
    fs.readFile(fullPath, { encoding: "utf8" }, (err, data) => {
      if (err) return reject(err);
      parse(
        data,
        {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
          relax_quotes: true,
        },
        (parseErr, records) => {
          if (parseErr) return reject(parseErr);
          resolve(records);
        }
      );
    });
  });

const readCsvOptional = async (filePath) => {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return [];
  return readCsv(filePath);
};

const cleanNamePart = (value) => (typeof value === "string" ? value.trim() : "");

const buildEmailFromNames = (firstName, lastName) => {
  const first = cleanNamePart(firstName).replace(/\s+/g, "").toLowerCase();
  const last = cleanNamePart(lastName).replace(/\s+/g, "").toLowerCase();
  if (!first || !last) return null;
  return `${first}_${last}@reebs.com`;
};

const buildFullName = (firstName, lastName) => {
  const parts = [cleanNamePart(firstName), cleanNamePart(lastName)].filter(Boolean);
  return parts.join(" ").trim();
};

const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

const parsePermissions = (value) => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* ignore */
  }
  return null;
};

const profileDefaults = (jobTitle, phone, emergencyContactName, emergencyContactPhone) => ({
  jobTitle: jobTitle || "Team Member",
  phone: phone || "0244000000",
  emergencyContactName: emergencyContactName || "Reebs Support",
  emergencyContactPhone: emergencyContactPhone || "0201000000",
});

const buildSecretsIndex = (rows) => {
  const byId = new Map();
  const byEmail = new Map();
  for (const row of rows) {
    const id = row.id ? parseInt(row.id, 10) : NaN;
    const email = cleanText(row.email).toLowerCase();
    const password = cleanText(row.password);
    if (!password) continue;
    if (Number.isFinite(id)) byId.set(id, password);
    if (email) byEmail.set(email, password);
  }
  return { byId, byEmail };
};

const resolvePassword = (row, email, secretsIndex) => {
  const inline = cleanText(row.password);
  if (inline) return inline;
  const id = row.id ? parseInt(row.id, 10) : NaN;
  if (Number.isFinite(id) && secretsIndex.byId.has(id)) {
    return secretsIndex.byId.get(id);
  }
  const emailKey = cleanText(email).toLowerCase();
  if (emailKey && secretsIndex.byEmail.has(emailKey)) {
    return secretsIndex.byEmail.get(emailKey);
  }
  return "";
};

async function importVendors() {
  const vendorData = await readCsv("data/vendors.csv");
  if (!vendorData.length) {
    console.log("No vendors found in data/vendors.csv");
    return { created: 0, skipped: 0 };
  }

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

  for (const row of vendorData) {
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

  return { created: vendorsToCreate.length, updated, skipped };
}

const assignVendorItems = async () => {
  if (!shouldReset) {
    console.log("ℹ️  IMPORT_RESET not set. Skipping vendor assignment updates.");
    return;
  }
  const vendors = await prisma.vendor.findMany({
    where: { name: { in: ["EventPro Logistics", "Castle World Rentals", "G-Water Supplies"] } },
    select: { id: true, name: true },
  });

  const vendorMap = new Map(vendors.map((vendor) => [vendor.name, vendor.id]));
  const eventProId = vendorMap.get("EventPro Logistics");
  const castleWorldId = vendorMap.get("Castle World Rentals");
  const waterVendorId = vendorMap.get("G-Water Supplies");

  if (!eventProId && !castleWorldId && !waterVendorId) {
    console.log("No vendors found for item assignment.");
    return;
  }

  if (eventProId) {
    const eventProResult = await prisma.product.updateMany({
      where: {
        vendorId: null,
        OR: [
          { name: { contains: "table", mode: "insensitive" } },
          { name: { contains: "chair", mode: "insensitive" } },
          { name: { contains: "tent", mode: "insensitive" } },
          { name: { contains: "canop", mode: "insensitive" } },
        ],
      },
      data: { vendorId: eventProId },
    });
    console.log(`Assigned EventPro Logistics to ${eventProResult.count} products.`);
  }

  if (castleWorldId) {
    const castleWorldResult = await prisma.product.updateMany({
      where: {
        vendorId: null,
        OR: [
          { name: { contains: "double sided slide", mode: "insensitive" } },
          { name: { contains: "double-sided slide", mode: "insensitive" } },
          { name: { contains: "double sided", mode: "insensitive" } },
        ],
      },
      data: { vendorId: castleWorldId },
    });
    console.log(`Assigned Castle World Rentals to ${castleWorldResult.count} products.`);
  }

  if (waterVendorId) {
    const waterResult = await prisma.product.updateMany({
      where: {
        vendorId: null,
        OR: [
          { name: { contains: "g-water", mode: "insensitive" } },
          { name: { contains: "g water", mode: "insensitive" } },
        ],
      },
      data: { vendorId: waterVendorId },
    });
    console.log(`Assigned G-Water Supplies to ${waterResult.count} products.`);
  }
};

async function importUsers() {
  const usersData = await readCsv("data/users.csv");
  const secretsIndex = buildSecretsIndex(await readCsvOptional("data/users.secrets.csv"));
  console.log(`Found ${usersData.length} users in data/users.csv`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let profilesUpserted = 0;

  for (const row of usersData) {
    const id = row.id ? parseInt(row.id, 10) : undefined;
    const firstName = cleanNamePart(row.firstName);
    const lastName = cleanNamePart(row.lastName);
    const fullName = buildFullName(firstName, lastName);
    const email = buildEmailFromNames(firstName, lastName);
    const role = cleanNamePart(row.role) || "Staff";
    const rawPassword = resolvePassword(row, email, secretsIndex);
    const parsedPermissions = parsePermissions(row.permissions);
    const jobTitle = cleanText(row.jobTitle) || null;
    const phone = cleanText(row.phone) || null;
    const emergencyContactName = cleanText(row.emergencyContactName) || null;
    const emergencyContactPhone = cleanText(row.emergencyContactPhone) || null;
    const isSystemAdmin = email === SYSTEM_ADMIN_EMAIL;
    const profileInfo = profileDefaults(jobTitle, phone, emergencyContactName, emergencyContactPhone);
    const hasProfileData = !isSystemAdmin;

    if (!firstName || !lastName) {
      console.warn("Skipping row without first/last name:", row);
      skipped += 1;
      continue;
    }
    if (!email) {
      console.warn("Skipping row without generated email:", row);
      skipped += 1;
      continue;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    let userId = existing?.id;
    if (existing) {
      const updates = {};
      if (existing.firstName !== firstName) updates.firstName = firstName;
      if (existing.lastName !== lastName) updates.lastName = lastName;
      if (existing.fullName !== fullName) updates.fullName = fullName;
      if (existing.role !== role) updates.role = role;
      if (parsedPermissions && JSON.stringify(existing.permissions || {}) !== JSON.stringify(parsedPermissions)) {
        updates.permissions = parsedPermissions;
      }

      if (Object.keys(updates).length) {
        const updatedUser = await prisma.user.update({ where: { email }, data: updates });
        userId = updatedUser.id;
        updated += 1;
      } else {
        skipped += 1;
      }

      if (hasProfileData && userId) {
        await prisma.employeeProfile.upsert({
          where: { userId },
          create: { userId, ...profileInfo },
          update: profileInfo,
        });
        profilesUpserted += 1;
      }
      continue;
    }

    if (!rawPassword) {
      console.warn(
        `Skipping ${fullName} because password is missing (set data/users.secrets.csv or data/users.csv).`
      );
      skipped += 1;
      continue;
    }

    const passwordHash = await hashPassword(rawPassword);
    const userData = {
      email,
      password: passwordHash,
      firstName,
      lastName,
      fullName,
      role,
      permissions: parsedPermissions || {},
    };

    if (Number.isFinite(id)) {
      userData.id = id;
    }

    const createdUser = await prisma.user.create({ data: userData });
    userId = createdUser.id;
    created += 1;

    if (hasProfileData && userId) {
      await prisma.employeeProfile.create({
        data: { userId, ...profileInfo },
      });
      profilesUpserted += 1;
    }
  }

  console.log(
    `✅ Users created: ${created}, updated: ${updated}, skipped: ${skipped}, profiles upserted: ${profilesUpserted}`
  );

  const vendorSummary = await importVendors();
  console.log(
    `✅ Vendors imported: created ${vendorSummary.created}, updated ${vendorSummary.updated}, skipped ${vendorSummary.skipped}`
  );

  await assignVendorItems();
}

importUsers()
  .catch((err) => {
    console.error("❌ User import failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
