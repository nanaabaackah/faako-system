import { Product } from "../types/index";

const BASE_URL = (import.meta.env.VITE_BACKEND_BASE_URL || "").replace(/\/$/, "");

const apiPath = (path: string) => `${BASE_URL}${path}`;

export const productApi = {
  async getAll(): Promise<Product[]> {
    // TODO: Implement fetch all products
    const url = apiPath("/api/products");
    console.log("Fetching products from:", url);
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch products");
    return response.json();
  },

  async getById(id: number): Promise<Product> {
    // TODO: Implement fetch product by id
    const url = apiPath(`/api/products/${id}`);
    console.log("Fetching product from:", url);
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch product");
    return response.json();
  },
};
