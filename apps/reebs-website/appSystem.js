export default {
  appId: "@faako/reebs-website",
  brand: {
    name: "REEBS Website",
    shortName: "REEBS",
    browserChromeColor: "#ffffff",
  },
  theme: {
    presetId: "reebs-website",
  },
  security: {
    profileId: "public-interactive",
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
