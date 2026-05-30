import type { CatalogueCategory, Product } from "../types/index";
import { API_BASE_URL, apiPath, describeApiBaseUrl } from "./config";
const CATALOGUE_API_PATH = "/api/catalogue";

if (API_BASE_URL) {
  console.info("Stroane API base URL configured", { baseUrl: API_BASE_URL });
} else {
  console.warn("Stroane API base URL is not configured; catalogue requests will use same-origin API paths.");
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown catalogue request error";

const logCatalogueRequestFailure = ({
  endpoint,
  status,
  statusText,
  error,
}: {
  endpoint: string;
  status?: number;
  statusText?: string;
  error: unknown;
}) => {
  console.warn("Stroane catalogue API request failed", {
    apiBaseUrl: describeApiBaseUrl(),
    endpoint,
    status,
    statusText,
    message: getErrorMessage(error),
  });
};

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

const fetchCatalogueJson = async <T>(path: string, fallbackMessage: string): Promise<T> => {
  const endpoint = apiPath(path);
  let status: number | undefined;
  let statusText: string | undefined;

  try {
    const response = await fetch(endpoint);
    status = response.status;
    statusText = response.statusText;
    return await parseJsonResponse<T>(response, fallbackMessage);
  } catch (error) {
    logCatalogueRequestFailure({
      endpoint,
      status,
      statusText,
      error,
    });
    throw error;
  }
};

const normalizeListResponse = <T>(data: unknown, key: string): T[] => {
  if (Array.isArray(data)) return data;
  const value = data && typeof data === "object" ? (data as Record<string, unknown>)[key] : null;
  return Array.isArray(value) ? (value as T[]) : [];
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
    const data = await fetchCatalogueJson<ProductListResponse | Product[]>(
      `${CATALOGUE_API_PATH}/products${query ? `?${query}` : ""}`,
      "Failed to fetch products"
    );
    return normalizeListResponse<Product>(data, "products");
  },

  async getById(id: string): Promise<Product> {
    const data = await fetchCatalogueJson<ProductDetailResponse | Product>(
      `${CATALOGUE_API_PATH}/products/${encodeURIComponent(id)}`,
      "Failed to fetch product"
    );
    return "product" in data ? data.product : data;
  },

  async getCategories(): Promise<CatalogueCategory[]> {
    const data = await fetchCatalogueJson<{ categories: CatalogueCategory[] } | CatalogueCategory[]>(
      `${CATALOGUE_API_PATH}/categories`,
      "Failed to fetch categories"
    );
    return normalizeListResponse<CatalogueCategory>(data, "categories");
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
