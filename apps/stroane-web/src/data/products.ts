export type Category =
  | "Temperature"
  | "Testing"
  | "Cold Chain"
  | "PPE"
  | "Cleaning"
  | "Records";

export type Product = {
  id: string;
  name: string;
  category: Category;
  description: string;
  price: number;
  unit: string;
  image: string;
  images?: string[];
  tag?: string;
  stock: "In stock" | "Low stock" | "Pre-order";
  sku: string;
  features: string[];
};

export const products: Product[] = [
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

export const categoryOptions: Array<Category | "All"> = [
  "All",
  "Temperature",
  "Testing",
  "Cold Chain",
  "PPE",
  "Cleaning",
  "Records",
];

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 0,
  }).format(value);

export const getStockTone = (stock: Product["stock"]) => {
  if (stock === "In stock") return "success" as const;
  if (stock === "Low stock") return "warning" as const;
  return "info" as const;
};

export const getProductById = (id: string): Product | undefined =>
  products.find((p) => p.id === id);
