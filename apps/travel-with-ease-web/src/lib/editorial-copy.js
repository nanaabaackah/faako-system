import { editorialValues } from "../../../travel-with-ease-api/src/content/editorial-fields.js";
import { publishedPage } from "./published.js";

/** @returns {Record<string,string>} */
export function siteCopy(page) {
  return editorialValues(page, publishedPage(page)?.editorialCopy);
}
