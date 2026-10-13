// Server-only adapter. Never return a provider response body to a browser or logger.
export function createPaystack(config, request = fetch) {
  async function call(path, body) {
    const response = await request(`https://api.paystack.co/transaction/${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: "error", signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Payment provider unavailable.");
    const result = await response.json();
    if (result.status !== true || !result.data) throw new Error("Payment provider response unconfirmed.");
    return result.data;
  }
  const reference = value => {
    if (typeof value !== "string" || !/^ttngh-(test|live)-[a-f0-9]{32}$/.test(value)) throw new Error("Invalid donation reference.");
    return value;
  };
  return {
    async initialize(intent) {
      const result = await call("initialize", { email: intent.email, amount: String(intent.amount_pesewas), currency: "GHS", reference: reference(intent.reference), callback_url: config.callback });
      const url = new URL(result.authorization_url);
      if (url.origin !== "https://checkout.paystack.com" || url.username || url.password || url.hash || result.reference !== intent.reference) throw new Error("Invalid hosted payment destination.");
      return { checkoutUrl: url.href };
    },
    async verify(value) {
      const data = await call(`verify/${reference(value)}`);
      // Discard payment instrument details, customer metadata and authorization codes.
      return { reference: data.reference, amount: data.amount, currency: data.currency, domain: data.domain, status: data.status, id: data.id, paid_at: data.paid_at };
    },
  };
}
