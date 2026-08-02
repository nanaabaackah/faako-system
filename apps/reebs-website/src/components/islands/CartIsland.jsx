import Cart from "../../views/Cart/Cart.jsx";
import { createPublicRouteIsland } from "./createPublicRouteIsland.jsx";

const CartIsland = createPublicRouteIsland(Cart, "/cart");
export default CartIsland;
