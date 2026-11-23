import { editorialValues } from "../../../travel-with-ease-api/src/content/editorial-fields.js";
import { publishedPage } from "./published.js";

/** @returns {Record<string,string>} */
export function siteCopy(page) {
  const values = publishedPage(page)?.editorialCopy;
  if (page === "footer") {
    // Older published snapshots kept footer fields under site-appearance.
    // A dedicated footer revision takes precedence without losing prior edits.
    const legacy = publishedPage("site-appearance")?.editorialCopy;
    return editorialValues("footer", { ...legacy, ...values });
  }
  if (page === "site-appearance") {
    // Shared navigation and enquiry components still read site-appearance.
    // Retain their legacy values and expose footer defaults/new social links.
    const footer = publishedPage("footer")?.editorialCopy;
    const combined = { ...footer, ...values };
    return {
      ...editorialValues("footer", combined),
      ...editorialValues("site-appearance", combined),
    };
  }
  return editorialValues(page, values);
}
