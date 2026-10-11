const WATER_APP_URL = "https://water.reebspartythemes.com";

export const waterAppSystem = {
  appId: "@faako/reebs-water",
  brand: {
    name: "REEBS Water",
    businessName: "REEBS Party Themes",
    shortName: "Water",
    browserChromeColor: "#ffffff",
  },
  theme: {
    presetId: "reebs-portal",
  },
  security: {
    profileId: "authenticated-workspace",
    authMode: "cookie",
    allowedOrigins: [
      WATER_APP_URL,
      "http://localhost:5179",
      "http://127.0.0.1:5179",
    ],
  },
};
