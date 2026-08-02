import Login from "../../views/Login.jsx";
import { createLegacyRouteIsland } from "./createLegacyRouteIsland.jsx";

const LoginIsland = createLegacyRouteIsland(Login, "/login");
export default LoginIsland;
