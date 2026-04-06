export default {
  appId: "@faako/reebs-portal",
  brand: {
    name: "REEBS Portal",
    shortName: "REEBS",
    browserChromeColor: "#ffffff",
  },
  theme: {
    presetId: "reebs-portal",
  },
  security: {
    profileId: "authenticated-workspace",
    authMode: "cookie",
    allowedOrigins: [
      "https://www.reebspartythemes.com",
      "https://reebspartythemes.com",
      "https://portal.reebspartythemes.com",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:8888",
    ],
  },
};
