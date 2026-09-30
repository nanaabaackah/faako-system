import assert from "node:assert/strict";
import test from "node:test";
import { createCustomer, findCustomerById, listCustomers } from "./customerRepository.js";

test("customer lookup is always organization scoped", async () => {
  const calls = [];
  const client = {
    query: async (sql, values) => {
      calls.push({ sql, values });
      return { rows: [], rowCount: 0 };
    },
  };
  await findCustomerById(client, 17, 42);
  assert.match(calls[0].sql, /c\.id = \$1 AND c\."organizationId" = \$2/);
  assert.deepEqual(calls[0].values, [42, 17]);
});

test("Core customer list excludes Water commercial data", async () => {
  const calls = [];
  const client = {
    query: async (sql, values) => {
      calls.push({ sql, values });
      return calls.length === 1
        ? { rows: [{ total: 0 }] }
        : { rows: [] };
    },
  };
  await listCustomers(client, 1, { scope: "core" });
  assert.match(calls[1].sql, /COALESCE\("businessUnit", 'REEBS_CORE'\) = 'REEBS_CORE'/);
  assert.doesNotMatch(calls[1].sql, /water_revenue/);
});

test("Water customer list exposes only explicitly named Water metrics", async () => {
  const calls = [];
  const client = {
    query: async (sql, values) => {
      calls.push({ sql, values });
      return calls.length === 1
        ? { rows: [{ total: 0 }] }
        : { rows: [] };
    },
  };
  await listCustomers(client, 1, { scope: "water" });
  assert.match(calls[1].sql, /water_revenue/);
  assert.doesNotMatch(calls[1].sql, /total_spent/);
  assert.doesNotMatch(calls[1].sql, /total_rented/);
});

test("customer creation allocates the reference in the insert without a shared placeholder", async () => {
  const calls = [];
  const client = {
    query: async (sql, values) => {
      calls.push({ sql, values });
      if (calls.length === 1) return { rows: [{ id: 42 }], rowCount: 1 };
      return { rows: [{ id: 42, reference: "CUS-000042", organizationId: 7 }], rowCount: 1 };
    },
  };
  await createCustomer(client, 7, {
    customerType: "individual",
    name: "Ama Mensah",
    organizationName: null,
    contactPersonName: null,
    email: null,
    normalizedEmail: null,
    phone: "+233 24 412 3456",
    normalizedPhone: "+233244123456",
    secondaryPhone: null,
    normalizedSecondaryPhone: null,
    addressLine1: null,
    addressLine2: null,
    locality: null,
    region: null,
    ghanaPostGps: null,
    preferredContactMethod: "phone",
    internalNotes: null,
  });
  assert.match(calls[0].sql, /nextval\(pg_get_serial_sequence/);
  assert.match(calls[0].sql, /'CUS-' \|\| LPAD/);
  assert.doesNotMatch(calls[0].sql, /PENDING/);
  assert.equal(calls.length, 2);
});
