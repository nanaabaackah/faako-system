/* eslint-disable no-undef */
// Filename: importData.js (FINAL VERSION with 'specificCategory' column)

import "../runtimeEnv.js";
import { prisma } from "../prismaClient.js"; 
import fs from 'fs';
import path from 'path';
// Ensure you have installed this package: npm install csv-parse
import { parse } from 'csv-parse'; 

const shouldReset = process.env.IMPORT_RESET === "true";

// --- Helper Functions ---

// 1. Convert Price to Cents
const priceToCents = (price) => {
    if (price === null || price === undefined) return 0;
    const priceFloat = parseFloat(String(price).replace(/[^0-9.-]+/g,""));
    if (isNaN(priceFloat)) return 0;
    return Math.round(priceFloat * 100); 
};

// 2. Parse Rental Price
const parseRentalPrice = (priceStr) => {
    if (!priceStr || String(priceStr).toLowerCase().includes('contact')) return 0.0;
    
    const s = String(priceStr).trim();
    
    // Check for ranges (e.g., '700 - 1500') and take the lower bound
    const matchRange = s.match(/(\d+)\s*-\s*(\d+)/);
    if (matchRange) {
        return parseFloat(matchRange[1]);
    }

    // Check for a single number
    const matchSingle = s.match(/^(\d+(\.\d+)?)/);
    if (matchSingle) {
        return parseFloat(matchSingle[1]);
    }
        
    return 0.0;
};

const parseAttendants = (value) => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
};

// 3. Status Check
const statusToActive = (status_str) => {
    if (!status_str) return false;
    return ['available', 'active', 'in stock'].includes(String(status_str).toLowerCase());
};

// 4. Age Generation Function
const generateAge = (name, category) => {
    const n = String(name).toLowerCase();
    const c = String(category).toLowerCase();
    
    if (c.includes("kid's toys")) {
        if (n.includes('baby') || n.includes('toddler') || n.includes('infunbebe')) {
            return "6m+"; 
        }
        if (n.includes('blocks') || n.includes('foam') || n.includes('slime')) {
            return "1+"; 
        }
        if (n.includes('dress up') || n.includes('action figure') || n.includes('monster trucks') || n.includes('police car')) {
            return "4+"; 
        }
        return "3+"; 
    }

    if (c.includes("kid's party rentals") || n.includes('trampoline') || n.includes('castle')) {
        return "3+"; 
    }

    return "All Ages"; 
};

// --- Core Logic ---

// Function to read and parse a CSV file with relaxed rules for robustness
function readCsv(filePath) {
    return new Promise((resolve, reject) => {
        const fullPath = path.resolve(filePath);
        fs.readFile(fullPath, { encoding: 'utf8' }, (err, data) => {
            if (err) return reject(err);

            parse(data, {
                columns: true, 
                skip_empty_lines: true,
                trim: true,
                relax_column_count: true, 
                relax_quotes: true,       
            }, (err, records) => {
                if (err) return reject(err);
                resolve(records);
            });
        });
    });
}

// Function to perform the full import
async function importProducts() {
    console.log("🚀 Starting Product Data Import from CSVs...");
    const now = new Date();

    const vendorRows = await prisma.vendor.findMany({
        where: { name: { in: ["EventPro Logistics", "Castle World Rentals", "G-Water Supplies"] } },
        select: { id: true, name: true },
    });
    const vendorMap = new Map(vendorRows.map((vendor) => [vendor.name, vendor.id]));
    const resolveVendorId = (name) => {
        const value = String(name || "").toLowerCase();
        if (value.includes("g-water") || value.includes("g water")) {
            return vendorMap.get("G-Water Supplies") || null;
        }
        if (value.includes("chair") || value.includes("table") || value.includes("tent") || value.includes("canop")) {
            return vendorMap.get("EventPro Logistics") || null;
        }
        if (value.includes("bouncer") || value.includes("slide") || value.includes("castle")) {
            return vendorMap.get("Castle World Rentals") || null;
        }
        return null;
    };
    
    // 1. Read Data
    const inventoryData = await readCsv('data/inventory.csv');
    const outsourcedInventoryData = await readCsv('data/inventory_outsourced.csv');
    const rentalData = await readCsv('data/rentals.csv');
    const vendorRentalData = await readCsv('data/vendor_rentals.csv');
    const motorPumpData = await readCsv('data/motor_pumps.csv');

    console.log(
        `\nFound ${inventoryData.length} inventory items, ${outsourcedInventoryData.length} outsourced inventory items, ${rentalData.length} rental items, ${vendorRentalData.length} vendor rental items, and ${motorPumpData.length} motor pump items.`
    );

    // 2. Transform Inventory Data
    const transformedInventory = inventoryData
        .filter(row => row.name && row.description && row.price)
        .map((row, i) => ({
            sku: `INV-${String(i + 1).padStart(4, '0')}`,
            name: row.name,
            // Only the original description, category info moved to 'specificCategory'
            description: row.description, 
            sourceCategoryCode: "Inventory",
            specificCategory: row.type, // NEW MAPPING
            rate: null,
            page: null,
            age: generateAge(row.name, row.type),
            price: priceToCents(row.price),
            currency: "GHS",
            stock: parseInt(row.quantity, 10) || 0,
            isActive: statusToActive(row.status),
            imageUrl: row.image_url || null,
            updatedAt: now,
        }));

    const transformedOutsourcedInventory = outsourcedInventoryData
        .filter(row => row.name && row.price)
        .map((row, i) => {
            const rawSource = row.sourceCategoryCode || row.sourcecategorycode || row.source || "";
            const sourceCategoryCode = rawSource ? String(rawSource).trim().toUpperCase() : "WATER";
            const vendorLabel = row.vendorName || row.vendor || row.name;
            const vendorId = resolveVendorId(vendorLabel);
            return {
                sku: `OUT-${String(i + 1).padStart(4, '0')}`,
                name: row.name,
                description: row.description || "Outsourced inventory item.",
                sourceCategoryCode: sourceCategoryCode,
                specificCategory: row.type || "Party Supplies",
                rate: null,
                page: null,
                age: generateAge(row.name, row.type || "Party Supplies"),
                price: priceToCents(row.price),
                currency: "GHS",
                stock: parseInt(row.quantity, 10) || 0,
                isActive: statusToActive(row.status),
                imageUrl: row.image_url || null,
                updatedAt: now,
                vendorId: Number.isFinite(vendorId) ? vendorId : null,
            };
        });

    // 3. Transform Rental Data
    const transformedRentals = rentalData.map((row, i) => {
        const priceFloat = parseRentalPrice(row.price);
        const generatedDescription = `Ideal for ${row.category} events for kids ${generateAge(row.name, row.category)}.`;

        return {
            sku: `RNTL-${String(i + 1).padStart(4, '0')}`,
            name: row.name,
            description: generatedDescription, 
            sourceCategoryCode: "Rental",
            specificCategory: row.category, // NEW MAPPING
            rate: row.rate || null,
            page: row.page || null,
            age: generateAge(row.name, row.category),
            price: priceToCents(priceFloat),
            currency: "GHS",
            stock: parseInt(row.quantity, 10) || 0,
            isActive: statusToActive(row.status),
            imageUrl: row.image || null,
            attendantsNeeded: parseAttendants(row.attendantsNeeded || row.attendants_needed),
            updatedAt: now,
        };
    });

    const rentalNameSet = new Set(
        rentalData.map((row) => String(row.name || "").trim().toLowerCase()).filter(Boolean)
    );

    const transformedVendorRentals = vendorRentalData
        .filter(row => row.name && row.price)
        .filter(row => !rentalNameSet.has(String(row.name || "").trim().toLowerCase()))
        .map((row, i) => {
            const priceFloat = parseRentalPrice(row.price);
            const description = row.description || `Vendor rental item for ${row.type || "events"}.`;
            const vendorId = resolveVendorId(row.name);
            const rawSource = row.sourceCategoryCode || row.sourcecategorycode || row.source || "";
            let sourceCategoryCode = rawSource ? String(rawSource).trim().toUpperCase() : "";
            if (!sourceCategoryCode) {
                const fallbackCategory = String(row.type || "").toLowerCase();
                sourceCategoryCode = fallbackCategory === "party supplies" ? "WATER" : "RENTAL";
            }

            return {
                sku: `RNTL-${String(rentalData.length + i + 1).padStart(4, '0')}`,
                name: row.name,
                description: description,
                sourceCategoryCode: sourceCategoryCode,
                specificCategory: row.type || "Party Setup Rentals",
                rate: row.rate || null,
                page: null,
                age: generateAge(row.name, row.type || ""),
                price: priceToCents(priceFloat),
                currency: "GHS",
                stock: parseInt(row.quantity, 10) || 0,
                isActive: statusToActive(row.status),
                imageUrl: row.image_url || null,
                updatedAt: now,
                vendorId: Number.isFinite(vendorId) ? vendorId : null,
                attendantsNeeded: parseAttendants(row.attendantsNeeded || row.attendants_needed),
            };
        });

    const transformedMotorPumps = motorPumpData
        .filter(row => row.name)
        .map((row, i) => {
            const priceFloat = parseRentalPrice(row.price);
            return {
                sku: `PUM-${String(i + 1).padStart(4, '0')}`,
                name: row.name,
                description: row.description || "Motor pump for bouncy castle rentals.",
                sourceCategoryCode: "Rental",
                specificCategory: "Machines",
                rate: row.rate || null,
                page: row.page || null,
                age: generateAge(row.name, row.category || "Machines"),
                price: priceToCents(priceFloat),
                currency: "GHS",
                stock: parseInt(row.quantity, 10) || 0,
                isActive: statusToActive(row.status),
                imageUrl: row.image || null,
                updatedAt: now,
                attendantsNeeded: parseAttendants(row.attendantsNeeded || row.attendants_needed),
            };
        });

    const productsToCreate = [
        ...transformedInventory,
        ...transformedOutsourcedInventory,
        ...transformedRentals,
        ...transformedVendorRentals,
        ...transformedMotorPumps,
    ];

    // 4. Clear and Insert
    if (shouldReset) {
        try {
            await prisma.product.deleteMany({});
            console.log("\n🧹 Cleared existing data from 'Product' table for fresh import.");
        } catch (e) {
            console.error("Warning: Could not clear table. Proceeding with insertion.", e.message);
        }
    } else {
        console.log("ℹ️  IMPORT_RESET not set. Preserving existing products.");
    }

    // 5. Bulk Insert
    const result = await prisma.product.createMany({
        data: productsToCreate,
        skipDuplicates: true,
    });

    console.log(`\n✅ Bulk Insertion Complete! Created ${result.count} product records.`);
}

importProducts()
    .catch((e) => {
        console.error("\n❌ Error during product import:", e);
        if (e.code === 'ENOENT') {
            console.error("\nFile Not Found Error: Please ensure 'data/inventory.csv', 'data/inventory_outsourced.csv', and 'data/rentals.csv' exist.");
        }
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        console.log("Disconnected Prisma Client.");
    });
