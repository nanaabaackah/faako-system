import ModuleDetail from "../../views/ModuleDetail.jsx";
import { createLegacyRouteIsland } from "./createLegacyRouteIsland.jsx";

const ModuleDetailIsland = createLegacyRouteIsland(
  ModuleDetail,
  "/modules/:moduleId",
);
export default ModuleDetailIsland;
