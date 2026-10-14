import { reebsApiResponse } from "./client.js";

export async function getWaterCustomer(id, signal) {
  const response = await reebsApiResponse(`/api/customers?scope=water&id=${encodeURIComponent(id)}`, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Customer details could not be loaded.");
  if (data.scope !== "water" || !data.customer || !Array.isArray(data.waterSales)
    || !Number.isFinite(Number(data.waterTotals?.outstandingCents))
    || !Number.isFinite(Number(data.waterCredit?.availableCents))) {
    throw new Error("Update the REEBS API before using Water customer balances and credit.");
  }
  return data;
}

export async function updateWaterCustomer(id, fields) {
  const response = await reebsApiResponse("/api/customers?scope=water", {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...fields }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Customer changes could not be saved.");
  return data;
}
