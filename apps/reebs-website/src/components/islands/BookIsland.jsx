import Book from "../../views/Book/Book.jsx";
import { createPublicRouteIsland } from "./createPublicRouteIsland.jsx";

const BookIsland = createPublicRouteIsland(Book, "/book");
export default BookIsland;
