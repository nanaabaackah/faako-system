import React from "react";

const About: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-8">About Us</h1>

        <div className="bg-white rounded-lg shadow p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Who We Are</h2>
          <p className="text-gray-600 mb-4">
            Stroane is a modern e-commerce platform dedicated to providing quality products
            and exceptional customer service.
          </p>
          <p className="text-gray-600">
            Founded with a mission to revolutionize online shopping, we combine cutting-edge
            technology with a customer-first approach to create the best shopping experience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold mb-2">🎯 Our Mission</h3>
            <p className="text-gray-600">
              To provide accessible, high-quality products to customers worldwide.
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold mb-2">👥 Our Values</h3>
            <p className="text-gray-600">
              Integrity, innovation, and customer satisfaction drive everything we do.
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold mb-2">🚀 Our Vision</h3>
            <p className="text-gray-600">
              To become the most trusted e-commerce platform globally.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
