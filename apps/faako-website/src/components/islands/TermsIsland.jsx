import Terms from "../../views/Terms.jsx";
import { createLegacyRouteIsland } from "./createLegacyRouteIsland.jsx";

const TermsIsland = createLegacyRouteIsland(Terms, "/terms");
export default TermsIsland;
