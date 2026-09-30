import { buildCustomerInput } from "../customers/customerIdentity.js";
import { createCustomer } from "../customers/customerRepository.js";
import { toCustomerValidationError } from "../customers/customerPolicy.js";

// Called inside the authorized Water transaction. Only identity fields may be
// supplied; never edit an existing Core/Water customer's details implicitly.
export async function createWaterCustomer(client, organizationId, payload) {
  const input = buildCustomerInput({ name: payload.name, phone: payload.phone });
  if (input.errors.length) {
    const validation = toCustomerValidationError(input.errors);
    throw Object.assign(new Error(validation.error), { statusCode: 400, code: validation.code });
  }
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
    `water-customer-create:${organizationId}`,
  ]);
  const result = await client.query(
    `SELECT id, name, phone, "deletedAt"
     FROM "customer"
     WHERE "organizationId" = $1
       AND ((LOWER(regexp_replace(TRIM(name), '\\s+', ' ', 'g')) = LOWER($2)
         AND ($3::text IS NULL OR "normalizedPhone" IS NULL OR "normalizedPhone" = $3))
         OR ($3::text IS NOT NULL AND "normalizedPhone" = $3))
     ORDER BY ("normalizedPhone" = $3) DESC NULLS LAST, id ASC
     LIMIT 1`,
    [organizationId, input.value.name, input.value.normalizedPhone]
  );
  const existing = result.rows[0];
  if (existing?.deletedAt) {
    throw Object.assign(new Error("This customer is archived. Ask an administrator to reactivate the existing record."), {
      statusCode: 409, code: "CUSTOMER_ALREADY_EXISTS",
    });
  }
  const customer = existing || await createCustomer(client, organizationId, input.value);
  return {
    created: !existing,
    customer: { id: customer.id, name: customer.name, phone: customer.phone || null },
  };
}
