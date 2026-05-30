import React from "react";
import {
  HiOutlineClipboardList,
  HiOutlineCube,
  HiOutlineOfficeBuilding,
  HiOutlineShoppingBag,
} from "react-icons/hi";
import { Link } from "react-router-dom";
import useSEOMeta from "../hooks/useSEOMeta";
import "../styles/pages/AdminPortal.css";

const AdminPortalHome: React.FC = () => {
  useSEOMeta({
    title: "Operations portal | Stroane",
    description: "Private Stroane operations overview.",
    canonical: "https://stroanesolutions.com/admin",
    noIndex: true,
  });

  return (
    <section className="stroane-portal-overview">
      <header>
        <span>Internal operations</span>
        <h1>Operations overview</h1>
        <p>Use the portal for staff-only inventory, supplier, product, and order work.</p>
      </header>
      <div className="stroane-portal-overview__links">
        <Link to="/admin/inventory">
          <HiOutlineCube aria-hidden="true" />
          <span><strong>Inventory</strong><small>Review stock and movement history</small></span>
        </Link>
        <Link to="/admin/suppliers">
          <HiOutlineOfficeBuilding aria-hidden="true" />
          <span><strong>Suppliers</strong><small>Review supplier contacts and linked products</small></span>
        </Link>
        <Link to="/admin/products">
          <HiOutlineShoppingBag aria-hidden="true" />
          <span><strong>Products</strong><small>Prepared namespace for catalogue operations</small></span>
        </Link>
        <Link to="/admin/operations">
          <HiOutlineClipboardList aria-hidden="true" />
          <span><strong>Operations</strong><small>Review existing order operations</small></span>
        </Link>
      </div>
    </section>
  );
};

export default AdminPortalHome;
