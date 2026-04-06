export default {
  appId: "@faako/faako-erp",
  brand: {
    name: "Faako ERP",
    shortName: "FAAKO",
    browserChromeColor: "#f2f4f8",
  },
  theme: {
    presetId: "faako-erp",
  },
  security: {
    profileId: "authenticated-workspace",
    authMode: "cookie",
    allowedOrigins: [
      "http://localhost:5176",
      "http://127.0.0.1:5176",
      "https://faako.nanaabaackah.com",
    ],
  },
};
