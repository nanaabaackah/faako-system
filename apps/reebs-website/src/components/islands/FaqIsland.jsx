import FAQ from "../../views/FAQ/FAQ.jsx";
import { createPublicRouteIsland } from "./createPublicRouteIsland.jsx";

const FaqIsland = createPublicRouteIsland(FAQ, "/faq");
export default FaqIsland;
