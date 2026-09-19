const readJson = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const requestJson = async (path, options = {}, failureMessage = "Request failed") => {
  const response = await fetch(path, options);
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(payload?.error || `${failureMessage} (${response.status}).`);
  }
  return payload;
};

export const fetchRentalProducts = async () => {
  const payload = await requestJson("/api/inventory", {}, "Failed to fetch products");
  return (Array.isArray(payload) ? payload : []).filter((item) => {
    const sku = String(item.sku || "").toUpperCase();
    const source = String(item.sourceCategoryCode || item.sourcecategorycode || "").toUpperCase();
    const name = String(item.name || "").toLowerCase();
    const isPump = sku.startsWith("PUM") || name.includes("motor pump");
    return (source === "RENTAL" || sku.startsWith("RENT")) && !isPump;
  });
};

export const fetchBookingCustomers = async () => {
  const payload = await requestJson("/api/customers?compact=1&limit=200", {}, "Failed to fetch customers");
  return Array.isArray(payload) ? payload : [];
};

export const fetchBouncyCastles = async () => {
  const payload = await requestJson("/api/bouncy_castles", {}, "Failed to fetch bouncy castles");
  return Array.isArray(payload) ? payload : [];
};

export const fetchBookingDeliveries = async () => {
  const payload = await requestJson("/api/deliveries", {}, "Failed to fetch deliveries");
  return Array.isArray(payload) ? payload : [];
};

export const fetchBookingExpenses = async () => {
  const payload = await requestJson("/api/expenses", {}, "Failed to fetch expenses");
  return Array.isArray(payload) ? payload : [];
};

export const fetchBookingById = (bookingId, { signal } = {}) =>
  requestJson(`/api/bookings?id=${bookingId}`, { signal }, "Failed to fetch booking");

export const fetchBookingOverview = async ({ canManageBookings }) => {
  const [bookings, users, documents] = await Promise.all([
    requestJson("/api/bookings?compact=1", {}, "Failed to fetch bookings"),
    canManageBookings
      ? requestJson("/api/users", {}, "Failed to fetch team members")
      : Promise.resolve([]),
    canManageBookings
      ? requestJson("/api/invoice-documents?compact=1", {}, "Failed to fetch invoice documents")
      : Promise.resolve([]),
  ]);
  return {
    bookings: Array.isArray(bookings) ? bookings : [],
    users: Array.isArray(users) ? users : [],
    documents: Array.isArray(documents) ? documents : [],
  };
};

const jsonMutation = (path, method, payload, { idempotencyKey, failureMessage } = {}) =>
  requestJson(
    path,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(payload),
    },
    failureMessage || "Request failed"
  );

export const createBookingExpense = (payload) =>
  jsonMutation("/api/expenses", "POST", payload, { failureMessage: "Failed to add expense" });

export const createBookingCustomer = (payload) =>
  jsonMutation("/api/customers", "POST", payload, { failureMessage: "Failed to create customer" });

export const submitBooking = ({
  method,
  payload,
  idempotencyKey,
  path = "/api/bookings",
  failureMessage = "Failed to save booking",
}) => jsonMutation(path, method, payload, { idempotencyKey, failureMessage });
