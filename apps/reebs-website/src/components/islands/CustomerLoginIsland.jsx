import Login from "../../views/Login/Login.jsx";
import { createPublicRouteIsland } from "./createPublicRouteIsland.jsx";

const CustomerLoginIsland = createPublicRouteIsland(Login, "/customer-login", {
  mode: "customer",
});
export default CustomerLoginIsland;
