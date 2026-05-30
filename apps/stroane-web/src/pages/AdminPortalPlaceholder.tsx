import React from "react";
import useSEOMeta from "../hooks/useSEOMeta";
import "../styles/pages/AdminPortal.css";

type AdminPortalPlaceholderArea = "products" | "reports" | "settings";

const AREA_COPY: Record<AdminPortalPlaceholderArea, { title: string; description: string }> = {
  products: {
    title: "Products",
    description: "Catalogue operations will live here. Product setup remains data-driven for now.",
  },
  reports: {
    title: "Reports",
    description: "Operational reporting is prepared as a portal namespace without adding analytics scope yet.",
  },
  settings: {
    title: "Settings",
    description: "Portal settings are intentionally limited until operational requirements are confirmed.",
  },
};

const AdminPortalPlaceholder: React.FC<{ area: AdminPortalPlaceholderArea }> = ({ area }) => {
  const copy = AREA_COPY[area];

  useSEOMeta({
    title: `${copy.title} | Stroane operations`,
    description: `Private Stroane ${copy.title.toLowerCase()} portal area.`,
    canonical: `https://stroanesolutions.com/admin/${area}`,
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
