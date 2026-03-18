import { prisma } from '../prismaClient.js';
import fs from 'fs';
import Papa from 'papaparse';

async function main() {
  // Clear old data
  await prisma.inventory.deleteMany();

  // Read CSV file
  const file = fs.readFileSync('prisma/seed/inventory.csv', 'utf8');
  const { data } = Papa.parse(file, { header: true, skipEmptyLines: true });

  // Prepare data
  const items = data.map((record) => ({
    name: record.name,
    description: record.description,
    price: parseFloat(record.price),
    type: record.type,
    image_url: record.image_url,
    quantity: parseInt(record.quantity, 10),
    status: record.status,
  }));

  // Insert into DB
  await prisma.inventory.createMany({ data: items });
  console.log(`✅ Seeded ${items.length} items into Inventory table`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
