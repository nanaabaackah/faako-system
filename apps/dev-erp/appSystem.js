export default {
  appId: "@faako/dev-erp",
  brand: {
    name: "Dev ERP",
    shortName: "DEV",
    browserChromeColor: "#f6f1e8",
  },
  theme: {
    presetId: "dev-erp",
  },
  security: {
    profileId: "authenticated-workspace",
    authMode: "bearer",
    allowedOrigins: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4173",
      "http://localhost:8888",
      "https://dev.nanaabaackah.com",
      "https://faako.nanaabaackah.com",
    ],
  },
};
