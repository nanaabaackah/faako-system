import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HiArrowRight } from "react-icons/hi";
import { Card, EmptyState, StatusPill, SelectField } from "@faako/ui";
import Layout from "../components/Layout";
import useSEOMeta from "../hooks/useSEOMeta";
import StructuredData from "../components/StructuredData";
import QuantityControls from "../components/QuantityControls";
import {
  products,
  categoryOptions,
  formatCurrency,
  getStockTone,
  type Category,
} from "../data/products";
import { useCart } from "../context/CartContext";
import "../styles/pages/Shop.css";

const SHOP_SCHEMA = {
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
  itemListElement: products.map((product, index) => ({
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
        price: product.price,
        availability:
          product.stock === "In stock"
            ? "https://schema.org/InStock"
            : product.stock === "Low stock"
            ? "https://schema.org/LimitedAvailability"
            : "https://schema.org/PreOrder",
        seller: { "@type": "Organization", name: "Stroane" },
      },
    },
  })),
};

const Shop: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<Category | "All">("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("featured");
  const { cart, getQty, increment, decrement, remove, clear, totalCount } = useCart();

  useSEOMeta({
    title: "Food Safety Equipment & Supplies Ghana | Stroane Store",
    description:
      "Buy thermometers, hygiene supplies, testing kits, cold-chain equipment, and inspection records for food businesses in Ghana. Supports audit readiness and Ghana FDA compliance.",
    keywords:
      "food safety equipment Ghana, thermometer food safety Ghana, food safety supplies Accra, HACCP equipment Ghana, cold chain supplies Ghana",
    canonical: "https://stroanesolutions.com/shop",
  });

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return products
      .filter((product) => {
        const matchesCategory =
          selectedCategory === "All" || product.category === selectedCategory;
        const matchesQuery =
          !normalizedQuery ||
          [product.name, product.description, product.category, product.sku]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);

        return matchesCategory && matchesQuery;
      })
      .sort((left, right) => {
        if (sort === "price-low") return left.price - right.price;
        if (sort === "price-high") return right.price - left.price;
        return products.findIndex((product) => product.id === left.id) -
          products.findIndex((product) => product.id === right.id);
      });
  }, [query, selectedCategory, sort]);

  const cartLines = useMemo(
    () =>
      products
        .filter((p) => (cart[p.id] ?? 0) > 0)
        .map((product) => ({ product, qty: cart[product.id] })),
    [cart]
  );

  const quoteTotal = cartLines.reduce(
    (total, line) => total + line.product.price * line.qty,
    0
  );

  return (
    <Layout>
      <StructuredData schema={SHOP_SCHEMA} id="shop-schema" />
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
              control, and inspection records — ready to order.
            </p>
          </div>
        </section>

        <section className="shop-toolbar" id="catalogue" aria-label="Shop filters">
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
          </div>
        </section>

        <div className="shop-category-tabs" aria-label="Product categories">
          {categoryOptions.map((category) => (
            <button
              key={category}
              type="button"
              className={
                selectedCategory === category
                  ? "shop-category-tab is-active"
                  : "shop-category-tab"
              }
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        <section className="shop-storefront">
          <div className="shop-grid" aria-live="polite">
            {filteredProducts.length ? (
              filteredProducts.map((product) => {
                const qty = getQty(product.id);
                const detailUrl = `/products/${product.id}`;

                return (
                  <Card key={product.id} className="shop-product-card">
                    <Link to={detailUrl} className="shop-product-card__media-link" aria-label={product.name}>
                      <div className="shop-product-card__media">
                        <img src={product.image} alt={product.name} />
                        <span className="shop-product-card__stock">
                          <StatusPill tone={getStockTone(product.stock)}>
                            {product.stock}
                          </StatusPill>
                        </span>
                      </div>
                    </Link>
                    <div className="shop-product-card__body">
                      <div className="shop-product-card__eyebrow">
                        <span className="shop-product-card__category">
                          {product.category}
                        </span>
                        {product.tag ? (
                          <span className="shop-product-card__tag">{product.tag}</span>
                        ) : null}
                      </div>
                      <Link to={detailUrl} className="shop-product-card__name-link">
                        <h3 className="shop-product-card__name">{product.name}</h3>
                      </Link>
                      <div className="shop-product-card__row">
                        <div className="shop-product-card__price">
                          <strong>{formatCurrency(product.price)}</strong>
                          <span>/{product.unit}</span>
                        </div>
                      </div>

                      <QuantityControls
                        qty={qty}
                        onIncrement={() => increment(product.id)}
                        onDecrement={() => decrement(product.id)}
                        onRemove={() => remove(product.id)}
                        productName={product.name}
                      />
                    </div>
                  </Card>
                );
              })
            ) : (
              <EmptyState
                className="shop-empty"
                title="No products matched."
                message="Try a different category or a simpler search term."
              />
            )}
          </div>

          <aside className="shop-quote-panel" aria-label="Quote basket">
            <span className="shop-kicker">Your Basket</span>
            <h2>{totalCount} item{totalCount === 1 ? "" : "s"} selected</h2>
            {cartLines.length ? (
              <>
                <ul>
                  {cartLines.map(({ product, qty }) => (
                    <li key={product.id}>
                      <span>
                        {product.name}
                        <em> × {qty}</em>
                      </span>
                      <strong>{formatCurrency(product.price * qty)}</strong>
                    </li>
                  ))}
                </ul>
                <div className="shop-quote-panel__total">
                  <span>Catalogue estimate</span>
                  <strong>{formatCurrency(quoteTotal)}</strong>
                </div>
              </>
            ) : (
              <p>Add products to build a quote request. We will confirm availability and delivery.</p>
            )}
            {cartLines.length ? (
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
                Clear basket
              </button>
            ) : null}
          </aside>
        </section>

        <section className="shop-service-strip">
          <div>
            <span className="shop-kicker">Need guidance?</span>
            <h2>Pair products with an audit or staff training session.</h2>
            <p>
              Stroane can help you choose what each branch, kitchen, or production team needs
              before you buy in bulk.
            </p>
          </div>
          <Link to="/services" className="ui-button ui-button--secondary">
            View services
          </Link>
        </section>
      </div>
    </Layout>
  );
};

export default Shop;
