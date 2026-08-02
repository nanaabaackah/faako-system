import Checkout from "../../views/Checkout/Checkout.jsx";
import { createPublicRouteIsland } from "./createPublicRouteIsland.jsx";

const CheckoutIsland = createPublicRouteIsland(Checkout, "/checkout");
export default CheckoutIsland;
