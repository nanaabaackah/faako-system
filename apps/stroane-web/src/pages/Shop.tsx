import React from "react";
import { Link } from "react-router-dom";

const Shop: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-4">Shop</h1>
        <p className="text-gray-600 mb-8">
          Browse our complete collection of products and find what you're looking for.
        </p>

        <div className="bg-white rounded-lg shadow p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Categories</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: "Electronics", description: "Latest gadgets and devices" },
              { name: "Fashion", description: "Trendy clothing and accessories" },
              { name: "Home & Garden", description: "Products for your home" },
              { name: "Sports & Outdoors", description: "Adventure gear and equipment" },
              { name: "Books & Media", description: "Digital and physical content" },
              { name: "Health & Beauty", description: "Personal care products" },
            ].map((category) => (
              <div
                key={category.name}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition cursor-pointer"
              >
                <h3 className="font-semibold mb-2">{category.name}</h3>
                <p className="text-sm text-gray-600">{category.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <h3 className="text-xl font-semibold mb-2">Ready to browse?</h3>
          <p className="text-gray-600 mb-4">
            Visit our products page to see our full collection.
          </p>
          <Link
            to="/products"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            View Products
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Shop;
