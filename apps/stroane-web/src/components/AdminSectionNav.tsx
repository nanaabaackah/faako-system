import React from "react";
import { HiOutlineClipboardList, HiOutlineCube } from "react-icons/hi";
import { NavLink } from "react-router-dom";
import "../styles/components/AdminSectionNav.css";

const AdminSectionNav: React.FC = () => (
  <nav className="admin-section-nav" aria-label="Admin sections">
    <NavLink to="/admin/orders">
      <HiOutlineClipboardList aria-hidden="true" />
      Orders
    </NavLink>
    <NavLink to="/admin/inventory">
      <HiOutlineCube aria-hidden="true" />
      Inventory
    </NavLink>
  </nav>
);

export default AdminSectionNav;
