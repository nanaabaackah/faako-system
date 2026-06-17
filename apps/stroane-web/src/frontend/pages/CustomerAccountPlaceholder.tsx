import React from "react";
import { Link } from "react-router-dom";
import Layout from "../../components/Layout";
import { useAuth } from "../../context/AuthContext";
import useSEOMeta from "../../hooks/useSEOMeta";
import "../styles/AccountPlaceholder.css";

type CustomerArea = "account" | "orders" | "quotes";

const AREA_COPY: Record<CustomerArea, { title: string; description: string }> = {
  account: {
    title: "Your account",
    description: "Customer account services are being prepared as a separate experience.",
  },
  orders: {
    title: "Your orders",
    description: "Customer order history is not connected yet. This namespace is reserved for the account area.",
  },
  quotes: {
    title: "Your quotes",
    description: "Quote requests for custom, bulk, and special-order work will live here when enabled.",
  },
};

const CustomerAccountPlaceholder: React.FC<{ area: CustomerArea }> = ({ area }) => {
  const { user } = useAuth();
  const copy = AREA_COPY[area];

  useSEOMeta({
    title: copy.title,
    description: copy.description,
    canonical: `https://stroanesolutions.com/${area}`,
    noIndex: true,
  });

  return (
    <Layout>
      <section className="customer-account-placeholder">
        <div>
          <span>Customer account</span>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
          {user ? (
            <p className="customer-account-placeholder__status">Signed in as {user.email}.</p>
          ) : (
            <Link className="customer-account-placeholder__action" to="/signup">
              Save a profile
            </Link>
          )}
          <Link className="customer-account-placeholder__link" to="/catalogue">
            Browse catalogue
          </Link>
        </div>
      </section>
    </Layout>
  );
};

export default CustomerAccountPlaceholder;
