import Rentals from "../../views/Rentals/Rentals.jsx";
import { createCatalogueRouteIsland } from "./createCatalogueRouteIsland.jsx";

const RentalsIsland = createCatalogueRouteIsland(Rentals, "/rentals");
export default RentalsIsland;
