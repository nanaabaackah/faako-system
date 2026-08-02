import ResetPassword from "../../views/ResetPassword/ResetPassword.jsx";
import { createPublicRouteIsland } from "./createPublicRouteIsland.jsx";

const ResetPasswordIsland = createPublicRouteIsland(ResetPassword, "/reset-password");
export default ResetPasswordIsland;
