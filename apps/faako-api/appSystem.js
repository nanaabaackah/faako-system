export default {
  appId: "@faako/faako-api",
  brand: {
    name: "Faako API",
    shortName: "API",
    browserChromeColor: "#0f172a",
  },
  theme: {
    presetId: "faako-api",
  },
  security: {
    profileId: "api-service",
    authMode: "none",
    allowedOrigins: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://localhost:5176",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
      "http://127.0.0.1:5175",
      "http://127.0.0.1:5176",
      "http://localhost:8888",
      "http://127.0.0.1:8888",
      "http://localhost:8889",
      "http://127.0.0.1:8889",
      "https://faako.nanaabaackah.com",
      "https://faako-erp.nanaabaackah.com",
    ],
  },
};
