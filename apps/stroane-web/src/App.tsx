import "./styles/globals.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import About from "./pages/About";
import Services from "./pages/Services";
import Shop from "./pages/Shop";
import Resources from "./pages/Resources";
import Contact from "./pages/Contact";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Cookies from "./pages/Cookies";
import Sitemap from "./pages/Sitemap";
import ProductList from "./pages/ProductList";
import ProductDetail from "./pages/ProductDetail";
import Checkout from "./pages/Checkout";
import CheckoutReturn from "./pages/CheckoutReturn";
import AdminOrders from "./pages/AdminOrders";
import AdminInventory from "./pages/AdminInventory";
import AdminPortalHome from "./pages/AdminPortalHome";
import AdminPortalPlaceholder from "./pages/AdminPortalPlaceholder";
import AdminProducts from "./pages/AdminProducts";
import AdminPortalSignIn from "./pages/AdminPortalSignIn";
import CustomerAccountPlaceholder from "./pages/CustomerAccountPlaceholder";
import AdminPortalLayout from "./components/admin/AdminPortalLayout";
import RequireAdminAuth from "./components/admin/RequireAdminAuth";
import RequirePortalAccess from "./components/admin/RequirePortalAccess";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Search from "./pages/Search";
import ErrorPage from "./pages/ErrorPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/services" element={<Services />} />
        <Route path="/catalogue" element={<Shop />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/products" element={<ProductList />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/checkout/return" element={<CheckoutReturn />} />
        <Route path="/account" element={<CustomerAccountPlaceholder area="account" />} />
        <Route path="/orders" element={<CustomerAccountPlaceholder area="orders" />} />
        <Route path="/quotes" element={<CustomerAccountPlaceholder area="quotes" />} />
        <Route path="/admin/signin" element={<AdminPortalSignIn />} />
        <Route element={<RequireAdminAuth />}>
          <Route element={<RequirePortalAccess />}>
            <Route path="/admin" element={<AdminPortalLayout />}>
              <Route index element={<AdminPortalHome />} />
              <Route path="inventory" element={<AdminInventory initialTab="inventory" />} />
              <Route path="suppliers" element={<AdminInventory initialTab="suppliers" />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="operations" element={<AdminOrders />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="reports" element={<AdminPortalPlaceholder area="reports" />} />
              <Route path="settings" element={<AdminPortalPlaceholder area="settings" />} />
            </Route>
          </Route>
        </Route>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/cookies" element={<Cookies />} />
        <Route path="/sitemap" element={<Sitemap />} />
        <Route path="/search" element={<Search />} />
        <Route path="/error" element={<ErrorPage />} />
        <Route path="*" element={<ErrorPage statusCode="404" />} />
      </Routes>
    </Router>
  );
}

export default App;
