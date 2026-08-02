import Signup from "../../views/Signup.jsx";
import { createLegacyRouteIsland } from "./createLegacyRouteIsland.jsx";

const SignupIsland = createLegacyRouteIsland(Signup, "/signup");
export default SignupIsland;
