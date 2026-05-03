import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, EmptyState, StatusPill } from "@faako/ui";
import Layout from "../components/Layout";
import usePageTitle from "../hooks/usePageTitle";
import "../styles/pages/Shop.css";

type Category =
  | "Temperature"
  | "Testing"
  | "Cold Chain"
  | "PPE"
  | "Cleaning"
  | "Records";

type Product = {
  id: string;
  name: string;
  category: Category;
  description: string;
  price: number;
  unit: string;
  image: string;
  tag?: string;
  stock: "In stock" | "Low stock" | "Pre-order";
  sku: string;
  features: string[];
};

const products: Product[] = [
  {
    id: "digital-fridge-thermometer",
    name: "Digital Fridge Thermometer",
    category: "Temperature",
    description: "Compact display for daily fridge and freezer checks.",
    price: 85,
    unit: "each",
    image: "/imgs/products/product_1.png",
    tag: "Best seller",
    stock: "In stock",
    sku: "STR-TMP-101",
    features: ["Min/max memory", "Easy-read display", "Battery included"],
  },
  {
    id: "food-probe-thermometer",
    name: "Food Probe Thermometer",
    category: "Temperature",
    description: "Fast core-temperature checks for cooked and reheated food.",
    price: 120,
    unit: "each",
    image: "/imgs/products/product_2.png",
    tag: "Advisor pick",
    stock: "In stock",
    sku: "STR-TMP-122",
    features: ["Stainless probe", "Protective sleeve", "Celsius reading"],
  },
  {
    id: "infrared-thermometer-gun",
    name: "Infrared Thermometer Gun",
    category: "Temperature",
    description: "Contactless surface checks for counters, trays, and storage units.",
    price: 195,
    unit: "each",
    image: "/imgs/products/product_3.png",
    tag: "Popular",
    stock: "Low stock",
    sku: "STR-TMP-140",
    features: ["No-touch checks", "Backlit screen", "Fast scanning"],
  },
  {
    id: "temperature-data-logger",
    name: "Temperature Data Logger",
    category: "Temperature",
    description: "Automated cold-room monitoring for audits and supplier checks.",
    price: 340,
    unit: "each",
    image: "/imgs/products/product_1.png",
    stock: "Pre-order",
    sku: "STR-TMP-210",
    features: ["USB export", "Audit-ready reports", "Reusable sensor"],
  },
  {
    id: "ph-test-strip-pack",
    name: "pH Test Strip Pack",
    category: "Testing",
    description: "Quick checks for sauces, drinks, and fermented products.",
    price: 75,
    unit: "pack",
    image: "/imgs/products/product_2.png",
    stock: "In stock",
    sku: "STR-TST-110",
    features: ["100 strips", "Colour chart", "Food-safe range"],
  },
  {
    id: "surface-swab-kit",
    name: "Surface Swab Kit",
    category: "Testing",
    description: "Spot-check prep tables, slicers, utensils, and staff stations.",
    price: 260,
    unit: "kit",
    image: "/imgs/products/product_3.png",
    tag: "Audit ready",
    stock: "Low stock",
    sku: "STR-TST-164",
    features: ["10 swabs", "Simple procedure", "Cleaning verification"],
  },
  {
    id: "sanitiser-test-strips",
    name: "Sanitiser Strength Strips",
    category: "Cleaning",
    description: "Confirm chlorine and quat sanitiser concentration before use.",
    price: 95,
    unit: "vial",
    image: "/imgs/products/product_1.png",
    stock: "In stock",
    sku: "STR-CLN-125",
    features: ["Quick dip test", "Clear colour guide", "For daily logs"],
  },
  {
    id: "colour-coded-board-set",
    name: "Colour-Coded Board Set",
    category: "Cleaning",
    description: "Separate raw, cooked, allergen, and vegetable prep safely.",
    price: 280,
    unit: "set",
    image: "/imgs/products/product_2.png",
    tag: "Kitchen essential",
    stock: "In stock",
    sku: "STR-CLN-180",
    features: ["6-board set", "Cross-contamination control", "Wall chart included"],
  },
  {
    id: "insulated-delivery-bag",
    name: "Insulated Delivery Bag",
    category: "Cold Chain",
    description: "Keeps chilled or hot food protected during local delivery.",
    price: 220,
    unit: "each",
    image: "/imgs/products/product_3.png",
    stock: "In stock",
    sku: "STR-CHN-100",
    features: ["Wipe-clean liner", "Zip closure", "Food delivery size"],
  },
  {
    id: "hard-shell-cool-box",
    name: "Hard-Shell Cool Box",
    category: "Cold Chain",
    description: "Durable transport storage for markets, events, and catering.",
    price: 450,
    unit: "each",
    image: "/imgs/products/product_1.png",
    stock: "Pre-order",
    sku: "STR-CHN-140",
    features: ["Rigid shell", "Ice-pack compatible", "Bulk transport"],
  },
  {
    id: "disposable-gloves",
    name: "Disposable Gloves",
    category: "PPE",
    description: "Powder-free gloves for prep, serving, and cleaning tasks.",
    price: 65,
    unit: "box",
    image: "/imgs/products/product_2.png",
    stock: "In stock",
    sku: "STR-PPE-101",
    features: ["100 gloves", "Powder free", "Multiple sizes"],
  },
  {
    id: "hair-nets-beard-covers",
    name: "Hair Nets & Beard Covers",
    category: "PPE",
    description: "Disposable hair-control pack for production and service teams.",
    price: 55,
    unit: "pack",
    image: "/imgs/products/product_3.png",
    stock: "In stock",
    sku: "STR-PPE-118",
    features: ["100 pieces", "Lightweight fit", "Staff hygiene"],
  },
  {
    id: "temperature-log-book",
    name: "Temperature Log Book",
    category: "Records",
    description: "Daily fridge, freezer, cooking, and reheating records in one place.",
    price: 48,
    unit: "book",
    image: "/imgs/products/product_1.png",
    tag: "Inspection ready",
    stock: "In stock",
    sku: "STR-REC-101",
    features: ["31-day format", "Corrective action notes", "Supervisor sign-off"],
  },
  {
    id: "food-rotation-labels",
    name: "Food Rotation Labels",
    category: "Records",
    description: "Use-by and prep-date labels for better stock rotation.",
    price: 70,
    unit: "roll",
    image: "/imgs/products/product_2.png",
    stock: "In stock",
    sku: "STR-REC-122",
    features: ["500 labels", "Writable surface", "FIFO support"],
  },
];

const categoryOptions: Array<Category | "All"> = [
  "All",
  "Temperature",
  "Testing",
  "Cold Chain",
  "PPE",
  "Cleaning",
  "Records",
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 0,
  }).format(value);

const getStockTone = (stock: Product["stock"]) => {
  if (stock === "In stock") return "success";
  if (stock === "Low stock") return "warning";
  return "info";
};

const Shop: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<Category | "All">("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("featured");
  const [quoteItems, setQuoteItems] = useState<string[]>([]);

  usePageTitle("Shop");

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

  const selectedProducts = products.filter((product) => quoteItems.includes(product.id));
  const quoteTotal = selectedProducts.reduce((total, product) => total + product.price, 0);
  const quoteHref = selectedProducts.length
    ? `mailto:info@stroane.com?subject=${encodeURIComponent("Stroane product quote request")}&body=${encodeURIComponent(
        `Hello Stroane,\n\nPlease send me a quote for:\n${selectedProducts
          .map((product) => `- ${product.name} (${product.sku})`)
          .join("\n")}\n\nEstimated catalogue total: ${formatCurrency(quoteTotal)}\n\nThank you.`
      )}`
    : "mailto:info@stroane.com?subject=Stroane product quote request";

  const toggleQuoteItem = (productId: string) => {
    setQuoteItems((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    );
  };

  return (
    <Layout>
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
            <span className="shop-kicker shop-kicker--inverse">Stroane Store</span>
            <h1 className="shop-hero__heading">Food safety supplies, ready to order.</h1>
            <p className="shop-hero__para">
              Browse practical equipment for temperature checks, hygiene, cold-chain control,
              and inspection records.
            </p>
            <div className="shop-hero__actions">
              <a href="#catalogue" className="ui-button ui-button--primary">
                Shop catalogue
              </a>
              <a href={quoteHref} className="ui-button ui-button--secondary">
                Request quote
              </a>
            </div>
          </div>
        </section>

        <section className="shop-toolbar" id="catalogue" aria-label="Shop filters">
          <div>
            <span className="shop-kicker">Catalogue</span>
            <h2>Shop by product, category, or audit need.</h2>
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
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="featured">Featured</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
              </select>
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
                const isSelected = quoteItems.includes(product.id);

                return (
                  <Card key={product.id} className="shop-product-card">
                    <div className="shop-product-card__media">
                      <img src={product.image} alt={product.name} />
                      {product.tag ? (
                        <span className="shop-product-card__tag">{product.tag}</span>
                      ) : null}
                    </div>
                    <div className="shop-product-card__body">
                      <div className="shop-product-card__meta">
                        <span>{product.category}</span>
                        <span>{product.sku}</span>
                      </div>
                      <h3>{product.name}</h3>
                      <p>{product.description}</p>
                      <ul>
                        {product.features.map((feature) => (
                          <li key={feature}>{feature}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="shop-product-card__footer">
                      <div>
                        <strong>{formatCurrency(product.price)}</strong>
                        <span>/{product.unit}</span>
                      </div>
                      <StatusPill tone={getStockTone(product.stock)}>{product.stock}</StatusPill>
                    </div>
                    <button
                      type="button"
                      className={
                        isSelected
                          ? "ui-button ui-button--secondary shop-product-card__button is-selected"
                          : "ui-button ui-button--primary shop-product-card__button"
                      }
                      onClick={() => toggleQuoteItem(product.id)}
                    >
                      {isSelected ? "Added to quote" : "Add to quote"}
                    </button>
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
            <span className="shop-kicker">Quote Basket</span>
            <h2>{quoteItems.length} item{quoteItems.length === 1 ? "" : "s"} selected</h2>
            {selectedProducts.length ? (
              <>
                <ul>
                  {selectedProducts.map((product) => (
                    <li key={product.id}>
                      <span>{product.name}</span>
                      <strong>{formatCurrency(product.price)}</strong>
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
            <a href={quoteHref} className="ui-button ui-button--primary shop-quote-panel__cta">
              Request quote
            </a>
            {selectedProducts.length ? (
              <button
                type="button"
                className="shop-quote-panel__clear"
                onClick={() => setQuoteItems([])}
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
