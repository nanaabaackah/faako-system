import Shop from "../../views/Shop/Shop.jsx";
import { createPublicRouteIsland } from "./createPublicRouteIsland.jsx";

const ShopIsland = createPublicRouteIsland(Shop, "/shop");
export default ShopIsland;
