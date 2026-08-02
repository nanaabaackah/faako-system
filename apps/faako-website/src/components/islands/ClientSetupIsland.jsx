import ClientSetup from "../../views/ClientSetup.jsx";
import { createLegacyRouteIsland } from "./createLegacyRouteIsland.jsx";

const ClientSetupIsland = createLegacyRouteIsland(ClientSetup, "/client-setup");
export default ClientSetupIsland;
