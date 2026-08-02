import RentalItem from "../../views/RentalItem/RentalItem.jsx";
import { createCatalogueRouteIsland } from "./createCatalogueRouteIsland.jsx";

const RentalItemIsland = createCatalogueRouteIsland(RentalItem, "/rentals/:slug");
export default RentalItemIsland;
