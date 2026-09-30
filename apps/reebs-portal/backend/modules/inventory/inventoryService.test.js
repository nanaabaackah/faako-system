import assert from "node:assert/strict";
import test from "node:test";
import { normalizeInventoryAdjustment } from "./inventoryDomain.js";
import { adjustInventoryStock } from "./inventoryService.js";

const actor = { userId: 7, userName: "Inventory Manager", userEmail: "manager@example.com" };

const adjustment = (overrides = {}) => normalizeInventoryAdjustment({
  productId: 10,
  type: "StockOut",
  quantity: 1,
  idempotencyKey: "inventory-adjustment-test-001",
  ...overrides,
}).value;

const createClient = (onFinish = () => {}) => ({
  commands: [],
  async query(sql) {
    this.commands.push(sql);
    if (sql === "COMMIT" || sql === "ROLLBACK") onFinish(sql);
    return { rows: [], rowCount: 0 };
  },
});

const createRepository = ({
  stock = 2,
  isWaterProduct = false,
  sourceCategoryCode = "SHOP",
  peakReserved = 0,
} = {}) => {
  const state = { stock, peakReserved, movements: new Map(), locked: false, waiters: [], nextMovementId: 1 };
  const release = () => {
    state.locked = false;
    state.waiters.shift()?.();
  };
  const acquire = async () => {
    if (state.locked) await new Promise((resolve) => state.waiters.push(resolve));
    state.locked = true;
  };
  const repository = {
    async lockInventoryProduct() {
      await acquire();
      return {
        id: 10,
        name: "Chair",
        stock: state.stock,
        itemType: "STANDARD",
        sourceCategoryCode,
        isActive: true,
        isArchived: false,
        isDeleted: false,
        isWaterProduct,
      };
    },
    async findMovementByIdempotencyKey(_client, _organizationId, key) {
      return key ? state.movements.get(key) || null : null;
    },
    async lockInventoryVariant() {
      return null;
    },
    async getPeakRentalReservation() {
      return state.peakReserved;
    },
    async applyProductStockDelta(_client, { delta }) {
      if (state.stock + delta < 0) return null;
      state.stock += delta;
      return { resultingStock: state.stock, lastUpdatedByUserId: actor.userId };
    },
    async applyVariantStockDelta() {
      return null;
    },
    async insertInventoryMovement(_client, { adjustment: input, previousStock, resultingStock }) {
      if (input.idempotencyKey && state.movements.has(input.idempotencyKey)) {
        const error = new Error("duplicate");
        error.code = "23505";
        throw error;
      }
      const movement = {
        id: state.nextMovementId++,
        productId: input.productId,
        variantId: input.variantId,
        resultingStock,
        previousStock,
      };
      if (input.idempotencyKey) state.movements.set(input.idempotencyKey, movement);
      return movement.id;
    },
  };
  return { state, repository, release };
};

const execute = async (fixture, input) => {
  const client = createClient(fixture.release);
  const result = await adjustInventoryStock(client, {
    organizationId: 1,
    adjustment: input,
    actor,
  }, fixture.repository);
  return { client, result };
};

test("applies a stock movement transactionally and records the resulting stock", async () => {
  const fixture = createRepository({ stock: 3 });
  const { client, result } = await execute(fixture, adjustment());

  assert.equal(result.newStock, 2);
  assert.equal(result.idempotentReplay, false);
  assert.deepEqual(client.commands, ["BEGIN", "COMMIT"]);
  assert.equal(fixture.state.movements.size, 1);
});

test("replays the same adjustment key without double-mutating stock", async () => {
  const fixture = createRepository({ stock: 1 });
  const input = adjustment();
  const first = execute(fixture, input);
  const second = execute(fixture, input);
  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.equal(fixture.state.stock, 0);
  assert.equal(firstResult.result.idempotentReplay, false);
  assert.equal(secondResult.result.idempotentReplay, true);
  assert.equal(fixture.state.movements.size, 1);
});

test("serializes competing final-stock removals so only one succeeds", async () => {
  const fixture = createRepository({ stock: 1 });
  const first = execute(fixture, adjustment({ idempotencyKey: "inventory-adjustment-final-a" }));
  const second = execute(fixture, adjustment({ idempotencyKey: "inventory-adjustment-final-b" }));
  const results = await Promise.allSettled([first, second]);

  assert.equal(fixture.state.stock, 0);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.equal(rejected.reason.code, "INSUFFICIENT_INVENTORY");
});

test("blocks Water-linked products at the Core Inventory boundary", async () => {
  const fixture = createRepository({ isWaterProduct: true });
  await assert.rejects(
    execute(fixture, adjustment({ type: "StockIn" })),
    (error) => error.code === "INVENTORY_SCOPE_CONFLICT"
  );
  assert.equal(fixture.state.stock, 2);
});

test("blocks sale-style StockOut for rental capacity", async () => {
  const fixture = createRepository({ sourceCategoryCode: "RENTAL" });
  await assert.rejects(
    execute(fixture, adjustment()),
    (error) => error.code === "INVALID_INVENTORY_STATE"
  );
  assert.equal(fixture.state.stock, 2);
});

test("allows an audited rental capacity correction above booked capacity", async () => {
  const fixture = createRepository({ stock: 5, sourceCategoryCode: "RENTAL", peakReserved: 3 });
  const { result } = await execute(fixture, adjustment({
    reasonCode: "CAPACITY_CORRECTION",
    quantity: 2,
  }));

  assert.equal(result.newStock, 3);
  assert.equal(fixture.state.stock, 3);
});

test("blocks a rental capacity correction below peak booked capacity", async () => {
  const fixture = createRepository({ stock: 5, sourceCategoryCode: "RENTAL", peakReserved: 4 });
  await assert.rejects(
    execute(fixture, adjustment({ reasonCode: "CAPACITY_CORRECTION", quantity: 2 })),
    (error) => error.code === "INVENTORY_CONFLICT"
  );
  assert.equal(fixture.state.stock, 5);
});

test("replays an applied rental correction before re-evaluating newer bookings", async () => {
  const fixture = createRepository({ stock: 5, sourceCategoryCode: "RENTAL", peakReserved: 3 });
  const input = adjustment({ reasonCode: "CAPACITY_CORRECTION", quantity: 2 });
  await execute(fixture, input);
  fixture.state.peakReserved = 5;

  const { result } = await execute(fixture, input);
  assert.equal(result.idempotentReplay, true);
  assert.equal(fixture.state.stock, 3);
});
