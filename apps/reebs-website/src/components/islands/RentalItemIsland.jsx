import RentalItem from "../../views/RentalItem/RentalItem.jsx";
import { createPublicRouteIsland } from "./createPublicRouteIsland.jsx";

const RentalItemIsland = createPublicRouteIsland(RentalItem, "/rentals/:slug");
export default RentalItemIsland;
