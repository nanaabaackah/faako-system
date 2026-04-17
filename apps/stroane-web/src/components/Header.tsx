import React from "react";

const Header: React.FC = () => {
  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Stroane</h1>
        <nav className="flex gap-6">
          <a href="/" className="text-gray-600 hover:text-gray-900">
            Home
          </a>
          <a href="/about" className="text-gray-600 hover:text-gray-900">
            About
          </a>
          <a href="/services" className="text-gray-600 hover:text-gray-900">
            Services
          </a>
          <a href="/shop" className="text-gray-600 hover:text-gray-900">
            Shop
          </a>
          <a href="/products" className="text-gray-600 hover:text-gray-900">
            Products
          </a>
          <a href="/resources" className="text-gray-600 hover:text-gray-900">
            Resources
          </a>
        </nav>
      </div>
    </header>
  );
};

export default Header;
