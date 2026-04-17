import React from "react";

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white shadow">
        <nav className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold">Stroane</h1>
        </nav>
      </header>
      <main className="flex-grow">{children}</main>
      <footer className="bg-gray-100 text-center py-4">
        <p className="text-gray-600">© 2026 Stroane. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Layout;
