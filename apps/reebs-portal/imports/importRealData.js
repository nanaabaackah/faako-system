/* eslint-disable no-undef */
import "../runtimeEnv.js";
import { prisma } from "../prismaClient.js"; 
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse'; 

const shouldReset = process.env.IMPORT_RESET === "true";

// --- 1. YOUR AGE GENERATOR (Kept from your previous file) ---
const generateAge = (name, category) => {
    const n = String(name).toLowerCase();
    const c = String(category).toLowerCase();
    if (c.includes("toys")) {
        if (n.includes('baby') || n.includes('toddler') || n.includes('infunbebe')) return "6m+";
        if (n.includes('blocks') || n.includes('foam') || n.includes('slime')) return "1+";
        if (n.includes('puzzle') || n.includes('doll') || n.includes('car')) return "3+";
        return "2+";
    }
    return "All Ages";
};

// --- 2. HELPERS ---
const cleanCurrency = (val) => {
    if (!val || val === "") return 0;
    const cleaned = val.toString().replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned) || 0;
};

const assignClothingCategory = (name) => {
    const n = name.toLowerCase();
    if (n.includes('baby') || n.includes('6m') || n.includes('infant') || n.includes('toddler')) return "Baby Clothing";
    if (n.includes('men') || n.includes('mens') || n.includes('male') || n.includes('boxer')) return "Men's Clothing";
    if (n.includes('women') || n.includes('ladies') || n.includes('dress') || n.includes('heel')) {
        if (n.includes('girl')) return "Girl's Clothing";
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

function readCsv(filePath) {
    return new Promise((resolve, reject) => {
        const fullPath = path.resolve(filePath);
        fs.readFile(fullPath, { encoding: 'utf8' }, (err, data) => {
            if (err) return reject(err);
            parse(data, {
                columns: true, 
                skip_empty_lines: true,
                trim: true,
                from_line: 2, // Starts at row 2 to skip the "SALES" header span
                relax_column_count: true,
            }, (err, records) => {
                if (err) return reject(err);
                resolve(records);
            });
        });
    });
}

// --- 3. MAIN IMPORT LOGIC ---
async function importProductData() {
    const files = [
        { name: 'data/Inventory - TOYS25.csv', category: 'TOYS' },
        { name: 'data/Inventory - CLOTHES25.csv', category: 'CLOTHES' },
        { name: 'data/Inventory - SHOES25.csv', category: 'SHOES' }
    ];

    console.log("🚀 Starting Integrated Financial & Inventory Import...");

    for (const file of files) {
        console.log(`\n📂 Processing ${file.category}...`);
        const records = await readCsv(file.name);
        let count = 0;

        for (const row of records) {
            const name = row['DESCRIPTION'];
            if (!name || name.trim() === '' || name === 'CODE') continue;

            // Numeric Parsing (Converting to Cents/Pesewas)
            const stock = parseInt(cleanCurrency(row['STOCK AT HAND']), 10) || 0;
            const priceInCents = Math.round(cleanCurrency(row['PRICE']) * 100);
            const cpGbpInPence = Math.round(cleanCurrency(row['CP (BP)']) * 100);
            const cpGhsInPesewas = Math.round(cleanCurrency(row['CP (GHC)']) * 100);
            
            // LOGIC: Stock Value = Stock * Price
            const calculatedStockValue = stock * priceInCents;
            
            // LOGIC: Sales Value = Historical data from Excel
            const historicalSalesValue = Math.round(cleanCurrency(row['SALES VALUE']) * 100);

            // Generate Description & Age (From your logic)
            const age = generateAge(name, file.category);
            const description = `${file.category} item. Suitable for: ${age}.`;

            let specificCategory = null;
            if (file.category === 'CLOTHES') specificCategory = assignClothingCategory(name);
            else if (file.category === 'SHOES') specificCategory = assignShoeCategory(name);
            else if (file.category === 'TOYS') specificCategory = assignToyCategory(name);

            const productData = {
                name: name,
                stock: stock,
                price: priceInCents,
                purchasePriceGbp: cpGbpInPence,
                purchasePriceGhs: cpGhsInPesewas,
                stockValue: calculatedStockValue,
                saleValue: historicalSalesValue,
                description: description,
                age: age,
                sourcecategorycode: file.category,
                specificCategory,
                isActive: true
            };

            // Upsert: Find by name (case insensitive)
            const existing = await prisma.product.findFirst({
                where: { name: { equals: name, mode: 'insensitive' } }
            });

            if (existing) {
                if (!shouldReset) {
                    continue;
                }
                await prisma.product.update({ where: { id: existing.id }, data: productData });
            } else {
                await prisma.product.create({ data: productData });
            }
            count++;
        }
        console.log(`✅ ${file.category}: ${count} items synced.`);
    }
}

importProductData()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
        console.log("\n✨ Database fully updated with real 2025 data.");
    });
