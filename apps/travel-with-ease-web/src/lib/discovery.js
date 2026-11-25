import { plainRichText } from "../../../travel-with-ease-api/src/content/rich-text.js";

// Only published and actually displayed content belongs in machine-readable
// discovery metadata. Do not invent prices, bookings, ratings or guarantees.
export function pageDiscovery({ origin, canonical, pathname, title, description, content, sharingImage, agencyDescription }) {
  const site = new URL(origin).origin;
  const agencyId = site + "/#travel-agency";
  const siteId = site + "/#website";
  const pageId = canonical + "#webpage";
  const agency = {
    "@type": "TravelAgency", "@id": agencyId, name: "Travel With Ease", url: site + "/",
    areaServed: "Ghana", description: plainRichText(agencyDescription || "Travel planning from Ghana."),
  };
  const website = { "@type": "WebSite", "@id": siteId, name: "Travel With Ease", url: site + "/", publisher: { "@id": agencyId }, inLanguage: "en-GH" };
  const page = { "@type": "WebPage", "@id": pageId, url: canonical, name: plainRichText(title), description: plainRichText(description), isPartOf: { "@id": siteId }, inLanguage: "en-GH", about: { "@id": agencyId } };
  const graph = [agency, website, page];
  const route = pathname.replace(/\/$/, "") || "/";
  if (route === "/faqs" && content?.entries?.length) {
    page["@type"] = "FAQPage";
    page.mainEntity = content.entries.filter(entry => entry.heading && entry.text).map(entry => ({
      "@type": "Question", name: plainRichText(entry.heading),
      acceptedAnswer: { "@type": "Answer", text: plainRichText(entry.text) },
    }));
  } else if ((route.startsWith("/journal/") || route.startsWith("/travel-tips/")) && content?.title && content?.body) {
    graph.push({
      "@type": "Article", "@id": canonical + "#article", headline: plainRichText(content.title),
      description: plainRichText(content.excerpt || description),
      mainEntityOfPage: { "@id": pageId }, publisher: { "@id": agencyId },
      ...(content.author && content.author !== "Travel With Ease" ? { author: { "@type": "Person", name: content.author } } : { author: { "@id": agencyId } }),
      ...(/^\d{4}-\d{2}-\d{2}$/.test(content.date || "") ? { datePublished: content.date } : {}),
      ...(sharingImage ? { image: sharingImage } : {}), inLanguage: "en-GH",
    });
  } else if (route.startsWith("/services/") && content?.title && content?.text) {
    graph.push({ "@type": "Service", "@id": canonical + "#service", name: plainRichText(content.title),
      description: plainRichText(content.text), url: canonical, provider: { "@id": agencyId }, areaServed: "Ghana" });
    page.mainEntity = { "@id": canonical + "#service" };
  } else if (route.startsWith("/packages/") && content?.title && content?.overview) {
    graph.push({ "@type": "TouristTrip", "@id": canonical + "#trip", name: plainRichText(content.title),
      description: plainRichText(content.overview), url: canonical, provider: { "@id": agencyId },
      ...(content.destination ? { itinerary: { "@type": "Place", name: plainRichText(content.destination) } } : {}) });
    page.mainEntity = { "@id": canonical + "#trip" };
  }
  return { "@context": "https://schema.org", "@graph": graph };
}
