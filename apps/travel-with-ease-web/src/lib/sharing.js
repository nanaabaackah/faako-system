export function sharingMetadata({ site, image = "/og/default.jpg", imageAlt = "Travel With Ease — your guide to stress-free travel", type = "website" }) {
  const origin = new URL(site);
  if (!image.startsWith("/") || image.startsWith("//") || /[\\?#]/.test(image)) throw new Error("Sharing images must use a site-relative asset path.");
  const absolute = new URL(image, origin);
  if (absolute.origin !== origin.origin || !/\.(jpg|jpeg|png|webp)$/.test(absolute.pathname)) throw new Error("Invalid sharing image.");
  if (!imageAlt.trim() || imageAlt.length > 500) throw new Error("Sharing images require meaningful alternative text.");
  if (!["website", "article"].includes(type)) throw new Error("Unsupported sharing type.");
  return { image: absolute.href, imageAlt, type, width: 1200, height: 630 };
}
