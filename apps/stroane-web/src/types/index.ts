export type {
  BusinessProfile,
  CatalogueCategory,
  Category,
  Product,
  ProductStock,
  ProductStockStatus,
} from "../data/products";

export interface LegacyProductRecord {
  id: number;
  name: string;
  description?: string;
  price: number;
  inventory: number;
  createdAt: Date;
  updatedAt: Date;
}
