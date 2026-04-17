import React from "react";

const Services: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-8">Our Services</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold mb-4">🛒 Fast Checkout</h2>
            <p className="text-gray-600">
              Our streamlined checkout process makes purchasing quick and easy. Complete your
              order in just a few clicks.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold mb-4">📦 Fast Shipping</h2>
            <p className="text-gray-600">
              We partner with reliable carriers to ensure your products arrive on time and in
              perfect condition.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold mb-4">🔄 Easy Returns</h2>
            <p className="text-gray-600">
              Not satisfied? Return items within 30 days for a full refund. We make the process
              hassle-free.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold mb-4">💬 24/7 Support</h2>
            <p className="text-gray-600">
              Our customer support team is available round the clock to help with any questions
              or concerns.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold mb-4">🔒 Secure Payment</h2>
            <p className="text-gray-600">
              All transactions are encrypted and secured with industry-leading security standards
              to protect your data.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold mb-4">⭐ Loyalty Program</h2>
            <p className="text-gray-600">
              Earn points on every purchase and redeem them for exclusive discounts and rewards.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Services;
