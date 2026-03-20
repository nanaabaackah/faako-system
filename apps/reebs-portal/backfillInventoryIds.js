import { prisma } from "./prismaClient.js";

async function backfillInventoryIds() {
  try {
    // Find the highest inventoryId already assigned
    const lastItem = await prisma.inventory.findFirst({
      where: { inventoryId: { not: null } },
      orderBy: { inventoryId: "desc" },
    });

    let nextId = lastItem ? lastItem.inventoryId + 1 : 1;

    // Get all items missing an inventoryId
    const itemsWithoutId = await prisma.inventory.findMany({
      where: { inventoryId: null },
    });

    console.log(`Found ${itemsWithoutId.length} records without inventoryId.`);

    for (const item of itemsWithoutId) {
      await prisma.inventory.update({
        where: { id: item.id },
        data: { inventoryId: nextId++ },
      });
    }

    console.log("✅ Backfill complete!");
  } catch (err) {
    console.error("❌ Error backfilling inventory IDs:", err);
  } finally {
    await prisma.$disconnect();
  }
}

backfillInventoryIds();
