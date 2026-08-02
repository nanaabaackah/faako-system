import CaseStudies from "../../views/CaseStudies.jsx";
import { createLegacyRouteIsland } from "./createLegacyRouteIsland.jsx";

const CaseStudiesIsland = createLegacyRouteIsland(CaseStudies, "/case-studies");
export default CaseStudiesIsland;
