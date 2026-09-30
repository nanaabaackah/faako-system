export default {
  appId: "@faako/travel-with-ease-api",
  brand: { name: "Travel With Ease API" },
  theme: { presetId: "core-neutral" },
  security: {
    profileId: "api-service",
    authMode: "bearer",
    // Development origins only; deployed origins come from ALLOWED_ORIGINS.
    allowedOrigins: ["http://localhost:4328", "http://localhost:5188"],
  },
};
