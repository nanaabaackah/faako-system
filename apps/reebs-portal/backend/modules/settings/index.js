export const settingsModule = Object.freeze({
  domain: "settings",
  handlers: ["authSession", "login", "logout", "portal-settings", "resetPassword", "websiteContent"],
  migratedHandlers: ["portal-settings"],
});
