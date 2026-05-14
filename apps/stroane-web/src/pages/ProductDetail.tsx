import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { HiChevronLeft } from "react-icons/hi";
import { StatusPill } from "@faako/ui";
import Layout from "../components/Layout";
import QuantityControls from "../components/QuantityControls";
import StructuredData from "../components/StructuredData";
import useSEOMeta from "../hooks/useSEOMeta";
import { getProductById, formatCurrency, getStockTone, products } from "../data/products";
import { useCart } from "../context/CartContext";
import "../styles/pages/ProductDetail.css";

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getQty, increment, decrement, remove } = useCart();
  const product = id ? getProductById(id) : undefined;
  const [activeImage, setActiveImage] = useState(0);

  useSEOMeta({
    title: product ? `${product.name} | Stroane Store` : "Product not found | Stroane",
    description: product
      ? `${product.description} Available from Stroane, Ghana's food safety advisory and supply company.`
      : "Product not found in the Stroane catalogue.",
    canonical: product
      ? `https://stroanesolutions.com/products/${product.id}`
      : "https://stroanesolutions.com/shop",
    ogType: "product",
    ogImage: product?.image,
    noIndex: !product,
  });

  if (!product) {
    return (
      <Layout>
        <div className="product-detail-page">
          <div className="product-detail__missing">
            <h1>Product not found</h1>
            <p>The product you're looking for may have been moved or is no longer available.</p>
            <Link to="/shop" className="ui-button ui-button--primary">
              Back to shop
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const images = product.images ?? [product.image];
  const qty = getQty(product.id);
  const mainImage = images[activeImage] ?? images[0];
  const related = products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 3);

  const PRODUCT_SCHEMA = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.sku,
    category: product.category,
    image: `https://stroanesolutions.com${product.image}`,
    offers: {
      "@type": "Offer",
      priceCurrency: "GHS",
      price: product.price,
      availability:
        product.stock === "In stock"
          ? "https://schema.org/InStock"
          : product.stock === "Low stock"
          ? "https://schema.org/LimitedAvailability"
          : "https://schema.org/PreOrder",
      seller: { "@type": "Organization", name: "Stroane" },
    },
  };

  return (
    <Layout>
      <StructuredData schema={PRODUCT_SCHEMA} id="product-schema" />
      <div className="product-detail-page">
        <div className="product-detail__inner">
          <nav className="product-detail__crumbs" aria-label="Breadcrumb">
            <Link to="/shop">Shop</Link>
            <span aria-hidden="true">/</span>
            <span>{product.category}</span>
          </nav>

          <button
            type="button"
            className="product-detail__back"
            onClick={() => navigate(-1)}
          >
            <HiChevronLeft size={18} aria-hidden="true" />
            Back
          </button>

          <div className="product-detail__split">
            {/* Left — gallery */}
            <div className="product-detail__gallery">
              <div className="product-detail__main">
                <img src={mainImage} alt={product.name} />
                {product.tag ? (
                  <span className="product-detail__tag">{product.tag}</span>
                ) : null}
              </div>

              {images.length > 1 ? (
                <div className="product-detail__thumbs" role="tablist" aria-label="Product images">
                  {images.map((src, i) => (
                    <button
                      key={`${src}-${i}`}
                      type="button"
                      role="tab"
                      aria-selected={i === activeImage}
                      className={`product-detail__thumb${i === activeImage ? " product-detail__thumb--active" : ""}`}
                      onClick={() => setActiveImage(i)}
                    >
                      <img src={src} alt="" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Right — info */}
            <div className="product-detail__info">
              <span className="product-detail__category">{product.category}</span>
              <h1 className="product-detail__name">{product.name}</h1>

              <div className="product-detail__price-row">
                <div className="product-detail__price">
                  <strong>{formatCurrency(product.price)}</strong>
                  <span>/{product.unit}</span>
                </div>
                <StatusPill tone={getStockTone(product.stock)}>
                  {product.stock}
                </StatusPill>
              </div>

              <p className="product-detail__desc">{product.description}</p>

              <div className="product-detail__qty-block">
                <QuantityControls
                  qty={qty}
                  onIncrement={() => increment(product.id)}
                  onDecrement={() => decrement(product.id)}
                  onRemove={() => remove(product.id)}
                  size="lg"
                  productName={product.name}
                  addLabel="Add to quote"
                />
                {qty > 0 ? (
                  <p className="product-detail__qty-summary">
                    Subtotal: <strong>{formatCurrency(product.price * qty)}</strong>
                  </p>
                ) : null}
              </div>

              <div className="product-detail__section">
                <h2>What's included</h2>
                <ul className="product-detail__features">
                  {product.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </div>

              <div className="product-detail__section">
                <h2>Specifications</h2>
                <dl className="product-detail__specs">
                  <div>
                    <dt>SKU</dt>
                    <dd>{product.sku}</dd>
                  </div>
                  <div>
                    <dt>Unit</dt>
                    <dd>{product.unit}</dd>
                  </div>
                  <div>
                    <dt>Category</dt>
                    <dd>{product.category}</dd>
                  </div>
                  <div>
                    <dt>Availability</dt>
                    <dd>{product.stock}</dd>
                  </div>
                </dl>
              </div>

              <div className="product-detail__service-note">
                <strong>Need help choosing?</strong>
                <p>
                  Our advisors can recommend the right setup for your kitchen,
                  factory, or branch.{" "}
                  <Link to="/services">View services →</Link>
                </p>
              </div>
            </div>
          </div>

          {related.length > 0 ? (
            <section className="product-detail__related" aria-label="Related products">
              <h2>Related products</h2>
              <div className="product-detail__related-grid">
                {related.map((rel) => (
                  <Link
                    key={rel.id}
                    to={`/products/${rel.id}`}
                    className="product-detail__related-card"
                  >
                    <div className="product-detail__related-image">
                      <img src={rel.image} alt={rel.name} />
                    </div>
                    <span className="product-detail__related-category">
                      {rel.category}
                    </span>
                    <span className="product-detail__related-name">{rel.name}</span>
                    <span className="product-detail__related-price">
                      {formatCurrency(rel.price)}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </Layout>
  );
};

export default ProductDetail;
