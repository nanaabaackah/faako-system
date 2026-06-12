import React from "react";
import useSEOMeta from "../../hooks/useSEOMeta";
import { portalUrl } from "../../config/appSurface";
import "../../styles/pages/AdminPortal.css";

type AdminPortalPlaceholderArea =
  | "inventory"
  | "suppliers"
  | "products"
  | "operations"
  | "reports"
  | "settings";

const AREA_COPY: Record<AdminPortalPlaceholderArea, { title: string; description: string }> = {
  inventory: {
    title: "Inventory",
    description:
      "This module has been cleared for a fresh rebuild. Dashboard product and stock signals remain available.",
  },
  suppliers: {
    title: "Suppliers",
    description:
      "This module has been cleared for a fresh rebuild. Supplier signals remain dashboard-only for now.",
  },
  products: {
    title: "Products",
    description:
      "This module has been cleared for a fresh rebuild. Product fetches remain available to the dashboard and storefront.",
  },
  operations: {
    title: "Operations",
    description:
      "This module has been cleared for a fresh rebuild. Order operations are intentionally out of the portal shell.",
  },
  reports: {
    title: "Reports",
    description:
      "This module has been cleared for a fresh rebuild. Reporting scope will be reintroduced after the dashboard settles.",
  },
  settings: {
    title: "Settings",
    description:
      "This module has been cleared for a fresh rebuild. Portal settings will return when the new module shape is defined.",
  },
};

const AdminPortalPlaceholder: React.FC<{ area: AdminPortalPlaceholderArea }> = ({ area }) => {
  const copy = AREA_COPY[area];

  useSEOMeta({
    title: `${copy.title} | Stroane operations`,
    description: `Private Stroane ${copy.title.toLowerCase()} portal area.`,
    canonical: portalUrl(`/admin/${area}`),
    noIndex: true,
  });

  return (
    <section className="stroane-portal-placeholder">
      <span>Internal operations</span>
      <h1>{copy.title}</h1>
      <p>{copy.description}</p>
    </section>
  );
};

export default AdminPortalPlaceholder;
