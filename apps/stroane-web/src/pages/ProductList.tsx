import React from "react";
import { Link } from "react-router-dom";
import { Card, EmptyState, InlineNotice, PageHeader, PageShell } from "@faako/ui";
import Layout from "../components/Layout";
import useSEOMeta from "../hooks/useSEOMeta";
import useCatalogueData from "../hooks/useCatalogueData";
import { formatProductPrice, getAvailabilityLabel, getStockDetailLabel } from "../data/products";
import "../styles/pages/ProductList.css";

const ProductList: React.FC = () => {
  const { products, loading, notice } = useCatalogueData();

  useSEOMeta({
    title: "Food Safety Products Ghana | Stroane",
    description:
      "Browse Stroane's range of food safety equipment and supplies for Ghanaian businesses. All prices in GHS inclusive of VAT.",
    keywords: "food safety products Ghana, buy food safety supplies Ghana",
    canonical: "https://www.stroanesolutions.com/products",
  });

  if (loading) {
    return (
      <Layout>
        <PageShell className="products-page">
          <InlineNotice tone="loading" title="Loading products" />
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

        {notice ? (
          <InlineNotice tone="info" title="Catalogue fallback active" message={notice} />
        ) : null}

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
            {products.map((product) => {
              const stockDetail = getStockDetailLabel(product);

              return (
                <Link
                  key={product.id}
                  to={`/products/${product.id}`}
                  className="product-card-link"
                >
                  <Card className="product-card">
                    <div className="product-card__media">
                      <img
                        src={product.thumbnailUrl || product.image}
                        alt={product.imageAlt || product.name}
                        loading="lazy"
                      />
                    </div>
                    <div className="product-card__body">
                      <span className="product-card__category">{product.category}</span>
                      <h2 className="product-card__name">{product.name}</h2>
                      <p className="product-card__desc">{product.description}</p>
                      {stockDetail ? (
                        <p className="product-card__stock-detail">{stockDetail}</p>
                      ) : null}
                      <div className="product-card__footer">
                        <span className="product-card__price">
                          {formatProductPrice(product)}
                        </span>
                        <span className="product-card__stock">
                          {getAvailabilityLabel(product)}
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </PageShell>
    </Layout>
  );
};

export default ProductList;
