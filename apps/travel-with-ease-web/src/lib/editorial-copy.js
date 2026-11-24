import { editorialValues } from "../../../travel-with-ease-api/src/content/editorial-fields.js";
import { publishedPage } from "./published.js";

/** @returns {Record<string,string>} */
export function siteCopy(page) {
  const values = publishedPage(page)?.editorialCopy;
  if (page === "footer") {
    // Previously published footer fields lived under site-appearance. Keep
    // those values until a dedicated footer revision explicitly overrides them.
    const legacy = publishedPage("site-appearance")?.editorialCopy;
    return editorialValues("footer", { ...legacy, ...values });
  }
  if (page === "site-appearance") {
    // Navigation stays with site-appearance; shared social/enquiry links
    // follow the dedicated footer revision when one has been published.
    const footer = publishedPage("footer")?.editorialCopy;
    return {
      ...editorialValues("footer", { ...values, ...footer }),
      ...editorialValues("site-appearance", values),
    };
  }
  return editorialValues(page, values);
}
