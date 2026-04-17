export interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  inventory: number;
  createdAt: Date;
  updatedAt: Date;
}
