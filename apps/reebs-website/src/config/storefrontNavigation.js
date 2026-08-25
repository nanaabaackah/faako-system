export const STOREFRONT_PRIMARY_NAVIGATION = Object.freeze([
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/rentals", label: "Rentals" },
  { href: "/book", label: "Book a party" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
]);

export const STOREFRONT_HEADER_NAVIGATION = Object.freeze(
  STOREFRONT_PRIMARY_NAVIGATION.filter((link) => link.href !== "/about"),
);

export const STOREFRONT_ACCOUNT_NAVIGATION = Object.freeze([
  { href: "/customer-login", label: "Customer login" },
  { href: "/cart", label: "Cart" },
  { href: "/checkout", label: "Checkout" },
]);

export const STOREFRONT_HELP_NAVIGATION = Object.freeze([
  { href: "/faq", label: "FAQ" },
  { href: "/delivery-policy", label: "Delivery policy" },
  { href: "/refund-policy", label: "Refund policy" },
  { href: "/privacy-policy", label: "Privacy & cookie policy" },
  { href: "/terms-of-service", label: "Terms of service" },
]);

export const STOREFRONT_NAVIGATION_GROUPS = Object.freeze([
  { label: "Explore", links: STOREFRONT_PRIMARY_NAVIGATION },
  { label: "Account", links: STOREFRONT_ACCOUNT_NAVIGATION },
  { label: "Help & policies", links: STOREFRONT_HELP_NAVIGATION },
]);
