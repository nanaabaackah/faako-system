import type { CatalogueCategory, Product } from "../types/index";

const BASE_URL = (import.meta.env.VITE_BACKEND_BASE_URL || "").replace(/\/$/, "");

const apiPath = (path: string) => `${BASE_URL}${path}`;

const parseJsonResponse = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : fallbackMessage;
    throw new Error(message);
  }

  if (!body) {
    throw new Error(fallbackMessage);
  }

  return body as T;
};

export interface ProductListResponse {
  products: Product[];
  categories?: CatalogueCategory[];
  meta?: {
    source?: string;
    count?: number;
  };
}

export interface ProductDetailResponse {
  product: Product;
}

export interface ProductInquiryPayload {
  name: string;
  email?: string;
  phone?: string;
  businessName?: string;
  message: string;
  productSlug?: string;
  productName?: string;
  source?: string;
  website?: string;
  companyWebsite?: string;
}

export interface ProductInquiryResponse {
  inquiry: {
    id: string;
    status: "received";
    receivedAt: string;
    productSlug?: string;
    productName?: string;
    nextStep: string;
  };
}

export const productApi = {
  async getAll(params: { category?: string; search?: string } = {}): Promise<Product[]> {
    const searchParams = new URLSearchParams();
    if (params.category) searchParams.set("category", params.category);
    if (params.search) searchParams.set("search", params.search);
    const query = searchParams.toString();
    const response = await fetch(apiPath(`/api/products${query ? `?${query}` : ""}`));
    const data = await parseJsonResponse<ProductListResponse | Product[]>(
      response,
      "Failed to fetch products"
    );
    return Array.isArray(data) ? data : data.products;
  },

  async getById(id: string): Promise<Product> {
    const response = await fetch(apiPath(`/api/products/${encodeURIComponent(id)}`));
    const data = await parseJsonResponse<ProductDetailResponse | Product>(
      response,
      "Failed to fetch product"
    );
    return "product" in data ? data.product : data;
  },

  async getCategories(): Promise<CatalogueCategory[]> {
    const response = await fetch(apiPath("/api/categories"));
    const data = await parseJsonResponse<{ categories: CatalogueCategory[] } | CatalogueCategory[]>(
      response,
      "Failed to fetch categories"
    );
    return Array.isArray(data) ? data : data.categories;
  },

  async submitInquiry(payload: ProductInquiryPayload): Promise<ProductInquiryResponse> {
    const response = await fetch(apiPath("/api/inquiries"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return parseJsonResponse<ProductInquiryResponse>(response, "Failed to submit inquiry");
  },
};
