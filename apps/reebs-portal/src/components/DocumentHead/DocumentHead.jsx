import { useEffect } from "react";

const getOrCreateMeta = (name) => {
  if (typeof document === "undefined") return null;
  const selector = `meta[name="${name}"]`;
  const existing = document.head.querySelector(selector);
  if (existing) return existing;

  const meta = document.createElement("meta");
  meta.setAttribute("name", name);
  document.head.appendChild(meta);
  return meta;
};

export default function DocumentHead({ title, robots }) {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const previousTitle = document.title;
    if (title) {
      document.title = title;
    }

    const robotsMeta = robots ? getOrCreateMeta("robots") : null;
    const previousRobots = robotsMeta?.getAttribute("content") || "";
    if (robotsMeta && robots) {
      robotsMeta.setAttribute("content", robots);
    }

    return () => {
      if (title) {
        document.title = previousTitle;
      }
      if (robotsMeta) {
        if (previousRobots) {
          robotsMeta.setAttribute("content", previousRobots);
        } else {
          robotsMeta.remove();
        }
      }
    };
  }, [robots, title]);

  return null;
}
