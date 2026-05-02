import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, EmptyState, InlineNotice, PageShell, StatusPill } from "@faako/ui";
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
        <PageShell className="product-detail-page">
          <InlineNotice tone="loading" title="Loading product" />
        </PageShell>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <PageShell className="product-detail-page">
          <InlineNotice tone="error" title="Product unavailable" message={error} />
        </PageShell>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <PageShell className="product-detail-page">
          <EmptyState
            className="product-detail__not-found"
            title="Product not found."
            actions={
              <Link to="/products" className="ui-button ui-button--secondary">
                Back to Products
              </Link>
            }
          />
        </PageShell>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageShell className="product-detail-page">
        <Link to="/products" className="product-detail__back">
          ← Back to Products
        </Link>

        <Card className="product-detail__card">
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
              <StatusPill tone={product.inventory > 0 ? "success" : "danger"}>
                {product.inventory > 0 ? `${product.inventory} in stock` : "Out of stock"}
              </StatusPill>
            </div>
          </div>

          <a
            href="mailto:info@stroane.com"
            className="ui-button ui-button--primary product-detail__cta"
          >
            Enquire to Order
          </a>
          <p className="product-detail__note">
            Online checkout coming soon. Contact us to place an order.
          </p>
        </Card>
      </PageShell>
    </Layout>
  );
};

export default ProductDetail;
