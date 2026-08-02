import DeliveryPolicy from "../../views/DeliveryPolicy/DeliveryPolicy.jsx";
import { createPublicRouteIsland } from "./createPublicRouteIsland.jsx";

const DeliveryPolicyIsland = createPublicRouteIsland(DeliveryPolicy, "/delivery-policy");
export default DeliveryPolicyIsland;
