import Contact from "../../views/Contact/Contact.jsx";
import { createPublicRouteIsland } from "./createPublicRouteIsland.jsx";

const ContactIsland = createPublicRouteIsland(Contact, "/contact");
export default ContactIsland;
