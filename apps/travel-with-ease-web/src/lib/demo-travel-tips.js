// Synthetic editorial fixtures for explicit demos and loopback-only local preview.
import photos from "./approved-preview-media.json";
const photoFor = (placement) => {
  const photo = photos.find((item) => item.placement === placement);
  if (!photo) throw new Error("Missing approved demo photograph.");
  return photo;
};
const kenya = photoFor("wildlife");
const zanzibar = photoFor("closing");
const journalPhoto = photoFor("journal");
export const demoTips = [
  {
    slug: "demo-checklist",
    title: "Start with a checklist",
    category: "Before You Go",
    excerpt:
      "A sample preparation note to explore this section. Confirm current requirements with the relevant authorities.",
    featured: true,
    order: 0,
    photo: kenya,
  },
  {
    slug: "demo-packing",
    title: "Leave room for the essentials",
    category: "Packing Smart",
    excerpt:
      "A demonstration of a short supporting tip, not advice on airline limits or entry requirements.",
    featured: false,
    order: 1,
    photo: zanzibar,
  },
  {
    slug: "demo-arrival",
    title: "Think about your arrival",
    category: "Destination Preparation",
    excerpt:
      "A sample prompt for discussing your plans with the agency. No arrangements are confirmed here.",
    featured: false,
    order: 2,
    photo: journalPhoto,
  },
].map(({ photo, ...tip }) => ({
  ...tip,
  image: { ...photo, src: photo.sources.at(-1).src },
}));
