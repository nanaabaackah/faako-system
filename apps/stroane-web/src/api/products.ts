import { Product } from "../types/index";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:3000";

export const productApi = {
  async getAll(): Promise<Product[]> {
    // TODO: Implement fetch all products
    console.log("Fetching products from:", `${BASE_URL}/api/products`);
    const response = await fetch(`${BASE_URL}/api/products`);
    if (!response.ok) throw new Error("Failed to fetch products");
    return response.json();
  },

  async getById(id: number): Promise<Product> {
    // TODO: Implement fetch product by id
    console.log("Fetching product from:", `${BASE_URL}/api/products/${id}`);
    const response = await fetch(`${BASE_URL}/api/products/${id}`);
    if (!response.ok) throw new Error("Failed to fetch product");
    return response.json();
  },
};
