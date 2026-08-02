import NotFound from "../../views/NotFound.jsx";
import { createLegacyRouteIsland } from "./createLegacyRouteIsland.jsx";

const NotFoundIsland = createLegacyRouteIsland(NotFound, "*");
export default NotFoundIsland;
