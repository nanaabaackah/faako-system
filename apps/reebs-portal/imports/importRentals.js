import "../runtimeEnv.js";
import fs from "fs";
import Papa from "papaparse";
import { prisma } from "../prismaClient.js";

/**
 * Generate the next rental ID in sequence (e.g., REN-1001, REN-1002, etc.)
 */
async function generateNextRentalId() {
  const lastRental = await prisma.rental.findFirst({
    orderBy: { id: "desc" },
    select: { rentalId: true },
  });

  if (!lastRental || !lastRental.rentalId) {
    return "REN-1001"; // Starting point
  }

  const lastNumber = parseInt(lastRental.rentalId.replace("REN-", ""), 10);
  return `REN-${lastNumber + 1}`;
}

/**
 * Main importer function — reads CSV and populates database
 */
async function importData() {
  try {
    const fileContent = fs.readFileSync("rentals.csv", "utf-8");
    const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });

    for (const record of parsed.data) {
      const nextRentalId = await generateNextRentalId();

      // Skip duplicate rentalIds or names
      const exists = await prisma.rental.findFirst({
        where: { name: record.name },
      });

      if (exists) {
        console.log(`Skipping duplicate: ${record.name}`);
        continue;
      }

      await prisma.rental.create({
        data: {
          rentalId: nextRentalId,
          name: record.name,
          quantity: record.quantity ? parseInt(record.quantity, 10) : 0,
          price: record.price ? parseFloat(record.price) : 0,
          rate: record.rate || "per head",
          status: record.status || "available",
          category: record.category || "Kid's Party Rentals",
          image: record.image || null,
          page: record.page || null,
        },
      });

      console.log(`Added rental: ${record.name} (${nextRentalId})`);
    }

    console.log("Rentals imported successfully!");
  } catch (err) {
    console.error("Error importing rentals:", err);
  } finally {
    await prisma.$disconnect();
  }
}

importData();
