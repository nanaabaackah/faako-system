import assert from "node:assert/strict";
import test from "node:test";
import { fetchCoreCollectionSummary } from "./collectionSummary.js";
import { buildCoreOrderFilter } from "../dashboard/dashboardRepository.js";

const window = { start: new Date("2026-10-01T00:00:00Z"), end: new Date("2026-10-01T12:00:00Z") };
const run = (rows) => fetchCoreCollectionSummary({ organizationId: 7, window,
  coreOrderFilter: buildCoreOrderFilter({ order: new Set(["businessUnit"]) }),
  client: { query: async (sql, values) => {
    assert.equal(values[0], 7);
    assert.deepEqual(values.slice(1, 4), [window.start.toISOString(), window.end.toISOString(), "2026-09-30T12:00:00.000Z"]);
    assert.match(sql, /pr\."businessUnit" = 'REEBS_CORE'/);
    assert.match(sql, /pa\."organizationId" = pr\."organizationId"/);
    assert.match(sql, /pa\.status = 'APPLIED'/);
    assert.match(sql, /NOT EXISTS[\s\S]*linked\."orderPaymentId" = op.id/);
    assert.match(sql, /waterProductConfig/);
    assert.doesNotMatch(sql, /'paystack'/);
    // EXISTS, rather than a multiplying application join: count each receipt once.
    assert.doesNotMatch(sql, /JOIN "paymentApplication"/);
    return { rows };
  } },
});

test("collections share one total and eight bounded chart buckets, with equivalent previous duration", async () => {
  const result = await run([{ bucket: -1, amount: "1000", count: "1", momo_count: "0" }, { bucket: 2, amount: "1500", count: "2", momo_count: "1" }]);
  assert.equal(result.receivedInWindowCents, 1500);
  assert.equal(result.paymentCount, 2);
  assert.equal(result.mobileMoneyPayments, 1);
  assert.equal(result.series.length, 8);
  assert.equal(result.series.reduce((sum, row) => sum + row.amountCents, 0), result.receivedInWindowCents);
  assert.equal(result.series[0].start, window.start.toISOString());
  assert.equal(result.series.at(-1).end, window.end.toISOString());
  assert.equal(result.comparison.changePercent, 50);
});

test("empty and non-positive comparison bases never produce infinite or misleading percentages", async () => {
  assert.equal((await run([])).comparison.changePercent, null);
  assert.equal((await run([{ bucket: -1, amount: -100, count: 1, momo_count: 0 }])).comparison.changePercent, null);
  assert.equal((await run([{ bucket: -1, amount: 100, count: 1, momo_count: 0 }])).comparison.changePercent, -100);
});
