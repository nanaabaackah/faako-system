// DEV ERP's accounting-only autopay projection. This records expected external charges;
// it does not charge a card or assert that a payment processor confirmed settlement.
export const shiftAutopayMonth = (value, months) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()) || !Number.isInteger(months) || months < 0) return null;
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(date.getUTCDate(), lastDay)));
};

const monthSpan = (interval) => ({ MONTHLY: 1, QUARTERLY: 3, YEARLY: 12 })[interval] || null;
const startOfUtcDay = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const occurrenceRef = (parentId, date) => `autopay:${parentId}:${date.toISOString().slice(0, 10)}`;

export const planAutopayPeriods = (root, now = new Date(), maxPeriods = 240) => {
  const span = monthSpan(root?.recurringInterval);
  const anchor = root?.recurrenceAnchorAt && startOfUtcDay(new Date(root.recurrenceAnchorAt));
  const today = startOfUtcDay(now);
  if (!span || !anchor || Number.isNaN(anchor.getTime()) || anchor > today) return [];
  const periods = [];
  for (let i = 1; i <= maxPeriods; i += 1) {
    const date = shiftAutopayMonth(anchor, i * span);
    periods.push(date);
    if (date > today) return periods; // Keep just one future scheduled occurrence.
  }
  throw new Error(`Autopay series ${root.id} exceeds ${maxPeriods} periods; requires review`);
};

export const processAutopayExpense = async (prisma, root, { now = new Date() } = {}) => {
  if (!root || root.archivedAt || !root.autopayEnabled || root.type !== "EXPENSE" ||
      root.source !== "MANUAL" || root.recurrenceParentId != null || !monthSpan(root.recurringInterval)) {
    return { created: 0, adopted: 0, paid: 0 };
  }
  const today = startOfUtcDay(now);
  const periods = planAutopayPeriods(root, now);
  return prisma.$transaction(async (tx) => {
    let adopted = 0;
    let paid = 0;
    const existing = await tx.accountingEntry.findMany({
      where: { recurrenceParentId: root.id },
      select: { id: true, recurrencePeriodAt: true },
    });
    const known = new Set(existing.map((e) => e.recurrencePeriodAt?.toISOString()).filter(Boolean));
    const toCreate = [];
    for (const period of periods) {
      const key = period.toISOString();
      if (known.has(key)) continue;
      // Adopt an exact-match scheduled child created by the previous pay-on-marked-paid logic.
      const legacy = await tx.accountingEntry.findMany({
        where: {
          id: { not: root.id },
          organizationId: root.organizationId,
          type: "EXPENSE",
          source: "MANUAL",
          recurrenceParentId: null,
          autopayEnabled: false,
          recurringInterval: root.recurringInterval,
          currency: root.currency,
          amount: root.amount,
          serviceName: root.serviceName,
          detail: root.detail ?? null,
          status: "SCHEDULED",
          dueAt: period,
          archivedAt: null,
        },
        select: { id: true },
        take: 2,
      });
      if (legacy.length > 1) {
        throw new Error(`Ambiguous legacy expenses for autopay series ${root.id} at ${key}`);
      }
      if (legacy.length === 1) {
        const result = await tx.accountingEntry.updateMany({
          where: { id: legacy[0].id, recurrenceParentId: null, status: "SCHEDULED" },
          data: { recurrenceParentId: root.id, recurrencePeriodAt: period, sourceRef: occurrenceRef(root.id, period) },
        });
        adopted += result.count;
        known.add(key);
        continue;
      }
      toCreate.push({
        organizationId: root.organizationId,
        type: "EXPENSE",
        status: period <= today ? "PAID" : "SCHEDULED",
        source: "MANUAL",
        sourceRef: occurrenceRef(root.id, period),
        recurrenceParentId: root.id,
        recurrencePeriodAt: period,
        recurringInterval: root.recurringInterval,
        currency: root.currency,
        amount: root.amount,
        serviceName: root.serviceName,
        detail: root.detail ?? null,
        paidAt: period <= today ? period : null,
        dueAt: period,
      });
    }
    const inserted = toCreate.length
      ? await tx.accountingEntry.createMany({ data: toCreate, skipDuplicates: true })
      : { count: 0 };

    // Changes to a series template affect only future, not already-paid occurrences.
    await tx.accountingEntry.updateMany({
      where: {
        recurrenceParentId: root.id,
        recurrencePeriodAt: { gt: today },
        status: "SCHEDULED",
        archivedAt: null,
      },
      data: {
        amount: root.amount,
        currency: root.currency,
        serviceName: root.serviceName,
        detail: root.detail ?? null,
      },
    });

    // Existing scheduled occurrences and adopted legacy rows become paid on their charge date.
    const dueChildren = await tx.accountingEntry.findMany({
      where: {
        recurrenceParentId: root.id,
        recurrencePeriodAt: { lte: today },
        status: "SCHEDULED",
        paidAt: null,
        archivedAt: null,
      },
      select: { id: true, recurrencePeriodAt: true },
    });
    for (const child of dueChildren) {
      const result = await tx.accountingEntry.updateMany({
        where: { id: child.id, status: "SCHEDULED", paidAt: null, archivedAt: null },
        data: { status: "PAID", paidAt: child.recurrencePeriodAt },
      });
      paid += result.count;
    }
    const anchor = root.recurrenceAnchorAt && startOfUtcDay(new Date(root.recurrenceAnchorAt));
    if (anchor && anchor <= today && ["PENDING", "SCHEDULED"].includes(root.status)) {
      const result = await tx.accountingEntry.updateMany({
        where: { id: root.id, status: { in: ["PENDING", "SCHEDULED"] }, archivedAt: null, autopayEnabled: true },
        data: { status: "PAID", paidAt: anchor },
      });
      paid += result.count;
    }
    return { created: inserted.count, adopted, paid };
  });
};

export const runRecurringAutopaySweep = async (prisma, { now = new Date(), onError = () => {} } = {}) => {
  const roots = await prisma.accountingEntry.findMany({
    where: {
      autopayEnabled: true,
      type: "EXPENSE",
      source: "MANUAL",
      recurrenceParentId: null,
      recurringInterval: { not: null },
      archivedAt: null,
    },
  });
  const summary = { series: roots.length, created: 0, adopted: 0, paid: 0, errors: 0 };
  for (const root of roots) {
    try {
      const result = await processAutopayExpense(prisma, root, { now });
      summary.created += result.created;
      summary.adopted += result.adopted;
      summary.paid += result.paid;
    } catch (error) {
      summary.errors += 1;
      onError(error, root.id);
    }
  }
  return summary;
};
