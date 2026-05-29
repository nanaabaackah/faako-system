import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { HiChevronLeft } from "react-icons/hi";
import { StatusPill } from "@faako/ui";
import Layout from "../components/Layout";
import QuantityControls from "../components/QuantityControls";
import StructuredData from "../components/StructuredData";
import ProductInquiryForm from "../components/ProductInquiryForm";
import useSEOMeta from "../hooks/useSEOMeta";
import {
  canPurchaseProduct,
  getAvailableStockQuantity,
  getLineTotal,
  getProductById,
  formatCurrency,
  formatProductPrice,
  formatVariantPrice,
  getAvailabilityLabel,
  getStockDetailLabel,
  getPurchaseBlocker,
  getProductMedia,
  getProductSpecifications,
  getSchemaAvailability,
  getStockTone,
  isPricedProduct,
  normalizeStockStatus,
  PRODUCT_STOCK_LABELS,
  normalizeProduct,
  products,
  shouldShowInquiryOption,
  type Product,
  type ProductVariant,
} from "../data/products";
import { productApi } from "../api/products";
import { useCart } from "../context/CartContext";
import "../styles/pages/ProductDetail.css";

const formatSpecificationLabel = (label: string) =>
  label
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getQty, increment, decrement, remove } = useCart();
  const localProduct = id ? getProductById(id) : undefined;
  const [remoteProduct, setRemoteProduct] = useState<Product | null>(null);
  const [detailLoading, setDetailLoading] = useState(Boolean(id && !localProduct));
  const [detailNotice, setDetailNotice] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [activeVariantId, setActiveVariantId] = useState("");
  const product = remoteProduct || localProduct;

  useEffect(() => {
    let cancelled = false;

    if (!id) {
      setRemoteProduct(null);
      setDetailLoading(false);
      setDetailNotice(null);
      return undefined;
    }

    const loadProduct = async () => {
      setDetailLoading(!localProduct);
      setDetailNotice(null);

      try {
        const apiProduct = await productApi.getById(id);
        if (cancelled) return;
        setRemoteProduct(normalizeProduct(apiProduct));
      } catch (error) {
        if (cancelled) return;
        setRemoteProduct(null);
        if (localProduct) {
          setDetailNotice(
            error instanceof Error
              ? `Showing local product details while the backend is unavailable: ${error.message}`
              : "Showing local product details while the backend is unavailable."
          );
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };

    loadProduct();

    return () => {
      cancelled = true;
    };
  }, [id, localProduct]);

  useEffect(() => {
    setActiveImage(0);
    setActiveVariantId(product?.variants?.[0]?.id || "");
  }, [product?.id, product?.variants]);

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

  if (detailLoading && !product) {
    return (
      <Layout>
        <div className="product-detail-page">
          <div className="product-detail__missing">
            <h1>Loading product</h1>
            <p>Checking the latest catalogue details.</p>
          </div>
        </div>
      </Layout>
    );
  }

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

  const variants = product.variants || [];
  const activeVariant =
    variants.find((variant) => variant.id === activeVariantId) || variants[0] || null;
  const mediaItems = getProductMedia(product, activeVariant);
  const images = mediaItems.map((item) => item.url);
  const qty = getQty(product.id);
  const canAddOne = canPurchaseProduct(product, qty + 1);
  const canStartCart = canPurchaseProduct(product, 1);
  const availableQuantity = getAvailableStockQuantity(product);
  const maxQuantity = product.allowBackorder ? null : availableQuantity ?? product.stockQuantity;
  const purchaseBlocker = getPurchaseBlocker(product, Math.max(qty, 1));
  const showInquiry = shouldShowInquiryOption(product);
  const stockDetail = getStockDetailLabel(product);
  const activeMedia = mediaItems[activeImage] || mediaItems[0];
  const mainImage = activeMedia?.url || product.image;
  const mainImageAlt = activeMedia?.alt || activeVariant?.imageAlt || product.imageAlt || product.name;
  const related = products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 3);
  const specificationEntries = [
    { label: "SKU", value: activeVariant?.sku || product.sku },
    { label: "Unit", value: product.unit },
    { label: "Category", value: product.category },
    { label: "Availability", value: getAvailabilityLabel(product) },
    { label: "Brand", value: product.brand },
    ...getProductSpecifications(product).map((specification) => ({
      label: formatSpecificationLabel(specification.label),
      value: specification.group
        ? `${specification.value} (${specification.group})`
        : specification.value,
    })),
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry.value));
  const getVariantAvailabilityLabel = (variant: ProductVariant) =>
    PRODUCT_STOCK_LABELS[normalizeStockStatus(variant.stockStatus)] || "Unavailable";

  const PRODUCT_SCHEMA = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.sku,
    category: product.category,
    image: `https://stroanesolutions.com${mainImage}`,
    ...(isPricedProduct(product)
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "GHS",
            price: product.price,
            availability: getSchemaAvailability(product),
            seller: { "@type": "Organization", name: "Stroane" },
          },
        }
      : {}),
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

          {detailNotice ? (
            <p className="product-detail__notice" role="status">
              {detailNotice}
            </p>
          ) : null}

          <div className="product-detail__split">
            {/* Left — gallery */}
            <div className="product-detail__gallery">
              <div className="product-detail__main">
                <img src={mainImage} alt={mainImageAlt} />
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
                      <img src={src} alt="" aria-hidden="true" loading="lazy" />
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
                  <strong>{formatVariantPrice(product, activeVariant)}</strong>
                  <span>/{product.unit}</span>
                </div>
                <StatusPill tone={getStockTone(product)}>
                  {getAvailabilityLabel(product)}
                </StatusPill>
              </div>
              {stockDetail ? (
                <p className="product-detail__stock-detail">{stockDetail}</p>
              ) : null}

              {variants.length ? (
                <div className="product-detail__variants" aria-label="Product options">
                  <h2>Options</h2>
                  <div className="product-detail__variant-list">
                    {variants.map((variant) => {
                      const selected = activeVariant?.id === variant.id;

                      return (
                        <button
                          key={variant.id}
                          type="button"
                          className={
                            selected
                              ? "product-detail__variant product-detail__variant--active"
                              : "product-detail__variant"
                          }
                          aria-pressed={selected}
                          onClick={() => {
                            setActiveVariantId(variant.id);
                            setActiveImage(0);
                          }}
                        >
                          <span>{variant.name}</span>
                          <small>{getVariantAvailabilityLabel(variant)}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <p className="product-detail__desc">{product.description}</p>
              {product.longDescription ? (
                <p className="product-detail__long-desc">{product.longDescription}</p>
              ) : null}
              {product.availability ? (
                <p className="product-detail__availability">{product.availability}</p>
              ) : null}

              {isPricedProduct(product) && (canStartCart || qty > 0) ? (
                <div className="product-detail__qty-block">
                  <QuantityControls
                    qty={qty}
                    onIncrement={() => increment(product.id)}
                    onDecrement={() => decrement(product.id)}
                    onRemove={() => remove(product.id)}
                    size="lg"
                    productName={product.name}
                    addLabel="Add to cart"
                    disabled={!canAddOne}
                    disabledLabel={getAvailabilityLabel(product)}
                    maxQuantity={maxQuantity}
                  />
                  {qty > 0 ? (
                    <p className="product-detail__qty-summary">
                      Subtotal: <strong>{formatCurrency(getLineTotal(product, qty))}</strong>
                    </p>
                  ) : null}
                </div>
              ) : null}
              {purchaseBlocker ? (
                <p className="product-detail__availability" role="status">
                  {purchaseBlocker}
                </p>
              ) : null}

              {showInquiry ? <ProductInquiryForm product={product} /> : null}

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
                  {specificationEntries.map((entry) => (
                    <div key={`${entry.label}-${entry.value}`}>
                      <dt>{entry.label}</dt>
                      <dd>{entry.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {product.useCases?.length ? (
                <div className="product-detail__section">
                  <h2>Good for</h2>
                  <div className="product-detail__use-cases">
                    {product.useCases.map((useCase) => (
                      <span key={useCase}>{useCase}</span>
                    ))}
                  </div>
                </div>
              ) : null}

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
                      <img
                        src={rel.thumbnailUrl || rel.image}
                        alt={rel.imageAlt || rel.name}
                        loading="lazy"
                      />
                    </div>
                    <span className="product-detail__related-category">
                      {rel.category}
                    </span>
                    <span className="product-detail__related-name">{rel.name}</span>
                    <span className="product-detail__related-price">
                      {formatProductPrice(rel)}
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
