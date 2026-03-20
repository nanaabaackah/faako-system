const headers = {
  "cache-control": "no-store",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "content-type": "application/json",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY"
};

exports.handler = async () => ({
  statusCode: 200,
  headers,
  body: JSON.stringify({
    ok: true,
    service: "faako-api",
    timestamp: new Date().toISOString()
  })
});
