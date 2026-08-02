import Contact from "../../views/Contact.jsx";
import { createLegacyRouteIsland } from "./createLegacyRouteIsland.jsx";

const ContactIsland = createLegacyRouteIsland(Contact, "/contact");
export default ContactIsland;
