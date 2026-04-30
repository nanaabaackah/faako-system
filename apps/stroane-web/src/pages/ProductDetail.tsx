import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Product } from "../types/index";
import Layout from "../components/Layout";
import usePageTitle from "../hooks/usePageTitle";
import "../styles/pages/ProductDetail.css";

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  usePageTitle(product ? product.name : "Product");

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        if (id) {
          // TODO: Uncomment when API is implemented
          // const data = await productApi.getById(parseInt(id));
          // setProduct(data);
          setProduct(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch product");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <p className="product-detail-status">Loading product…</p>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <p className="product-detail-status product-detail-status--error">
          Error: {error}
        </p>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="product-detail__not-found">
          <p>Product not found.</p>
          <Link to="/products" className="product-detail__back">
            ← Back to Products
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="product-detail-page">
        <Link to="/products" className="product-detail__back">
          ← Back to Products
        </Link>

        <div className="product-detail__card">
          <h1 className="product-detail__name">{product.name}</h1>
          <p className="product-detail__desc">{product.description}</p>

          <div className="product-detail__meta">
            <div className="product-detail__meta-row">
              <span className="product-detail__meta-label">Price</span>
              <span className="product-detail__price">
                GHS {product.price.toFixed(2)}
              </span>
            </div>
            <div className="product-detail__meta-row">
              <span className="product-detail__meta-label">Availability</span>
              <span
                className={
                  product.inventory > 0
                    ? "product-detail__in-stock"
                    : "product-detail__out-of-stock"
                }
              >
                {product.inventory > 0
                  ? `${product.inventory} in stock`
                  : "Out of stock"}
              </span>
            </div>
          </div>

          <a href="mailto:info@stroane.com" className="product-detail__cta">
            Enquire to Order
          </a>
          <p className="product-detail__note">
            Online checkout coming soon. Contact us to place an order.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default ProductDetail;
