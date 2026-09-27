// Reviewed release policy, shared by the REEBS API and Astro storefront.
// This is deliberately not a browser preference or an environment-file toggle.
// Reopening public commerce requires an approved code change and regression pass.
export const REEBS_PUBLIC_COMMERCE = Object.freeze({
  checkoutEnabled: false,
  bookingEnabled: false,
  disabledCode: "PUBLIC_COMMERCE_DISABLED",
  disabledMessage: "Online purchases and rental bookings are currently unavailable. Please contact REEBS for assistance.",
});
