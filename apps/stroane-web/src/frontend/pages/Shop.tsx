import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { HiArrowRight, HiTrash } from "react-icons/hi";
import { Card, EmptyState, InlineNotice, StatusPill, SelectField } from "@faako/ui";
import Layout from "../../components/Layout";
import useSEOMeta from "../../hooks/useSEOMeta";
import useCatalogueData from "../../hooks/useCatalogueData";
import StructuredData from "../../components/StructuredData";
import QuantityControls from "../../components/QuantityControls";
import {
  formatCurrency,
  formatProductPrice,
  canPurchaseProduct,
  getAvailableStockQuantity,
  getAvailabilityLabel,
  getLineTotal,
  getProductSpecifications,
  getSchemaAvailability,
  getStockDetailLabel,
  getStockTone,
  isPricedProduct,
  shouldShowInquiryOption,
  type Category,
  type Product,
} from "../../data/products";
import { useCart } from "../../context/CartContext";
import "../styles/Shop.css";

const buildShopSchema = (catalogueProducts: Product[]) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  "@id": "https://stroanesolutions.com/shop",
  name: "Stroane Food Safety Supplies — Ghana",
  description:
    "Thermometers, hygiene supplies, testing kits, cold-chain equipment, and inspection records for food businesses in Ghana.",
  url: "https://stroanesolutions.com/shop",
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://stroanesolutions.com/" },
      { "@type": "ListItem", position: 2, name: "Shop", item: "https://stroanesolutions.com/shop" },
    ],
  },
  itemListElement: catalogueProducts.map((product, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "Product",
      name: product.name,
      description: product.description,
      sku: product.sku,
      offers: {
        "@type": "Offer",
        priceCurrency: "GHS",
        ...(isPricedProduct(product) ? { price: product.price } : {}),
        availability: getSchemaAvailability(product),
        seller: { "@type": "Organization", name: "Stroane" },
      },
    },
  })),
});

const Shop: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    products: catalogueProducts,
    categories: catalogueCategories,
    loading,
    notice,
  } = useCatalogueData();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | "All">("All");
  const [sort, setSort] = useState("featured");
  const { cart, getQty, increment, decrement, remove, clear } = useCart();
  const categoryFromUrl = searchParams.get("category");
  const visibleCategories = useMemo(
    () => catalogueCategories.filter((category) => !category.isGroup),
    [catalogueCategories]
  );
  const pricedProducts = useMemo(
    () => catalogueProducts.filter(isPricedProduct),
    [catalogueProducts]
  );

  useEffect(() => {
    if (loading) return;

    const pricedProductIds = new Set(pricedProducts.map((product) => product.id));
    Object.keys(cart).forEach((productId) => {
      if (!pricedProductIds.has(productId)) remove(productId);
    });
  }, [cart, loading, pricedProducts, remove]);

  const categoryProductCounts = useMemo(() => {
    const counts = new Map<Category | "All", number>([["All", pricedProducts.length]]);
    pricedProducts.forEach((product) => {
      counts.set(product.category, (counts.get(product.category) || 0) + 1);
    });
    return counts;
  }, [pricedProducts]);
  const categoryOptions = useMemo<Array<Category | "All">>(
    () => [
      "All",
      ...visibleCategories
        .map((category) => category.name)
        .filter((category) => (categoryProductCounts.get(category) || 0) > 0),
    ],
    [categoryProductCounts, visibleCategories]
  );

  useEffect(() => {
    const matchingCategory = categoryOptions.find((category) => category === categoryFromUrl);
    setSelectedCategory(matchingCategory || "All");
  }, [categoryFromUrl, categoryOptions]);

  useSEOMeta({
    title: "Food Safety Equipment & Supplies Ghana | Stroane Store",
    description:
      "Buy thermometers, hygiene supplies, testing kits, cold-chain equipment, and inspection records for food businesses in Ghana. Supports audit readiness and Ghana FDA compliance.",
    keywords:
      "food safety equipment Ghana, thermometer food safety Ghana, food safety supplies Accra, HACCP equipment Ghana, cold chain supplies Ghana",
    canonical: "https://stroanesolutions.com/shop",
  });

  const shopSchema = useMemo(
    () => buildShopSchema(pricedProducts),
    [pricedProducts]
  );

  const handleCategoryChange = (category: Category | "All") => {
    setSelectedCategory(category);
    const nextSearchParams = new URLSearchParams(searchParams);
    if (category === "All") {
      nextSearchParams.delete("category");
    } else {
      nextSearchParams.set("category", category);
    }
    setSearchParams(nextSearchParams);
  };

  const handleClearFilters = () => {
    setQuery("");
    setSort("featured");
    handleCategoryChange("All");
  };

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return pricedProducts
      .filter((product) => {
        const matchesCategory =
          selectedCategory === "All" || product.category === selectedCategory;
        const matchesQuery =
          !normalizedQuery ||
          [
            product.name,
            product.description,
            product.category,
            product.subcategory,
            product.brand,
            product.sku,
            ...(product.tags || []),
            ...(product.useCases || []),
            ...(product.variants || []).flatMap((variant) => [
              variant.name,
              variant.sku,
              ...(Object.values(variant.options || {}) as string[]),
            ]),
            ...getProductSpecifications(product).flatMap((specification) => [
              specification.label,
              specification.value,
              specification.group,
            ]),
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);

        return matchesCategory && matchesQuery;
      })
      .sort((left, right) => {
        const leftPrice = isPricedProduct(left) ? left.price : Number.POSITIVE_INFINITY;
        const rightPrice = isPricedProduct(right) ? right.price : Number.POSITIVE_INFINITY;
        if (sort === "price-low") return leftPrice - rightPrice;
        if (sort === "price-high") return rightPrice - leftPrice;
        return (
          pricedProducts.findIndex((product) => product.id === left.id) -
          pricedProducts.findIndex((product) => product.id === right.id)
        );
      });
  }, [pricedProducts, query, selectedCategory, sort]);

  const hasActiveFilters = selectedCategory !== "All" || Boolean(query.trim()) || sort !== "featured";

  const cartLines = useMemo(
    () =>
      catalogueProducts
        .filter(isPricedProduct)
        .filter((p) => (cart[p.id] ?? 0) > 0)
        .map((product) => ({ product, qty: cart[product.id] })),
    [cart, catalogueProducts]
  );
  const visibleCartCount = cartLines.reduce((total, line) => total + line.qty, 0);

  const basketTotal = cartLines.reduce(
    (total, line) => total + getLineTotal(line.product, line.qty),
    0
  );
  const blockedCartLines = cartLines.filter(
    ({ product, qty }) => !canPurchaseProduct(product, qty)
  );

  return (
    <Layout>
      <StructuredData schema={shopSchema} id="shop-schema" />
      <div className="shop-page">
        <section className="shop-hero">
          <img
            src="/imgs/bg_imgs/bg.png"
            alt=""
            aria-hidden="true"
            className="shop-hero__bg"
          />
          <div className="shop-hero__overlay" />

          <div className="shop-hero__content">
            <h1 className="shop-hero__heading">
              Food Safety Supplies for Ghana
            </h1>
            <p className="shop-hero__para">
              Practical equipment for temperature checks, hygiene, cold-chain
              control, and inspection records — ready for pricing and availability checks.
            </p>
          </div>
        </section>

        <div className="shop-toolbar" id="catalogue" aria-label="Shop filters">
          <div>
            <h2>Catalogue</h2>
          </div>

          <div className="shop-controls">
            <label className="shop-control">
              <span>Search</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search thermometers, labels, gloves..."
              />
            </label>
            <label className="shop-control shop-control--select">
              <span>Sort</span>
              <SelectField
                value={sort}
                ariaLabel="Sort products"
                onChangeValue={(next) => setSort(next as string)}
                options={[
                  { value: "featured", label: "Featured" },
                  { value: "price-low", label: "Price: low to high" },
                  { value: "price-high", label: "Price: high to low" },
                ]}
              />
            </label>
            <label className="shop-control shop-control--select">
              <span>Categories</span>
              <SelectField
                value={selectedCategory}
                ariaLabel="Filter by category"
                onChangeValue={(next) => handleCategoryChange(next as Category | "All")}
                options={categoryOptions.map((category) => ({
                  value: category,
                  label: category,
                }))}
              />
            </label>
          </div>
        </div>

        {loading || notice ? (
          <div className="shop-catalogue-status">
            {loading ? (
              <InlineNotice
                tone="loading"
                title="Refreshing catalogue"
                message="Checking the latest product and category data."
              />
            ) : null}
            {notice ? (
              <InlineNotice tone="info" title="Catalogue fallback active" message={notice} />
            ) : null}
          </div>
        ) : null}

        <section className="shop-catalogue-overview" aria-label="Catalogue summary and categories">

          <div className="shop-product-count">
            <span>Showing</span>
            <strong>
              {filteredProducts.length} product{filteredProducts.length === 1 ? "" : "s"}
            </strong>
            {hasActiveFilters ? (
              <button type="button" onClick={handleClearFilters}>
                Reset filters
              </button>
            ) : null}
          </div>
        </section>

        <section className="shop-storefront">
          <div className="shop-grid" aria-live="polite">
            {filteredProducts.length ? (
              filteredProducts.map((product) => {
                const qty = getQty(product.id);
                const detailUrl = `/products/${product.id}`;
                const canAddOne = canPurchaseProduct(product, qty + 1);
                const canStartCart = canPurchaseProduct(product, 1);
                const availableQuantity = getAvailableStockQuantity(product);
                const maxQuantity = product.allowBackorder
                  ? null
                  : availableQuantity ?? product.stockQuantity;
                const stockDetail = getStockDetailLabel(product);

                return (
                  <Card key={product.id} className="shop-product-card bubble-card">
                    <Link to={detailUrl} className="shop-product-card__media-link" aria-label={product.name}>
                      <div className="shop-product-card__media">
                        <img
                          src={product.thumbnailUrl || product.image}
                          alt={product.imageAlt || product.name}
                          loading="lazy"
                        />
                        <span className="shop-product-card__stock">
                          <StatusPill tone={getStockTone(product)}>
                            {getAvailabilityLabel(product)}
                          </StatusPill>
                        </span>
                      </div>
                    </Link>
                    <div className="shop-product-card__body">
                      <div className="shop-product-card__eyebrow">
                        <span className="shop-product-card__category">
                          {product.category}
                        </span>
                      </div>
                      <Link to={detailUrl} className="shop-product-card__name-link">
                        <h3 className="shop-product-card__name">{product.name}</h3>
                      </Link>
                      {product.variants?.length ? (
                        <p className="shop-product-card__meta">
                          {product.variants.length} option{product.variants.length === 1 ? "" : "s"} available
                        </p>
                      ) : null}
                      {stockDetail ? (
                        <p className="shop-product-card__stock-detail">
                          {stockDetail}
                        </p>
                      ) : null}
                      <div className="shop-product-card__row">
                        <div className="shop-product-card__price">
                          <strong>{formatProductPrice(product)}</strong>
                          <span>/{product.unit}</span>
                        </div>
                      </div>

                      {canStartCart || qty > 0 ? (
                        <QuantityControls
                          qty={qty}
                          onIncrement={() => increment(product.id)}
                          onDecrement={() => decrement(product.id)}
                          onRemove={() => remove(product.id)}
                          productName={product.name}
                          disabled={!canAddOne}
                          disabledLabel={getAvailabilityLabel(product)}
                          maxQuantity={maxQuantity}
                        />
                      ) : shouldShowInquiryOption(product) ? (
                        <Link to={detailUrl} className="shop-product-card__inquiry">
                          Ask about stock
                        </Link>
                      ) : (
                        <span className="shop-product-card__inquiry shop-product-card__inquiry--disabled">
                          {getAvailabilityLabel(product)}
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })
            ) : (
              <EmptyState
                className="shop-empty"
                title="No priced products matched."
                message="Try a different category or search term, or check back as more prices are added."
              />
            )}
          </div>

          <aside className="shop-quote-panel glass-card" aria-label="Basket">
            <span className="shop-kicker">Your Basket</span>
            <h2>{visibleCartCount} item{visibleCartCount === 1 ? "" : "s"} selected</h2>
            {cartLines.length ? (
              <>
                <ul>
                  {cartLines.map(({ product, qty }) => (
                    <li key={product.id}>
                      <span>
                        {product.name}
                        <em> × {qty}</em>
                      </span>
                      <strong>{formatCurrency(getLineTotal(product, qty))}</strong>
                    </li>
                  ))}
                </ul>
                <div className="shop-quote-panel__total">
                  <span>Total</span>
                  <strong>{formatCurrency(basketTotal)}</strong>
                </div>
                {blockedCartLines.length ? (
                  <p className="shop-quote-panel__warning" role="status">
                    Remove unavailable or unconfirmed-stock items before checkout.
                  </p>
                ) : null}
              </>
            ) : (
              <p>Add in-stock products to start checkout, or request details for unavailable items.</p>
            )}
            {cartLines.length && !blockedCartLines.length ? (
              <Link to="/checkout" className="shop-quote-panel__checkout">
                <span>Proceed to checkout</span>
                <HiArrowRight size={18} aria-hidden="true" />
              </Link>
            ) : (
              <button
                type="button"
                className="shop-quote-panel__checkout"
                disabled
              >
                Proceed to checkout
              </button>
            )}
            {cartLines.length ? (
              <button
                type="button"
                className="shop-quote-panel__clear"
                onClick={clear}
              >
                <HiTrash size={16} aria-hidden="true" />
                <span>Clear basket</span>
              </button>
            ) : null}
          </aside>
        </section>

        <div className="shop-service-strip">
          <div className="shop-service-strip__content">
            <span className="shop-kicker">Need guidance?</span>
            <h2>Pair products with an audit or staff training session.</h2>
            <p>
              Stroane can help you choose what each branch, kitchen, or production team needs
              before you buy in bulk.
            </p>
            <Link to="/services" className="ui-button ui-button--secondary">
              View services
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Shop;
