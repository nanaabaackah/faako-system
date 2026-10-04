import { reebsApiResponse } from "../../../api/client.js";

// Keep only a digest and random retry key, never the customer/payment payload.
// Retain the key on an uncertain network/server failure, including page reload.
// There are deliberately no automatic mutation retries.
export const postWaterCommand = async (payload) => {
  const body = JSON.stringify(payload);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  const storageKey = `reebs:water:pending:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  let key;
  try {
    key = sessionStorage.getItem(storageKey) || crypto.randomUUID();
    sessionStorage.setItem(storageKey, key);
  } catch {
    throw new Error("Water saves need browser session storage for safe retry protection. Enable it and try again.");
  }
  const response = await reebsApiResponse("/api/water", {
    method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // Confirmed validation rejection cannot have committed; a new attempt can
    // use updated configuration without being trapped behind an obsolete key.
    if ([400, 403, 404, 409, 422].includes(response.status)) sessionStorage.removeItem(storageKey);
    throw new Error(data?.error || "Unable to save Water activity. Retry the same form to safely check the result.");
  }
  if (data?.product?.key !== payload.productKey) {
    throw new Error("The API returned a different Water product. Refresh and verify the saved record before trying again.");
  }
  sessionStorage.removeItem(storageKey);
  return data;
};
