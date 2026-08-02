import TermsOfService from "../../views/TermsOfService/TermsOfService.jsx";
import { createPublicRouteIsland } from "./createPublicRouteIsland.jsx";

const TermsIsland = createPublicRouteIsland(TermsOfService, "/terms-of-service");
export default TermsIsland;
