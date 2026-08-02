import Dashboard from "../../views/Dashboard.jsx";
import { createLegacyRouteIsland } from "./createLegacyRouteIsland.jsx";

const DashboardIsland = createLegacyRouteIsland(Dashboard, "/dashboard");
export default DashboardIsland;
