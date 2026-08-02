import Home from "../../views/Home/Home.jsx";
import { createPublicRouteIsland } from "./createPublicRouteIsland.jsx";

const HomeIsland = createPublicRouteIsland(Home, "/");
export default HomeIsland;
