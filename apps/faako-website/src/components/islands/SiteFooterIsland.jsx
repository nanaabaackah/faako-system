import { MemoryRouter } from "react-router-dom";
import Footer from "../Footer.jsx";

export default function SiteFooterIsland({ path = "/" }) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Footer footerLogo="/assets/logos/logo-white-long.png" />
    </MemoryRouter>
  );
}
