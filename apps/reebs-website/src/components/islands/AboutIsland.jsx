import About from "../../views/About/About.jsx";
import { createPublicRouteIsland } from "./createPublicRouteIsland.jsx";

const AboutIsland = createPublicRouteIsland(About, "/about");
export default AboutIsland;
