import React from "react";

const Resources: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-8">Resources</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold mb-4">📚 Help Center</h2>
            <ul className="space-y-2 text-gray-600">
              <li>• Getting started with Stroane</li>
              <li>• How to place an order</li>
              <li>• Tracking your shipment</li>
              <li>• Return and refund policy</li>
              <li>• Account security tips</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold mb-4">❓ FAQs</h2>
            <ul className="space-y-2 text-gray-600">
              <li>• What payment methods do you accept?</li>
              <li>• How long does shipping take?</li>
              <li>• Can I modify my order?</li>
              <li>• Do you ship internationally?</li>
              <li>• How do I reset my password?</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold mb-4">📖 Guides & Tutorials</h2>
            <ul className="space-y-2 text-gray-600">
              <li>• Beginner's guide to online shopping</li>
              <li>• How to compare products</li>
              <li>• Reading product reviews</li>
              <li>• Setting up your wishlist</li>
              <li>• Maximizing loyalty points</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold mb-4">🔗 Useful Links</h2>
            <ul className="space-y-2 text-gray-600">
              <li>• <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a></li>
              <li>• <a href="#" className="text-blue-600 hover:underline">Terms of Service</a></li>
              <li>• <a href="#" className="text-blue-600 hover:underline">Blog</a></li>
              <li>• <a href="#" className="text-blue-600 hover:underline">Community Forum</a></li>
              <li>• <a href="#" className="text-blue-600 hover:underline">Contact Us</a></li>
            </ul>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 mt-8 text-center">
          <h3 className="text-xl font-semibold mb-2">Still need help?</h3>
          <p className="text-gray-600 mb-4">
            Our support team is ready to assist you.
          </p>
          <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
};

export default Resources;
