import React from "react";

const Home: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className="text-4xl font-bold mb-4">Welcome to Stroane</h1>
      <p className="text-gray-600 mb-8">Product marketplace</p>
      <a
        href="/products"
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
      >
        Browse Products
      </a>
    </div>
  );
};

export default Home;
