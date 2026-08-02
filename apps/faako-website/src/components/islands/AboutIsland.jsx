import About from "../../views/About.jsx";
import { createLegacyRouteIsland } from "./createLegacyRouteIsland.jsx";

const AboutIsland = createLegacyRouteIsland(About, "/about");
export default AboutIsland;
