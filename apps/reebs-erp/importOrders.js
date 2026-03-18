/* eslint-disable no-undef */
// Filename: importOrders.js

import "./runtimeEnv.js";
import { prisma } from "./prismaClient.js"; 
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse'; 
import { hashPassword } from "./utils/passwords.js";

const shouldReset = process.env.IMPORT_RESET === "true";

// Helper function to read a CSV file
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

const toInt = (value, fallback = 0) => {
    const num = parseInt(value, 10);
    return Number.isFinite(num) ? num : fallback;
};

const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

const SYSTEM_ADMIN_EMAIL = "system_admin@reebs.com";
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

const toDate = (value) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};

// Function to perform the full import
async function importTransactionalData() {
    console.log("🚀 Starting Transactional and User Data Import...");
    
    // 1. Read Data
    const usersData = await readCsv('data/users.csv');
    const secretsIndex = buildSecretsIndex(await readCsvOptional('data/users.secrets.csv'));
    const customersData = await readCsvOptional('data/customers.csv'); 
    const ordersData = await readCsvOptional('data/orders.csv');
    const orderItemsData = await readCsvOptional('data/orderItems.csv');
    const stockMovementsData = await readCsv('data/stockMovements.csv');

    console.log(
        `\nFound ${usersData.length} users, ${customersData.length} customers, ${ordersData.length} orders, ${orderItemsData.length} order items, and ${stockMovementsData.length} stock movements.`
    );

    if (!customersData.length) {
        console.log("ℹ️  No customers.csv file present; customer records will remain empty.");
    }
    if (!ordersData.length) {
        console.log("ℹ️  No orders.csv file present; order records will remain empty.");
    }
    if (!orderItemsData.length) {
        console.log("ℹ️  No orderItems.csv file present; order item records will remain empty.");
    }

    // 2. Clear Tables (Must be done in reverse dependency order)
    if (shouldReset) {
        try {
            console.log("🧹 Clearing existing data...");
            await prisma.$executeRaw`
                TRUNCATE TABLE
                    "bookingItem",
                    "booking",
                    "stockMovement",
                    "orderItem",
                    "order",
                    "customer",
                    "user"
                RESTART IDENTITY CASCADE
            `;
            console.log("✅ Tables cleared.");
        } catch (e) {
            console.error("Critical error clearing tables:", e.message);
            process.exit(1); 
        }
    } else {
        console.log("ℹ️  IMPORT_RESET not set. Preserving existing data.");
    }

    // 3. Import Users
    const usersToCreate = await Promise.all(usersData.map(async row => {
        const id = row.id ? parseInt(row.id, 10) : undefined;
        const firstName = cleanNamePart(row.firstName);
        const lastName = cleanNamePart(row.lastName);
        const fullName = buildFullName(firstName, lastName);
        const email = buildEmailFromNames(firstName, lastName);
        const rawPassword = resolvePassword(row, email, secretsIndex);

        if (!firstName || !lastName) {
            throw new Error("User rows must include firstName and lastName.");
        }
        if (!email) {
            throw new Error(`Could not generate email for ${firstName} ${lastName}`);
        }
        if (!rawPassword) {
            throw new Error(
                `User ${firstName} ${lastName} is missing a password (set data/users.secrets.csv or data/users.csv).`
            );
        }

        const user = {
            email,
            password: await hashPassword(rawPassword),
            firstName,
            lastName,
            fullName,
            role: row.role || "Staff",
        };

        if (Number.isFinite(id)) {
            user.id = id;
        }

        return user;
    }));
    await prisma.user.createMany({ data: usersToCreate, skipDuplicates: true });
    console.log(`✅ Imported ${usersToCreate.length} Users (Admin Profiles).`);

    const employeeProfiles = usersData
        .map((row) => {
            const userId = row.id ? parseInt(row.id, 10) : undefined;
            if (!Number.isFinite(userId)) return null;
            const email =
                buildEmailFromNames(row.firstName, row.lastName) ||
                cleanText(row.email || "");
            if (email.toLowerCase() === SYSTEM_ADMIN_EMAIL) {
                return null;
            }
            return {
                userId,
                ...profileDefaults(
                    row.jobTitle,
                    row.phone,
                    row.emergencyContactName,
                    row.emergencyContactPhone
                ),
            };
        })
        .filter(Boolean);

    if (employeeProfiles.length) {
        await prisma.employeeProfile.createMany({ data: employeeProfiles, skipDuplicates: true });
        console.log(`✅ Imported ${employeeProfiles.length} Employee Profiles.`);
    }

    // 4. Import Customers
    if (!customersData.length) {
        await prisma.$executeRaw`TRUNCATE TABLE "customer" RESTART IDENTITY CASCADE`;
        console.log("ℹ️  Customer import disabled; table cleared.");
    } else {
        const customersToCreate = customersData.map(row => ({
            id: parseInt(row.id, 10),
            name: row.name,
            email: row.email || null,
            phone: row.phone || null,
        }));
        await prisma.customer.createMany({ data: customersToCreate, skipDuplicates: true });
        console.log(`✅ Imported ${customersToCreate.length} Customers.`);
    }


    // 5. Import Orders (Uses total_amount)
    const ordersToCreate = ordersData.map(row => ({
        id: toInt(row.id, undefined), 
        orderNumber: cleanText(row.orderNumber),
        customerId: toInt(row.customerId, null), 
        customerName: cleanText(row.customerName),
        status: cleanText(row.status),
        deliveryMethod: (row.deliveryMethod || row.fulfillment || row.fulfillmentMethod || "delivery").toLowerCase(),
        total_amount: toInt(row.totalCents, 0), // ensure integer cents
        orderDate: toDate(row.orderDate),
        deliveryDate: row.deliveryDate ? toDate(row.deliveryDate) : null,
        assignedUserId: toInt(row.assignedUserId, null),
    }));
    // Filter out rows missing required foreign keys or date
    const validOrders = ordersToCreate.filter((o) => o.customerId && o.orderDate);
    let existingOrderIds = new Set();
    let existingOrderNumbers = new Set();
    if (!shouldReset && validOrders.length) {
        const orderIds = validOrders.map((o) => o.id).filter(Number.isFinite);
        const orderNumbers = validOrders.map((o) => o.orderNumber).filter(Boolean);
        const conditions = [];
        if (orderIds.length) conditions.push({ id: { in: orderIds } });
        if (orderNumbers.length) conditions.push({ orderNumber: { in: orderNumbers } });
        if (conditions.length) {
            const existingOrders = await prisma.order.findMany({
                where: { OR: conditions },
                select: { id: true, orderNumber: true },
            });
            existingOrderIds = new Set(existingOrders.map((row) => row.id));
            existingOrderNumbers = new Set(existingOrders.map((row) => row.orderNumber));
        }
    }
    const newOrders = shouldReset
        ? validOrders
        : validOrders.filter(
              (order) =>
                  !existingOrderIds.has(order.id) && !existingOrderNumbers.has(order.orderNumber)
          );
    await prisma.order.createMany({ data: newOrders, skipDuplicates: true });
    console.log(`✅ Imported ${newOrders.length} Orders.`);
    const newOrderIds = new Set(newOrders.map((order) => order.id).filter(Number.isFinite));

    // 6. Import Order Items (Uses unit_price and calculates total_amount)
    const orderItemsToCreate = orderItemsData.map(row => {
        const quantity = toInt(row.quantity, 0);
        // NOTE: Mapped to new 'unit_price' column name
        const unitPrice = toInt(row.unit_price || row.unitPrice || row.priceCents, 0); 
        
        return {
            orderId: toInt(row.orderId, null),
            productId: toInt(row.productId, null),
            quantity: quantity,
            unit_price: unitPrice, // Mapped to new 'unit_price'
            total_amount: quantity * unitPrice // Mapped to new 'total_amount'
        }
    });
    const validOrderItems = orderItemsToCreate.filter((oi) => oi.orderId && oi.productId);
    const filteredOrderItems = shouldReset
        ? validOrderItems
        : validOrderItems.filter((oi) => newOrderIds.has(oi.orderId));
    await prisma.orderItem.createMany({ data: filteredOrderItems, skipDuplicates: true });
    console.log(`✅ Imported ${filteredOrderItems.length} Order Items.`);

    // 7. Import Stock Movements
    const stockMovementsToCreate = stockMovementsData.map(row => ({
        productId: toInt(row.productId, null),
        type: row.type, 
        quantity: toInt(row.quantity, 0),
        date: toDate(row.date),
        reference: row.reference || null,
        notes: row.notes || null,
    }));
    const validStock = stockMovementsToCreate.filter((s) => s.productId);
    let filteredStock = validStock;
    if (!shouldReset && validStock.length) {
        const references = validStock.map((row) => row.reference).filter(Boolean);
        if (references.length) {
            const existingRefs = await prisma.stockMovement.findMany({
                where: { reference: { in: references } },
                select: { reference: true },
            });
            const existingReferenceSet = new Set(existingRefs.map((row) => row.reference));
            filteredStock = validStock.filter(
                (row) => !row.reference || !existingReferenceSet.has(row.reference)
            );
        }
    }
    await prisma.stockMovement.createMany({ data: filteredStock, skipDuplicates: true });
    console.log(`✅ Imported ${filteredStock.length} Stock Movements.`);

    // 7. Import Booking Data
    const bookingsData = await readCsvOptional('data/bookings.csv');
    const bookingItemsData = await readCsvOptional('data/bookingItems.csv');

    const hasBookingsCsv = bookingsData.length > 0;
    const hasBookingItemsCsv = bookingItemsData.length > 0;

    if (hasBookingsCsv && hasBookingItemsCsv) {
        console.log("Importing Bookings...");
        const products = await prisma.product.findMany({
            select: { id: true, sku: true, name: true },
        });
        const productBySku = new Map(
            products
                .filter((p) => p.sku)
                .map((p) => [String(p.sku).trim().toUpperCase(), p.id])
        );
        const productByName = new Map(
            products
                .filter((p) => p.name)
                .map((p) => [String(p.name).trim().toLowerCase(), p.id])
        );

        const bookingRows = bookingsData.map((row) => ({
            id: toInt(row.id),
            customerId: toInt(row.customerId),
            eventDate: toDate(row.eventDate),
            startTime: row.startTime,
            endTime: row.endTime,
            venueAddress: row.venueAddress,
            totalAmount: toInt(row.totalAmount),
            status: row.status,
            assignedUserId: toInt(row.assignedUserId, null),
        }));
        const validBookings = bookingRows.filter((row) => row.customerId && row.eventDate);
        let existingBookingIds = new Set();
        if (!shouldReset && validBookings.length) {
            const bookingIds = validBookings.map((row) => row.id).filter(Number.isFinite);
            if (bookingIds.length) {
                const existingBookings = await prisma.booking.findMany({
                    where: { id: { in: bookingIds } },
                    select: { id: true },
                });
                existingBookingIds = new Set(existingBookings.map((row) => row.id));
            }
        }
        const newBookings = shouldReset
            ? validBookings
            : validBookings.filter((row) => !existingBookingIds.has(row.id));
        await prisma.booking.createMany({ data: newBookings, skipDuplicates: true });
        const newBookingIds = new Set(newBookings.map((row) => row.id).filter(Number.isFinite));

        const bookingItemsToCreate = [];
        for (const row of bookingItemsData) {
            const rawProductId = toInt(row.productId, null);
            const rawSku = typeof row.productSku === "string" ? row.productSku.trim() : "";
            const rawName = typeof row.productName === "string" ? row.productName.trim() : "";

            const productId =
                rawProductId ||
                (rawSku ? productBySku.get(rawSku.toUpperCase()) : null) ||
                (rawName ? productByName.get(rawName.toLowerCase()) : null);

            if (!productId) {
                console.warn("Skipping booking item with missing product reference:", row);
                continue;
            }

            const bookingId = toInt(row.bookingId);
            if (!shouldReset && (!newBookingIds.size || !newBookingIds.has(bookingId))) {
                continue;
            }
            bookingItemsToCreate.push({
                bookingId: bookingId,
                productId: productId,
                quantity: toInt(row.quantity, 0),
                price: toInt(row.price, 0),
            });
        }

        if (bookingItemsToCreate.length) {
            await prisma.bookingItem.createMany({ data: bookingItemsToCreate });
        }

        console.log("✅ Bookings populated!");
    } else {
        console.log("ℹ️  Booking CSVs are missing; skipping booking import.");
    }
}

importTransactionalData()
    .catch((e) => {
        console.error("\n❌ Error during data import:", e);
        if (e.code === 'ENOENT') {
            console.error("\nFile Not Found Error: Please ensure all CSV files are in the same directory as this script.");
        }
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        console.log("Disconnected Prisma Client.");
    });
