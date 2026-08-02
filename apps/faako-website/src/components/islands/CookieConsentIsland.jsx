import { MemoryRouter } from "react-router-dom";
import CookieConsentBanner from "../CookieConsentBanner.jsx";

export default function CookieConsentIsland({ path = "/" }) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <CookieConsentBanner />
    </MemoryRouter>
  );
}
