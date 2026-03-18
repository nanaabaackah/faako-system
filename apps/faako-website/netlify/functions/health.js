const headers = {
  "content-type": "application/json"
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
