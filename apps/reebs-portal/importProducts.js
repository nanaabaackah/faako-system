/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
// Filename: importProducts.js
import "./runtimeEnv.js";
import { prisma } from "./prismaClient.js"; 
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse'; 

const shouldReset = process.env.IMPORT_RESET === "true";

/**
 * --- HELPERS ---
 */

// Formats "WHITE SOCKS- SCHOOL" to "White socks- school"
const formatName = (str) => {
    if (!str) return "";
    const lower = str.trim().toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
};

// Auto-assign clothing sub-categories based on keywords in the description
const assignClothingCategory = (name) => {
    const n = name.toLowerCase();
    if (n.includes('baby') || n.includes('6m') || n.includes('infant') || n.includes('toddler')) return "Baby Clothing";
    if (n.includes('men') || n.includes('mens') || n.includes('male') || n.includes('boxer')) return "Men's Clothing";
    if (n.includes('women') || n.includes('ladies') || n.includes('dress') || n.includes('heel')) {
        if (n.includes('girl')) return "Girl's Clothing"; // Check for "Girls Dress"
        return "Women's Clothing";
    }
    if (n.includes('girl')) return "Girl's Clothing";
    if (n.includes('boy')) return "Boy's Clothing";
    
    return "General Clothing"; 
};

const assignShoeCategory = (name) => {
    const n = name.toLowerCase();
    if (n.includes('baby') || n.includes('infant') || n.includes('toddler')) return "Baby Shoes";
    if (n.includes('women') || n.includes('ladies') || n.includes('heel')) return "Women's Shoes";
    if (n.includes('men') || n.includes('mens') || n.includes('male')) return "Men's Shoes";
    if (n.includes('girl')) return "Girls' Shoes";
    if (n.includes('boy')) return "Boys' Shoes";
    return "General Shoes";
};

const assignToyCategory = (name) => {
    const n = name.toLowerCase();
    if (n.includes('party') || n.includes('balloon') || n.includes('decor') || n.includes('banner') || n.includes('cup') || n.includes('plate')) return "Party Supplies";
    if (n.includes('house') || n.includes('home') || n.includes('kitchen') || n.includes('mop') || n.includes('broom') || n.includes('storage')) return "Household Items";
    if (n.includes('baby') || n.includes('infant') || n.includes('toddler')) return "Baby Toys";
    return "Kids Toys";
};

// Converts strings like "GHC 12.00" or "£ 3.00" to integer cents/pesewas
const toCents = (val) => {
    if (!val || val === "" || val === "£ -" || val === "GHC -") return 0;
    const cleaned = val.toString().replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.round(num * 100);
};

const parseAttendants = (value) => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
};

// Generates unique SKU: CAT-NAMEPREFIX-INDEX
const generateSku = (name, category, index) => {
    const prefix = category.substring(0, 3).toUpperCase();
    const cleanName = name.toUpperCase().replace(/[^A-Z0-9]/g, '-').substring(0, 10);
    return `${prefix}-${cleanName}-${String(index).padStart(3, '0')}`;
};

const normalizeKey = (value) => (value || "").toString().trim().toLowerCase();
const normalizeSkuKey = (value) => (value || "").toString().trim().toUpperCase();

const normalizeImages = (entry) => {
    const raw = entry?.images;
    if (Array.isArray(raw)) {
        const cleaned = raw.map((img) => String(img).trim()).filter(Boolean);
        if (cleaned.length) return cleaned;
    }
    if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (trimmed) {
            if (trimmed.startsWith("[")) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed)) {
                        const cleaned = parsed.map((img) => String(img).trim()).filter(Boolean);
                        if (cleaned.length) return cleaned;
                    }
                } catch {
                    // fall through to single-image handling
                }
            }
            return [trimmed];
        }
    }
    if (entry?.image) {
        return [String(entry.image).trim()];
    }
    return [];
};

const readJsonFile = (filePath) => {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) return [];
    try {
        const raw = fs.readFileSync(fullPath, "utf8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.warn(`Could not parse JSON file at ${filePath}:`, err?.message || err);
        return [];
    }
};

/**
 * --- CSV PARSERS ---
 */

function readCsvRaw(filePath, skipLines = 0) {
    return new Promise((resolve, reject) => {
        const fullPath = path.resolve(filePath);
        if (!fs.existsSync(fullPath)) return resolve([]);
        
        fs.readFile(fullPath, { encoding: 'utf8' }, (err, data) => {
            if (err) return reject(err);
            parse(data, {
                columns: false, // Use raw arrays for messy headers
                skip_empty_lines: true,
                trim: true,
                relax_column_count: true,
            }, (err, records) => {
                if (err) return reject(err);
                resolve(records.slice(skipLines));
            });
        });
    });
}

function readRentalsCsv(filePath) {
    return new Promise((resolve, reject) => {
        const fullPath = path.resolve(filePath);
        fs.readFile(fullPath, { encoding: 'utf8' }, (err, data) => {
            if (err) return reject(err);
            parse(data, { columns: true, skip_empty_lines: true, trim: true }, (err, records) => {
                if (err) return reject(err);
                resolve(records);
            });
        });
    });
}

function readCsvWithHeadersRelaxed(filePath) {
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

/**
 * --- MAIN IMPORT LOGIC ---
 */

async function importAllProducts() {
    console.log("🚀 Starting Unified Import...");

    const existingProductBySku = new Map();
    const existingMachineProductIds = new Set();
    const existingBouncyProductIds = new Set();
    const existingIndoorProductIds = new Set();
    const existingShopProductIds = new Set();
    const existingBouncerIds = new Set();

    if (!shouldReset) {
        const [
            existingProducts,
            existingMachines,
            existingBouncy,
            existingIndoor,
            existingShop
        ] = await Promise.all([
            prisma.product.findMany({ select: { id: true, sku: true } }),
            prisma.machine.findMany({ select: { productId: true } }),
            prisma.bouncyCastle.findMany({ select: { productId: true, bouncerId: true } }),
            prisma.indoorGame.findMany({ select: { productId: true } }),
            prisma.shopItem.findMany({ select: { productId: true } })
        ]);

        for (const row of existingProducts) {
            if (!row.sku) continue;
            existingProductBySku.set(normalizeSkuKey(row.sku), { id: row.id });
        }
        for (const row of existingMachines) {
            if (row.productId) existingMachineProductIds.add(row.productId);
        }
        for (const row of existingBouncy) {
            if (row.productId) existingBouncyProductIds.add(row.productId);
            if (row.bouncerId) existingBouncerIds.add(row.bouncerId);
        }
        for (const row of existingIndoor) {
            if (row.productId) existingIndoorProductIds.add(row.productId);
        }
        for (const row of existingShop) {
            if (row.productId) existingShopProductIds.add(row.productId);
        }
    }

    const ensureProductRecord = async (productData) => {
        const skuKey = normalizeSkuKey(productData.sku);
        const existing = existingProductBySku.get(skuKey);
        if (existing) return { id: existing.id, isNew: false };
        const created = await prisma.product.create({ data: productData });
        existingProductBySku.set(skuKey, { id: created.id });
        return { id: created.id, isNew: true };
    };

    // Ensure IDs start from 1 on a fresh import
    if (shouldReset) {
        try {
            await prisma.$executeRaw`TRUNCATE TABLE "product" RESTART IDENTITY CASCADE`;
            console.log("🔄 Product table truncated and identity reset.");
        } catch (err) {
            console.warn("Could not truncate product table:", err?.message || err);
        }
    } else {
        console.log("ℹ️  IMPORT_RESET not set. Preserving existing products.");
    }

    // 1. Process Inventory Files (Clothes, Toys, Shoes)
    const inventoryCsvRows = await readCsvWithHeadersRelaxed('data/inventory.csv');
    const inventoryImageByName = new Map(
        inventoryCsvRows
            .filter((row) => row?.name)
            .map((row) => [normalizeKey(row.name), row.image_url?.trim()])
    );

    const inventorySources = [
        { path: 'data/Inventory - CLOTHES25.csv', type: 'CLOTHES', skip: 2 },
        { path: 'data/Inventory - TOYS25.csv', type: 'TOYS', skip: 1 },
        { path: 'data/Inventory - SHOES25.csv', type: 'SHOES', skip: 1 }
    ];

    for (const source of inventorySources) {
        console.log(`\n📂 Reading ${source.type}...`);
        const rows = await readCsvRaw(source.path, source.skip);
        let count = 0;

        for (const [idx, row] of rows.entries()) {
            const rawName = row[1]; // DESCRIPTION column
            if (!rawName || rawName.trim() === '' || rawName === 'DESCRIPTION') continue;

            const name = formatName(rawName);
            const stock = parseInt(row[5], 10) || 0;
            const price = toCents(row[4]);
            
            // Logic: Assign sub-category per source
            let specificCategory = null;
            if (source.type === 'CLOTHES') specificCategory = assignClothingCategory(rawName);
            else if (source.type === 'SHOES') specificCategory = assignShoeCategory(rawName);
            else if (source.type === 'TOYS') specificCategory = assignToyCategory(rawName);

            const rawImage = (row[row.length - 1] || "").toString().trim();
            const imageUrl =
                (rawImage.startsWith("/imgs/") ? rawImage : null) ||
                inventoryImageByName.get(normalizeKey(rawName)) ||
                null;
            const productData = {
                name: name,
                sku: generateSku(rawName, source.type, idx),
                stock: stock,
                price: price,
                purchasePriceGbp: toCents(row[2]), // CP (BP)
                purchasePriceGhs: toCents(row[3]), // CP (GHC)
                stockValue: stock * price,
                saleValue: toCents(row[19]), // SALES VALUE column
                sourceCategoryCode: source.type,
                specificCategory: specificCategory,
                isActive: true,
                imageUrl: imageUrl
            };

            const productRecord = await ensureProductRecord(productData);
            if (productRecord.isNew) count++;
        }
        console.log(`✅ ${source.type}: Added ${count} items.`);
    }

    // 2. Process Rentals
    console.log("\n📂 Reading Rentals...");
    const rentalRows = await readRentalsCsv('data/rentals.csv');
    const rentalNameSet = new Set(
        rentalRows.map((row) => normalizeKey(row.name)).filter(Boolean)
    );
    let rentalCount = 0;

    for (const [idx, row] of rentalRows.entries()) {
        const name = formatName(row.name);
        const stock = parseInt(row.quantity, 10) || 0;
        const price = toCents(row.price);
        const rate = row.rate?.trim() || "per day";
        const lowerName = String(row.name || "").toLowerCase();
        const lowerCategory = String(row.category || "").toLowerCase();
        const isMachineRow =
            lowerName.includes("snow cone") ||
            lowerName.includes("snowcone") ||
            lowerName.includes("popcorn") ||
            lowerName.includes("cotton candy");
        const isIndoorRow =
            lowerName.includes("indoor") ||
            lowerName.includes("board game") ||
            lowerName.includes("jenga");
        const isBouncyStub = lowerName === "bouncy castle";

        if (isMachineRow || isIndoorRow || isBouncyStub) {
            continue;
        }
        let specificCategory = row.category || "Rentals";
        if (lowerName.includes("bouncy") || lowerCategory.includes("bouncy")) {
            specificCategory = "Bouncy Castles";
        } else if (
            lowerName.includes("snow cone") ||
            lowerName.includes("snowcone") ||
            lowerName.includes("popcorn") ||
            lowerName.includes("cotton candy")
        ) {
            specificCategory = "Machines";
        } else if (lowerName.includes("indoor") || lowerName.includes("board game") || lowerName.includes("jenga")) {
            specificCategory = "Indoor Games";
        }

        const rentalData = {
            name: name,
            sku: generateSku(row.name, 'RENTAL', idx),
            stock: stock,
            price: price,
            rate: rate,
            page: row.page,
            imageUrl: row.image,
            sourceCategoryCode: 'RENTAL',
            specificCategory: specificCategory,
            stockValue: stock * price,
            isActive: row.status === 'available',
            attendantsNeeded: parseAttendants(row.attendantsNeeded || row.attendants_needed)
        };

        const rentalRecord = await ensureProductRecord(rentalData);
        if (rentalRecord.isNew) rentalCount++;
    }
    console.log(`✅ RENTALS: Added ${rentalCount} items.`);

    // 2b. Process Vendor Rentals (outsourced rental items)
    console.log("\n📂 Reading Vendor Rentals...");
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

    const vendorRentalRows = await readCsvWithHeadersRelaxed('data/vendor_rentals.csv');
    let vendorRentalCount = 0;

    for (const [idx, row] of vendorRentalRows.entries()) {
        const rawName = row?.name;
        if (!rawName || rawName.trim() === "") continue;
        if (rentalNameSet.has(normalizeKey(rawName))) continue;

        const name = formatName(rawName);
        const stock = parseInt(row.quantity, 10) || 0;
        const price = toCents(row.price);
        const specificCategory = row.type || "Party Setup Rentals";
        const rawSource = row.sourceCategoryCode || row.sourcecategorycode || row.source || "";
        let sourceCategoryCode = rawSource
            ? String(rawSource).trim().toUpperCase()
            : "";
        if (!sourceCategoryCode) {
            sourceCategoryCode = specificCategory.toLowerCase() === "party supplies" ? "WATER" : "RENTAL";
        }
        const imageUrl = row.image_url?.trim() || null;
        const vendorId = resolveVendorId(rawName);

        const vendorRentalData = {
            name: name,
            sku: generateSku(rawName, sourceCategoryCode || "RENTAL", idx),
            stock: stock,
            price: price,
            rate: row.rate || null,
            page: null,
            imageUrl: imageUrl,
            sourceCategoryCode: sourceCategoryCode || "RENTAL",
            specificCategory: specificCategory,
            stockValue: stock * price,
            isActive: String(row.status || "").toLowerCase() === 'available',
            attendantsNeeded: parseAttendants(row.attendantsNeeded || row.attendants_needed),
            vendorId: Number.isFinite(vendorId) ? vendorId : null
        };

        const vendorRecord = await ensureProductRecord(vendorRentalData);
        if (vendorRecord.isNew) vendorRentalCount++;
    }

    console.log(`✅ VENDOR RENTALS: Added ${vendorRentalCount} items.`);

    // 2c. Process Outsourced Inventory (non-rental vendor items)
    console.log("\n📂 Reading Outsourced Inventory...");
    const outsourcedRows = await readCsvWithHeadersRelaxed('data/inventory_outsourced.csv');
    let outsourcedCount = 0;

    for (const [idx, row] of outsourcedRows.entries()) {
        const rawName = row?.name;
        if (!rawName || rawName.trim() === "") continue;

        const name = formatName(rawName);
        const stock = parseInt(row.quantity, 10) || 0;
        const price = toCents(row.price);
        const specificCategory = row.type || row.category || "Party Supplies";
        const imageUrl = row.image_url?.trim() || null;
        const rawSource = row.sourceCategoryCode || row.sourcecategorycode || row.source || "";
        const sourceCategoryCode = rawSource
            ? String(rawSource).trim().toUpperCase()
            : "WATER";
        const vendorLabel = row.vendorName || row.vendor || "";
        const vendorId = resolveVendorId(vendorLabel || rawName);

        const outsourcedData = {
            name: name,
            sku: generateSku(rawName, sourceCategoryCode || "WATER", idx),
            stock: stock,
            price: price,
            rate: null,
            page: null,
            imageUrl: imageUrl,
            sourceCategoryCode: sourceCategoryCode || "WATER",
            specificCategory: specificCategory,
            stockValue: stock * price,
            isActive: String(row.status || "").toLowerCase() === 'available',
            vendorId: Number.isFinite(vendorId) ? vendorId : null
        };

        const outsourcedRecord = await ensureProductRecord(outsourcedData);
        if (outsourcedRecord.isNew) outsourcedCount++;
    }

    console.log(`✅ OUTSOURCED INVENTORY: Added ${outsourcedCount} items.`);

    // 3. Process Machines (Snow Cone, Popcorn, Cotton Candy, Motor Pumps)
    console.log("\n📂 Reading Machines...");
    let machineCount = 0;

    if (shouldReset) {
        try {
            await prisma.$executeRaw`TRUNCATE TABLE "machines" RESTART IDENTITY CASCADE`;
            console.log("🔄 Machines table truncated and identity reset.");
        } catch (err) {
            console.warn("Could not truncate machines table:", err?.message || err);
        }
    } else {
        console.log("ℹ️  IMPORT_RESET not set. Preserving machines.");
    }

    const motorPumpRows = await readRentalsCsv('data/motor_pumps.csv');
    const machineNames = ["snow cone", "popcorn", "cotton candy"];
    const machineRows = rentalRows.filter((row) => {
        const name = String(row.name || "").toLowerCase();
        return machineNames.some((needle) => name.includes(needle));
    });

    const combinedMachineRows = [...machineRows, ...motorPumpRows];

    for (const [idx, row] of combinedMachineRows.entries()) {
        const name = formatName(row.name);
        if (!name) continue;

        const quantity = parseInt(row.quantity, 10) || 0;
        const price = toCents(row.price);
        const imageUrl = row.image?.trim() || null;
        const isPump = name.toLowerCase().includes("pump");

        const machineProduct = {
            name: name,
            sku: generateSku(name, isPump ? 'PUMP' : 'MACH', idx),
            stock: quantity,
            price: price,
            rate: row.rate,
            page: row.page,
            imageUrl: imageUrl,
            sourceCategoryCode: 'RENTAL',
            specificCategory: "Machines",
            stockValue: quantity * price,
            isActive: true,
            attendantsNeeded: parseAttendants(row.attendantsNeeded || row.attendants_needed)
        };

        const productRecord = await ensureProductRecord(machineProduct);
        if (!existingMachineProductIds.has(productRecord.id)) {
            await prisma.machine.create({
                data: {
                    name: name,
                    productId: productRecord.id,
                    quantity: quantity,
                    price: price,
                    rate: row.rate || null,
                    availability: row.status || null,
                    category: row.category || null,
                    image: imageUrl,
                    page: row.page || null,
                    power: null,
                    output: null,
                    notes: null
                }
            });
            existingMachineProductIds.add(productRecord.id);
            machineCount++;
        }
    }

    console.log(`✅ MACHINES: Added ${machineCount} items.`);

    // 4. Process Bouncy Castle Types
    console.log("\n📂 Reading Bouncy Castles...");
    const bouncyRows = await readRentalsCsv('data/bounty_castle.csv');
    let bouncyCount = 0;

    if (shouldReset) {
        try {
            await prisma.$executeRaw`TRUNCATE TABLE "bouncy_castles" RESTART IDENTITY CASCADE`;
            console.log("🔄 Bouncy castles table truncated and identity reset.");
        } catch (err) {
            console.warn("Could not truncate bouncy_castles table:", err?.message || err);
        }
    } else {
        console.log("ℹ️  IMPORT_RESET not set. Preserving bouncy castles.");
    }

    for (const [idx, row] of bouncyRows.entries()) {
        const name = row.name?.trim();
        if (!name) continue;

        const images = normalizeImages(row);
        const price = toCents(row.price);
        const imageUrl = row.image?.trim() || images[0] || null;
        const recommendedAge = row.recommendedAge?.trim() || row.recommendedage?.trim() || null;
        const capacity = row.capacity?.trim();
        const motorsToPump =
            row.motorsToPump?.trim() ||
            row.motors_to_pump?.trim() ||
            row.motorstopump?.trim();
        const attendantsNeeded =
            row.attendantsNeeded?.trim() ||
            row.attendants_needed?.trim();
        const bestFor = row.bestFor?.trim();
        const features = row.features?.trim();
        const descriptionParts = [
            capacity ? `Capacity: ${capacity}.` : "",
            motorsToPump ? `Motors: ${motorsToPump}.` : "",
            bestFor ? `Best for: ${bestFor}.` : "",
            features ? `Features: ${features}.` : "",
        ].filter(Boolean);
        const description = descriptionParts.length ? `Bouncy Castle. ${descriptionParts.join(" ")}` : "Bouncy Castle.";

        const bouncyProduct = {
            name: name,
            sku: generateSku(name, 'BOUNCY', idx),
            stock: 1,
            price: price,
            rate: row.rate,
            page: "/Rentals/BouncyCastle",
            imageUrl: imageUrl,
            sourceCategoryCode: 'RENTAL',
            specificCategory: 'Bouncy Castles',
            description: description,
            age: recommendedAge,
            stockValue: price,
            isActive: true,
            attendantsNeeded: parseAttendants(attendantsNeeded)
        };

        const productRecord = await ensureProductRecord(bouncyProduct);
        if (!existingBouncyProductIds.has(productRecord.id)) {
            let bouncerId = shouldReset
                ? `BOUN-${String(idx + 1).padStart(3, "0")}`
                : `BOUN-${String(productRecord.id).padStart(6, "0")}`;
            if (existingBouncerIds.has(bouncerId)) {
                console.warn(`Skipping bouncy castle with duplicate bouncerId: ${bouncerId}`);
                continue;
            }
            await prisma.bouncyCastle.create({
                data: {
                    bouncerId,
                    name: name,
                    productId: productRecord.id,
                    capacity: capacity || null,
                    recommendedAge: recommendedAge,
                    priceRange: row.price?.trim() || null,
                    motorsToPump: Number.isFinite(Number(motorsToPump)) ? Number(motorsToPump) : null,
                    bestFor: bestFor || null,
                    features: features || null,
                    image: imageUrl,
                    images: images
                }
            });
            existingBouncyProductIds.add(productRecord.id);
            existingBouncerIds.add(bouncerId);
            bouncyCount++;
        }
    }
    console.log(`✅ BOUNCY CASTLES: Added ${bouncyCount} items.`);

    // 5. Process Indoor Games
    console.log("\n📂 Reading Indoor Games...");
    let indoorCount = 0;

    if (shouldReset) {
        try {
            await prisma.$executeRaw`TRUNCATE TABLE "indoor_games" RESTART IDENTITY CASCADE`;
            console.log("🔄 Indoor games table truncated and identity reset.");
        } catch (err) {
            console.warn("Could not truncate indoor_games table:", err?.message || err);
        }
    } else {
        console.log("ℹ️  IMPORT_RESET not set. Preserving indoor games.");
    }

    const indoorRows = await readRentalsCsv('data/indoor_games.csv');

    for (const [idx, row] of indoorRows.entries()) {
        const name = formatName(row.name);
        if (!name) continue;

        const quantity = parseInt(row.quantity, 10) || 0;
        const price = toCents(row.price);
        const imageUrl = row.image?.trim() || null;
        const category = row.category?.trim() || "Indoor Games";

        const indoorProduct = {
            name: name,
            sku: generateSku(name, 'INDOOR', idx),
            stock: quantity,
            price: price,
            rate: row.rate,
            page: row.page,
            imageUrl: imageUrl,
            sourceCategoryCode: 'RENTAL',
            specificCategory: category,
            stockValue: quantity * price,
            isActive: true
        };

        const productRecord = await ensureProductRecord(indoorProduct);

        const piecesTotal = row.piecesTotal ? parseInt(row.piecesTotal, 10) : null;
        const piecesMissing = row.piecesMissing ? parseInt(row.piecesMissing, 10) : null;

        if (!existingIndoorProductIds.has(productRecord.id)) {
            await prisma.indoorGame.create({
                data: {
                    name: name,
                    productId: productRecord.id,
                    quantity: quantity,
                    price: price,
                    rate: row.rate || null,
                    availability: row.availability || null,
                    category: category,
                    image: imageUrl,
                    page: row.page || null,
                    piecesTotal: Number.isFinite(piecesTotal) ? piecesTotal : null,
                    piecesMissing: Number.isFinite(piecesMissing) ? piecesMissing : null
                }
            });
            existingIndoorProductIds.add(productRecord.id);
            indoorCount++;
        }
    }

    console.log(`✅ INDOOR GAMES: Added ${indoorCount} items.`);

    // 6. Process Shop Items (from JSON)
    console.log("\n📂 Reading Shop Items...");
    let shopCount = 0;

    if (shouldReset) {
        try {
            await prisma.$executeRaw`TRUNCATE TABLE "shop_items" RESTART IDENTITY CASCADE`;
            console.log("🔄 Shop items table truncated and identity reset.");
        } catch (err) {
            console.warn("Could not truncate shop_items table:", err?.message || err);
        }
    } else {
        console.log("ℹ️  IMPORT_RESET not set. Preserving shop items.");
    }

    const shopItems = await readCsvWithHeadersRelaxed('data/inventory.csv');
    const shopItemRows = new Map();

    for (const [idx, item] of shopItems.entries()) {
        const name = formatName(item.name);
        if (!name) continue;

        const price = toCents(item.price);
        const imageUrl =
            item.image_url?.trim() ||
            item.image?.trim() ||
            inventoryImageByName.get(normalizeKey(name)) ||
            null;
        const category = item.type?.trim() || item.category?.trim() || "Shop Items";
        const ageRange = item.age_range?.trim() || item.ageRange?.trim() || null;
        const currency = item.currency?.trim() || "GHS";
        const stock = parseInt(item.quantity, 10) || 0;
        const isActive = String(item.status || "").toLowerCase() !== "unavailable";

        const shopProduct = {
            name: name,
            sku: generateSku(name, 'SHOP', idx),
            stock: stock,
            price: price,
            currency: currency,
            imageUrl: imageUrl,
            sourceCategoryCode: 'SHOP',
            specificCategory: category,
            stockValue: stock * price,
            isActive: isActive
        };

        const productRecord = await ensureProductRecord(shopProduct);

        shopItemRows.set(productRecord.id, {
            name: name,
            productId: productRecord.id,
            description: item.description || null,
            price: price,
            currency: currency,
            ageRange: ageRange,
            category: category,
            image: imageUrl,
            isActive: isActive
        });
    }

    const inventoryProducts = await prisma.product.findMany({
        where: { sourceCategoryCode: { in: ["CLOTHES", "TOYS", "SHOES"] } },
        select: {
            id: true,
            name: true,
            description: true,
            price: true,
            currency: true,
            age: true,
            specificCategory: true,
            imageUrl: true,
            isActive: true
        }
    });

    for (const product of inventoryProducts) {
        if (shopItemRows.has(product.id)) continue;
        const fallbackImage = inventoryImageByName.get(normalizeKey(product.name)) || null;
        shopItemRows.set(product.id, {
            name: product.name,
            productId: product.id,
            description: product.description || null,
            price: product.price,
            currency: product.currency || "GHS",
            ageRange: product.age || null,
            category: product.specificCategory || "Shop Items",
            image: product.imageUrl || fallbackImage,
            isActive: product.isActive !== false
        });
    }

    const shopItemData = Array.from(shopItemRows.values());
    if (shopItemData.length) {
        for (const item of shopItemData) {
            const { productId, ...rest } = item;
            if (existingShopProductIds.has(productId)) continue;
            await prisma.shopItem.create({ data: { productId, ...rest } });
            existingShopProductIds.add(productId);
            shopCount += 1;
        }
    }

    console.log(`✅ SHOP ITEMS: Added ${shopCount} items.`);
}

importAllProducts()
    .catch(e => console.error("❌ Import Failed:", e))
    .finally(async () => {
        await prisma.$disconnect();
        console.log("\n✨ Process finished.");
    });
