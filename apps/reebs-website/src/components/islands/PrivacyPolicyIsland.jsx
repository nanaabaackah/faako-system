import PrivacyPolicy from "../../views/PrivacyPolicy/PrivacyPolicy.jsx";
import { createPublicRouteIsland } from "./createPublicRouteIsland.jsx";

const PrivacyPolicyIsland = createPublicRouteIsland(PrivacyPolicy, "/privacy-policy");
export default PrivacyPolicyIsland;
