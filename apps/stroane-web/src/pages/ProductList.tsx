import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, EmptyState, InlineNotice, PageHeader, PageShell } from "@faako/ui";
import type { Product } from "../types/index";
import Layout from "../components/Layout";
import useSEOMeta from "../hooks/useSEOMeta";
import "../styles/pages/ProductList.css";

const ProductList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useSEOMeta({
    title: "Food Safety Products Ghana | Stroane",
    description:
      "Browse Stroane's range of food safety equipment and supplies for Ghanaian businesses. All prices in GHS inclusive of VAT.",
    keywords: "food safety products Ghana, buy food safety supplies Ghana",
    canonical: "https://stroanesolutions.com/products",
  });

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        // TODO: Uncomment when API is implemented
        // const data = await productApi.getAll();
        // setProducts(data);
        setProducts([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch products");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) {
    return (
      <Layout>
        <PageShell className="products-page">
          <InlineNotice tone="loading" title="Loading products" />
        </PageShell>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <PageShell className="products-page">
          <InlineNotice tone="error" title="Products unavailable" message={error} />
        </PageShell>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageShell className="products-page">
        <PageHeader
          title="Products"
          titleClassName="products-page__heading"
          subtitle="Food safety equipment and supplies available for order. All prices in GHS inclusive of VAT."
          subtitleClassName="products-page__sub"
        />

        {products.length === 0 ? (
          <EmptyState
            className="products-empty"
            title="Product listings are being added."
            message="Contact us directly to enquire about availability and pricing."
            actions={
              <>
                <Link to="/shop" className="ui-button ui-button--secondary">
                  Browse categories
                </Link>
                <a href="mailto:info@stroanesolutions.com" className="ui-button ui-button--primary">
                  Contact us
                </a>
              </>
            }
          />
        ) : (
          <div className="products-grid">
            {products.map((product) => (
              <Link
                key={product.id}
                to={`/products/${product.id}`}
                className="product-card-link"
              >
                <Card className="product-card">
                  <h2 className="product-card__name">{product.name}</h2>
                  <p className="product-card__desc">{product.description}</p>
                  <div className="product-card__footer">
                    <span className="product-card__price">
                      GHS {product.price.toFixed(2)}
                    </span>
                    <span className="product-card__stock">
                      {product.inventory > 0
                        ? `${product.inventory} in stock`
                        : "Out of stock"}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </PageShell>
    </Layout>
  );
};

export default ProductList;
