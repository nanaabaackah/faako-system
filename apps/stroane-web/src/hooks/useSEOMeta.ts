import { useEffect } from "react";

export interface SEOConfig {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
  noIndex?: boolean;
  ogType?: "website" | "article" | "product";
  ogImage?: string;
}

const SITE_NAME = "Stroane";
const SITE_URL = "https://stroanesolutions.com";
const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/logos/logo_long.png`;

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

const useSEOMeta = ({
  title,
  description,
  keywords,
  canonical,
  noIndex = false,
  ogType = "website",
  ogImage,
}: SEOConfig) => {
  useEffect(() => {
    document.title = `${title} | ${SITE_NAME}`;

    const canonicalHref = canonical ?? `${SITE_URL}${window.location.pathname}`;
    const image = ogImage ?? DEFAULT_OG_IMAGE;

    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", noIndex ? "noindex, nofollow" : "index, follow");
    if (keywords) upsertMeta("name", "keywords", keywords);

    upsertLink("canonical", canonicalHref);

    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:type", ogType);
    upsertMeta("property", "og:url", canonicalHref);
    upsertMeta("property", "og:image", image);
    upsertMeta("property", "og:site_name", SITE_NAME);

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", image);

    return () => {
      document.title = SITE_NAME;
    };
  }, [title, description, keywords, canonical, noIndex, ogType, ogImage]);
};

export default useSEOMeta;
