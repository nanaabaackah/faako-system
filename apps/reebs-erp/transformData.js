/* eslint-disable no-undef */
import "./runtimeEnv.js";
// Import the configured client from your local file
import { prisma } from "./prismaClient.js"; 

async function transformData() {
  console.log("🚀 Starting FINAL Data Transformation (Old -> Product)...");
  
  // Helper to convert dollars (Float) to cents (Int) for the Product model
  const priceToCents = (price) => Math.round(price * 100);
  const now = new Date(); // <--- Use a single current timestamp for the migration run

  // --- 1. MIGRATE INVENTORY (Source: Inventory -> Destination: Product) ---
  console.log("\n📦 Processing 'Inventory' table...");
  const inventoryList = await prisma.inventory.findMany();
  
  for (const item of inventoryList) {
    await prisma.product.create({
      data: {
        sku: item.inventoryId,
        name: item.name,
        description: item.description || "General Shop Item",
        priceCents: priceToCents(item.price),
        currency: "GHS",
        stock: item.quantity,
        isActive: item.status.toLowerCase() === 'available' || item.status.toLowerCase() === 'active',
        imageUrl: item.image_url || null,
        updatedAt: now, // <--- FIX: Add the required updatedAt field
      },
    });
    console.log(`   -> Migrated Inventory: ${item.name} (${item.inventoryId})`);
  }

  // --- 2. MIGRATE RENTALS (Source: Rental -> Destination: Product) ---
  console.log("\n🎪 Processing 'Rental' table...");
  const rentalList = await prisma.rental.findMany();

  for (const item of rentalList) {
    const calculatedPrice = item.price || 0;

    await prisma.product.create({
      data: {
        sku: item.rentalId,
        name: item.name,
        description: `${item.category} rental. Rate: ${item.rate}`,
        priceCents: priceToCents(calculatedPrice),
        currency: "GHS",
        stock: item.quantity,
        isActive: item.status.toLowerCase() === 'available' || item.status.toLowerCase() === 'active',
        imageUrl: item.image || null,
        updatedAt: now, // <--- FIX: Add the required updatedAt field
      },
    });
    console.log(`   -> Migrated Rental: ${item.name} (${item.rentalId})`);
  }

  // --- 3. MIGRATE BOUNCY CASTLES (Source: BouncyCastle -> Destination: Product) ---
  console.log("\n🏰 Processing 'BouncyCastle' table...");
  const castleList = await prisma.bouncyCastle.findMany();

  for (const item of castleList) {
    let extractedPrice = 0;
    if (item.priceRange) {
      const match = item.priceRange.match(/(\d+)/); 
      if (match) extractedPrice = parseFloat(match[0]);
    }

    const fullDescription = `Bouncy Castle: ${item.name}. Best for: ${item.bestFor}. Features: ${item.features}`;

    await prisma.product.create({
      data: {
        sku: item.bouncerId,
        name: item.name,
        description: fullDescription,
        priceCents: priceToCents(extractedPrice),
        currency: "GHS",
        stock: 1, 
        isActive: true,
        imageUrl: item.image || (item.images.length > 0 ? item.images[0] : null),
        updatedAt: now, // <--- FIX: Add the required updatedAt field
      },
    });
    console.log(`   -> Migrated Castle: ${item.name} (${item.bouncerId})`);
  }

  console.log("\n✅ TRANSFORMATION COMPLETE! All old inventory moved to 'Product' table.");
}

transformData()
  .catch((e) => {
    console.error("❌ Error during transformation:", e);
    process.exit(1);
  })
  .finally(async () => {
    // Only disconnect the prisma client
    await prisma.$disconnect();
    console.log("Disconnected Prisma Client.");
  });