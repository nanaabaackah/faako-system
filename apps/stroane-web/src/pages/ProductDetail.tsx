import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Product } from "../types/index";
import { productApi } from "../api/products";

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        if (id) {
          // TODO: Uncomment when API is implemented
          // const data = await productApi.getById(parseInt(id));
          // setProduct(data);
          setProduct(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch product");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  if (loading) return <div className="p-8">Loading product...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!product) {
    return (
      <div className="p-8">
        <p className="text-gray-600 mb-4">Product not found</p>
        <Link to="/products" className="text-blue-600 hover:text-blue-700 underline">
          Back to Products
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <Link to="/products" className="text-blue-600 hover:text-blue-700 underline mb-8 block">
          ← Back to Products
        </Link>

        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-4xl font-bold mb-4">{product.name}</h1>
          <p className="text-gray-600 mb-6">{product.description}</p>

          <div className="space-y-4 mb-8">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Price:</span>
              <span className="text-3xl font-bold text-blue-600">
                ${product.price.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Stock:</span>
              <span className="text-xl">{product.inventory} units</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Created:</span>
              <span className="text-gray-600">
                {new Date(product.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <button className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
