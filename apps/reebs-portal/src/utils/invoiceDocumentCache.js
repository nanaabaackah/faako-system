const invoiceRequestCache = new Map();

const readJsonResponse = async (response, fallbackMessage) => {
  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error || fallbackMessage || `Request failed: ${response.status}`);
  }

  return payload;
};

const fetchJsonOnce = (cacheKey, url, fallbackMessage) => {
  const key = String(cacheKey || "").trim();
  if (!key) {
    return Promise.reject(new Error("Missing invoice request cache key."));
  }

  const cachedRequest = invoiceRequestCache.get(key);
  if (cachedRequest) return cachedRequest;

  const request = fetch(url)
    .then((response) => readJsonResponse(response, fallbackMessage))
    .finally(() => {
      invoiceRequestCache.delete(key);
    });

  invoiceRequestCache.set(key, request);
  return request;
};

export const fetchInvoiceDocumentById = (id) => {
  const documentId = Number(id);
  if (!Number.isFinite(documentId) || documentId <= 0) {
    return Promise.reject(new Error("Missing invoice document id."));
  }
  return fetchJsonOnce(
    `invoice-document:${documentId}`,
    `/api/invoice-documents?id=${encodeURIComponent(documentId)}`,
    "Failed to load invoice document."
  );
};

export const fetchBookingInvoiceDetails = (bookingId) => {
  const sourceId = Number(bookingId);
  if (!Number.isFinite(sourceId) || sourceId <= 0) {
    return Promise.reject(new Error("Missing booking id."));
  }
  return fetchJsonOnce(
    `booking-invoice-details:${sourceId}`,
    `/api/getInvoiceDetails?id=${encodeURIComponent(sourceId)}`,
    "Failed to load booking invoice details."
  );
};

export const fetchOrderInvoiceDetails = (orderId) => {
  const sourceId = Number(orderId);
  if (!Number.isFinite(sourceId) || sourceId <= 0) {
    return Promise.reject(new Error("Missing order id."));
  }
  return fetchJsonOnce(
    `order-invoice-details:${sourceId}`,
    `/api/generateInvoice?orderId=${encodeURIComponent(sourceId)}`,
    "Failed to load order invoice details."
  );
};
