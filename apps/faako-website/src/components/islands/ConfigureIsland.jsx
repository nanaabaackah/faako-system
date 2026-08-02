import ModuleConfig from "../../views/ModuleConfig.jsx";
import { createLegacyRouteIsland } from "./createLegacyRouteIsland.jsx";

const ConfigureIsland = createLegacyRouteIsland(ModuleConfig, "/configure");
export default ConfigureIsland;
