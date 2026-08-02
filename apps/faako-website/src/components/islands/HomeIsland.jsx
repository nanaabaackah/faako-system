import Home from "../../views/Home.jsx";
import { createLegacyRouteIsland } from "./createLegacyRouteIsland.jsx";

const HomeIsland = createLegacyRouteIsland(Home, "/");
export default HomeIsland;
