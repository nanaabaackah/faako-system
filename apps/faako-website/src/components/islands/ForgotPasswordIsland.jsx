import ForgotPassword from "../../views/ForgotPassword.jsx";
import { createLegacyRouteIsland } from "./createLegacyRouteIsland.jsx";

const ForgotPasswordIsland = createLegacyRouteIsland(
  ForgotPassword,
  "/forgot-password",
);
export default ForgotPasswordIsland;
