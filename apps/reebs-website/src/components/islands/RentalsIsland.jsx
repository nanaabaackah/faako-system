import Rentals from "../../views/Rentals/Rentals.jsx";
import { createPublicRouteIsland } from "./createPublicRouteIsland.jsx";

const RentalsIsland = createPublicRouteIsland(Rentals, "/rentals");
export default RentalsIsland;
