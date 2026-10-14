export const productionOrigin = "https://thethrivingnetworkgh.org";

export function isIndexable(site, enabled) {
  try {
    return enabled === "true" && new URL(site).origin === productionOrigin;
  } catch {
    return false;
  }
}
