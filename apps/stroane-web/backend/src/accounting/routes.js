import { Router } from "express";
import { asyncRoute, createHttpError } from "../apiResponse.js";
import { requireAdminRole, requireSiteUser } from "../adminAuth.js";

const ACCOUNTING_ENTRY_TYPES = new Set([
  "INCOME",
  "EXPENSE",
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "ADJUSTMENT",
]);

const sanitizeText = (value = "", maxLength = 160) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const toMoneyNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
};

const roundMoney = (value) => Number((Number(value) || 0).toFixed(2));

const toIsoString = (value) => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const parseDateValue = (value) => {
  const raw = sanitizeText(value, 32);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildDateRange = (query = {}) => {
  const period = sanitizeText(query.period || "90d", 24).toLowerCase();
  const now = new Date();
  const explicitFrom = parseDateValue(query.from);
  const explicitTo = parseDateValue(query.to);
  if (explicitFrom || explicitTo) {
    return {
      period: "custom",
      from: explicitFrom ? startOfDay(explicitFrom) : null,
      to: explicitTo ? endOfDay(explicitTo) : endOfDay(now),
    };
  }
  if (period === "all") return { period: "all", from: null, to: null };
  if (period === "ytd") {
    return {
      period,
      from: new Date(now.getFullYear(), 0, 1),
      to: endOfDay(now),
    };
  }
  if (period === "12m") {
    const from = new Date(now);
    from.setMonth(from.getMonth() - 12);
    return { period, from: startOfDay(from), to: endOfDay(now) };
  }
  const days = period === "30d" ? 30 : 90;
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  return { period: `${days}d`, from: startOfDay(from), to: endOfDay(now) };
};

const dateIsInRange = (value, range) => {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
};

const buildPrismaDateFilter = (range) => {
  const filter = {};
  if (range.from) filter.gte = range.from;
  if (range.to) filter.lte = range.to;
  return Object.keys(filter).length ? filter : undefined;
};

const isPaidOrder = (order = {}) => {
  const status = String(order.status || "").toUpperCase();
  const paymentStatus = String(order.paymentStatus || "").toLowerCase();
  return (
    Boolean(order.paidAt) ||
    paymentStatus === "paid" ||
    paymentStatus === "success" ||
    ["PAID", "PROCESSING", "COMPLETED"].includes(status)
  );
};

const getOrderAccountingDate = (order = {}) =>
  order.paidAt || order.paymentVerifiedAt || order.paymentWebhookProcessedAt || order.createdAt;

const getEntryModel = (prisma) =>
  prisma.accountingLedgerEntry && typeof prisma.accountingLedgerEntry.findMany === "function"
    ? prisma.accountingLedgerEntry
    : null;

const toAccountingEntry = (entry) => ({
  id: entry.id,
  entryType: String(entry.entryType || "").toLowerCase(),
  category: entry.category,
  description: entry.description,
  amount: toMoneyNumber(entry.amount),
  currency: entry.currency || "GHS",
  entryDate: toIsoString(entry.entryDate),
  source: entry.source || "manual_lump_sum",
  reference: entry.reference || "",
  notes: entry.notes || "",
  status: entry.status || "active",
  createdByName: entry.createdByName || "",
  createdAt: toIsoString(entry.createdAt),
  updatedAt: toIsoString(entry.updatedAt),
});

const getPreferredCost = (product) => {
  const links = Array.isArray(product?.supplierLinks) ? product.supplierLinks : [];
  const preferred = links.find((link) => link.isPreferred && link.costPrice !== null && link.costPrice !== undefined);
  const fallback = links.find((link) => link.costPrice !== null && link.costPrice !== undefined);
  return toMoneyNumber((preferred || fallback)?.costPrice);
};

const buildProductFinanceMaps = (products = []) =>
  products.reduce(
    (maps, product) => {
      maps.priceBySlug.set(product.slug, toMoneyNumber(product.price));
      maps.costBySlug.set(product.slug, getPreferredCost(product));
      maps.nameBySlug.set(product.slug, product.name);
      return maps;
    },
    {
      priceBySlug: new Map(),
      costBySlug: new Map(),
      nameBySlug: new Map(),
    }
  );

const buildSeriesKey = (value) => {
  const date = value instanceof Date ? value : new Date(value || "");
  if (Number.isNaN(date.getTime())) return "Undated";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const createEmptySeriesBucket = (period) => ({
  period,
  revenue: 0,
  expenses: 0,
  net: 0,
  orders: 0,
  entries: 0,
});

const addCategoryAmount = (map, category, amount) => {
  const key = category || "Uncategorised";
  map.set(key, roundMoney((map.get(key) || 0) + amount));
};

const normalizeAccountingType = (value) => sanitizeText(value, 32).toUpperCase();

const buildAccountingOverview = async (prisma, query = {}) => {
  const range = buildDateRange(query);
  const limit = Math.min(Math.max(Number(query.limit) || 500, 50), 1500);
  const dateFilter = buildPrismaDateFilter(range);
  const entryModel = getEntryModel(prisma);
  const notices = [];

  const [orders, receipts, inventoryItems, products, manualEntries] = await Promise.all([
    prisma.commerceOrder.findMany({
      where: dateFilter
        ? {
            OR: [
              { paidAt: dateFilter },
              { createdAt: dateFilter },
              { paymentVerifiedAt: dateFilter },
              { paymentWebhookProcessedAt: dateFilter },
            ],
          }
        : {},
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.commerceReceipt.findMany({
      where: dateFilter ? { issuedAt: dateFilter } : {},
      orderBy: { issuedAt: "desc" },
      take: limit,
    }),
    prisma.inventoryItem.findMany({
      include: {
        product: {
          select: {
            slug: true,
            name: true,
            price: true,
            currency: true,
            supplierLinks: {
              select: {
                costPrice: true,
                isPreferred: true,
              },
              orderBy: [{ isPreferred: "desc" }, { createdAt: "desc" }],
            },
          },
        },
      },
      take: 1500,
    }),
    prisma.catalogueProduct.findMany({
      select: {
        slug: true,
        name: true,
        price: true,
        currency: true,
        supplierLinks: {
          select: {
            costPrice: true,
            isPreferred: true,
          },
          orderBy: [{ isPreferred: "desc" }, { createdAt: "desc" }],
        },
      },
      take: 1500,
    }),
    entryModel
      ? entryModel.findMany({
          where: {
            status: "active",
            ...(dateFilter ? { entryDate: dateFilter } : {}),
          },
          orderBy: { entryDate: "desc" },
          take: limit,
        })
      : Promise.resolve([]),
  ]);

  if (!entryModel) {
    notices.push(
      "Accounting ledger migration is not deployed yet. Live figures are available; manual historical entries are temporarily unavailable."
    );
  }

  const productMaps = buildProductFinanceMaps(products);
  const paidOrders = orders.filter((order) => isPaidOrder(order) && dateIsInRange(getOrderAccountingDate(order), range));
  const outstandingOrders = orders.filter((order) => !isPaidOrder(order));
  const manualTotals = {
    income: 0,
    expenses: 0,
    assets: 0,
    liabilities: 0,
    equity: 0,
    adjustments: 0,
  };
  const categoryMap = new Map();
  const seriesMap = new Map();

  const getSeriesBucket = (date) => {
    const key = buildSeriesKey(date);
    if (!seriesMap.has(key)) seriesMap.set(key, createEmptySeriesBucket(key));
    return seriesMap.get(key);
  };

  let orderRevenue = 0;
  let orderCostKnown = 0;
  let ordersWithKnownCost = 0;
  paidOrders.forEach((order) => {
    const orderTotal = toMoneyNumber(order.total);
    orderRevenue += orderTotal;
    const orderCost = (order.items || []).reduce((total, item) => {
      const cost = productMaps.costBySlug.get(item.productSlug) || 0;
      return total + cost * (Number(item.quantity) || 0);
    }, 0);
    if (orderCost > 0) {
      orderCostKnown += orderCost;
      ordersWithKnownCost += 1;
    }
    const bucket = getSeriesBucket(getOrderAccountingDate(order));
    bucket.revenue = roundMoney(bucket.revenue + orderTotal);
    bucket.orders += 1;
    addCategoryAmount(categoryMap, "Storefront and portal sales", orderTotal);
  });

  manualEntries.forEach((entry) => {
    const amount = toMoneyNumber(entry.amount);
    const type = String(entry.entryType || "").toLowerCase();
    if (type === "income") manualTotals.income += amount;
    if (type === "expense") manualTotals.expenses += amount;
    if (type === "asset") manualTotals.assets += amount;
    if (type === "liability") manualTotals.liabilities += amount;
    if (type === "equity") manualTotals.equity += amount;
    if (type === "adjustment") manualTotals.adjustments += amount;

    const bucket = getSeriesBucket(entry.entryDate);
    if (type === "income") bucket.revenue = roundMoney(bucket.revenue + amount);
    if (type === "expense") bucket.expenses = roundMoney(bucket.expenses + amount);
    bucket.entries += 1;
    addCategoryAmount(categoryMap, entry.category, type === "expense" ? -amount : amount);
  });

  const stock = inventoryItems.reduce(
    (summary, item) => {
      const quantity = Number(item.quantityOnHand ?? item.availableQuantity ?? 0) || 0;
      const retail = toMoneyNumber(item.product?.price ?? productMaps.priceBySlug.get(item.productSlug));
      const cost = getPreferredCost(item.product);
      if (quantity > 0 && retail > 0) summary.retailValue += quantity * retail;
      if (quantity > 0 && cost > 0) {
        summary.costValue += quantity * cost;
        summary.costedItems += 1;
      }
      if (quantity > 0 && retail > 0) summary.pricedItems += 1;
      return summary;
    },
    { retailValue: 0, costValue: 0, pricedItems: 0, costedItems: 0 }
  );

  const outstandingValue = outstandingOrders.reduce((total, order) => total + toMoneyNumber(order.total), 0);
  const receiptValue = receipts.reduce((total, receipt) => total + toMoneyNumber(receipt.total), 0);
  const totalOrderValue = orders.reduce((total, order) => total + toMoneyNumber(order.total), 0);
  const revenue = roundMoney(orderRevenue + manualTotals.income);
  const expenses = roundMoney(manualTotals.expenses);
  const costOfGoodsSold = roundMoney(orderCostKnown);
  const grossProfit = roundMoney(revenue - costOfGoodsSold);
  const netProfit = roundMoney(grossProfit - expenses + manualTotals.adjustments);
  const cashEstimate = roundMoney(orderRevenue + manualTotals.income - expenses);
  const assetTotal = roundMoney(cashEstimate + outstandingValue + stock.costValue + manualTotals.assets);
  const liabilityTotal = roundMoney(manualTotals.liabilities);
  const netPosition = roundMoney(assetTotal - liabilityTotal + manualTotals.equity);
  const collectionRate = totalOrderValue > 0 ? roundMoney((orderRevenue / totalOrderValue) * 100) : 0;
  const grossMargin = revenue > 0 && costOfGoodsSold > 0 ? roundMoney((grossProfit / revenue) * 100) : 0;
  const receiptCoverage = orderRevenue > 0 ? roundMoney((receiptValue / orderRevenue) * 100) : 0;
  const averageOrderValue = paidOrders.length > 0 ? roundMoney(orderRevenue / paidOrders.length) : 0;

  seriesMap.forEach((bucket) => {
    bucket.net = roundMoney(bucket.revenue - bucket.expenses);
  });

  const transactions = [
    ...paidOrders.map((order) => ({
      id: `order:${order.id}`,
      source: "order",
      type: "income",
      date: toIsoString(getOrderAccountingDate(order)),
      label: order.orderNumber,
      description: `${order.customerName || "Customer"} payment`,
      category: "Sales",
      amount: toMoneyNumber(order.total),
      currency: order.currency || "GHS",
      reference: order.paymentReference || "",
      status: String(order.paymentStatus || order.status || "paid").toLowerCase(),
    })),
    ...manualEntries.map((entry) => ({
      id: `entry:${entry.id}`,
      source: "manual",
      type: String(entry.entryType || "").toLowerCase(),
      date: toIsoString(entry.entryDate),
      label: entry.description,
      description: entry.notes || entry.description,
      category: entry.category,
      amount: toMoneyNumber(entry.amount),
      currency: entry.currency || "GHS",
      reference: entry.reference || "",
      status: entry.status || "active",
    })),
  ].sort((left, right) => new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime());

  return {
    range: {
      period: range.period,
      from: toIsoString(range.from),
      to: toIsoString(range.to),
    },
    summary: {
      currency: "GHS",
      revenue,
      orderRevenue: roundMoney(orderRevenue),
      manualIncome: roundMoney(manualTotals.income),
      expenses,
      costOfGoodsSold,
      grossProfit,
      netProfit,
      cashEstimate,
      receivables: roundMoney(outstandingValue),
      stockRetailValue: roundMoney(stock.retailValue),
      stockCostValue: roundMoney(stock.costValue),
      assetTotal,
      liabilityTotal,
      equity: roundMoney(manualTotals.equity),
      netPosition,
      receiptValue: roundMoney(receiptValue),
      collectionRate,
      grossMargin,
      receiptCoverage,
      averageOrderValue,
      paidOrderCount: paidOrders.length,
      outstandingOrderCount: outstandingOrders.length,
      receiptCount: receipts.length,
      manualEntryCount: manualEntries.length,
      stockPricedItemCount: stock.pricedItems,
      stockCostedItemCount: stock.costedItems,
      ordersWithKnownCost,
    },
    categoryBreakdown: Array.from(categoryMap.entries())
      .map(([category, amount]) => ({ category, amount: roundMoney(amount) }))
      .sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount)),
    series: Array.from(seriesMap.values()).sort((left, right) => left.period.localeCompare(right.period)),
    transactions: transactions.slice(0, limit),
    manualEntries: manualEntries.map(toAccountingEntry),
    notices,
  };
};

const parseEntryPayload = (body = {}) => {
  const entryType = normalizeAccountingType(body.entryType);
  if (!ACCOUNTING_ENTRY_TYPES.has(entryType)) {
    throw createHttpError("Choose a valid accounting entry type.", 400);
  }
  const category = sanitizeText(body.category, 80);
  const description = sanitizeText(body.description, 160);
  const amount = toMoneyNumber(body.amount);
  const currency = sanitizeText(body.currency || "GHS", 3).toUpperCase();
  const entryDate = parseDateValue(body.entryDate);

  if (!category) throw createHttpError("Add a category for this accounting entry.", 400);
  if (!description) throw createHttpError("Add a short description for this accounting entry.", 400);
  if (!amount || amount <= 0) throw createHttpError("Enter an amount greater than zero.", 400);
  if (!currency || currency.length !== 3) throw createHttpError("Use a 3-letter currency code.", 400);
  if (!entryDate) throw createHttpError("Choose a valid accounting date.", 400);

  return {
    entryType,
    category,
    description,
    amount,
    currency,
    entryDate,
    source: sanitizeText(body.source || "manual_lump_sum", 80) || "manual_lump_sum",
    reference: sanitizeText(body.reference, 120) || null,
    notes: sanitizeText(body.notes, 800) || null,
  };
};

export const createAdminAccountingRouter = (prisma) => {
  const router = Router();

  router.use(requireSiteUser(prisma, ["ADMIN", "VIEWER"]));

  router.get(
    "/accounting/overview",
    asyncRoute(async (req, res) => {
      const overview = await buildAccountingOverview(prisma, req.query);
      res.json(overview);
    })
  );

  router.post(
    "/accounting/entries",
    requireAdminRole(prisma),
    asyncRoute(async (req, res) => {
      const entryModel = getEntryModel(prisma);
      if (!entryModel) {
        throw createHttpError("Accounting ledger migration has not been deployed yet.", 503);
      }
      const payload = parseEntryPayload(req.body);
      const entry = await entryModel.create({
        data: {
          ...payload,
          createdById: req.authUser?.id || null,
          createdByName: req.authUser?.username || null,
        },
      });
      res.status(201).json({ entry: toAccountingEntry(entry) });
    })
  );

  return router;
};
