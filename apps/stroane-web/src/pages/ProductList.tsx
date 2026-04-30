import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Product } from "../types/index";
import Layout from "../components/Layout";
import usePageTitle from "../hooks/usePageTitle";
import "../styles/pages/ProductList.css";

const ProductList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  usePageTitle("Products");

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
        <p className="products-status">Loading products…</p>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <p className="products-status products-status--error">Error: {error}</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="products-page">
        <h1 className="products-page__heading">Products</h1>
        <p className="products-page__sub">
          Food safety equipment and supplies available for order. All prices in
          GHS inclusive of VAT.
        </p>

        {products.length === 0 ? (
          <div className="products-empty">
            <p className="products-empty__title">Product listings are being added.</p>
            <p className="products-empty__sub">
              Contact us directly to enquire about availability and pricing.
            </p>
            <div className="products-empty__actions">
              <Link to="/shop" className="products-empty__btn products-empty__btn--outline">
                Browse categories
              </Link>
              <a
                href="mailto:info@stroane.com"
                className="products-empty__btn products-empty__btn--primary"
              >
                Contact us
              </a>
            </div>
          </div>
        ) : (
          <div className="products-grid">
            {products.map((product) => (
              <Link
                key={product.id}
                to={`/products/${product.id}`}
                className="product-card-link"
              >
                <article className="product-card">
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
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ProductList;
