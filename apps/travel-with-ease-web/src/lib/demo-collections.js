// Synthetic content only. Never use as a hosted public-content fallback.
import photos from "./approved-preview-media.json";
const image = (placement) => {
  const photo = photos.find((item) => item.placement === placement);
  if (!photo) throw new Error("Missing approved demo photograph.");
  return { ...photo, src: photo.sources.at(-1).src };
};
export const demoPackages = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    slug: "zanzibar-sample-journey",
    title: "A slower rhythm in Zanzibar",
    destination: "Zanzibar",
    category: "Coast and culture",
    duration: "Illustrative itinerary",
    dates: "Dates await approval",
    overview:
      "Explore the design of a coast-focused journey. This sample is not an advertised offer; dates, inclusions, accommodation and prices have not been confirmed.",
    image: image("closing"),
    gallery: [image("journal"), image("closing")],
    availability: "enquiry",
    highlights: ["A sample coastal journey", "Space for a personalised pace"],
    inclusions: [],
    exclusions: [],
    transport: "Flight and transfer details await approval.",
    accommodation: "No accommodation has been confirmed for this sample.",
    important: "Demonstration only. This journey cannot be booked.",
    itinerary: [
      {
        day: 1,
        title: "An idea for your arrival",
        text: "A sample itinerary entry to demonstrate the layout. Actual arrangements must be agreed with the agency.",
      },
      {
        day: 2,
        title: "Room to explore",
        text: "A second sample entry, not a confirmed excursion or inclusion.",
      },
    ],
    relatedArticles: ["planning-a-coastal-escape"],
    relatedPackageSlugs: ["kenya-sample-journey"],
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    slug: "kenya-sample-journey",
    title: "A different view of Kenya",
    destination: "Kenya",
    category: "Nature and discovery",
    duration: "Illustrative itinerary",
    dates: "Dates await approval",
    overview:
      "Explore a discovery-focused package layout with approved travel photography. This is a synthetic preview, not a confirmed itinerary or priced offer.",
    image: image("wildlife"),
    gallery: [image("wildlife")],
    availability: "enquiry",
    highlights: [
      "A sample discovery journey",
      "A conversation about your preferences",
    ],
    inclusions: [],
    exclusions: [],
    transport: "",
    accommodation: "",
    important:
      "Demonstration only. No dates, price or availability are confirmed.",
    itinerary: [
      {
        day: 1,
        title: "Start with a conversation",
        text: "This is example itinerary text. A real itinerary is supplied only after review.",
      },
    ],
    relatedArticles: ["a-little-preparation"],
    relatedPackageSlugs: ["zanzibar-sample-journey"],
  },
];
export const demoArticles = [
  {
    slug: "planning-a-coastal-escape",
    title: "Room for a slower kind of journey",
    excerpt:
      "A sample editorial about considering the pace and shape of a coastal trip.",
    category: "Destination stories",
    date: "2026-11-01",
    author: "",
    body: "This is demonstration editorial, not a published TWE story.\n\nThink about the pace you enjoy, the people you are travelling with and the questions you would like to discuss. A journey can begin with an idea rather than a complete itinerary.\n\nConfirm the actual destination information and arrangements with the agency before making plans.",
    image: image("closing"),
    gallery: [image("journal")],
    relatedPackageSlugs: ["zanzibar-sample-journey"],
  },
  {
    slug: "a-little-preparation",
    title: "A little preparation, a clearer plan",
    excerpt:
      "A sample travel guide showing how practical editorial content will appear.",
    category: "Travel guides",
    date: "2026-11-01",
    author: "",
    body: "Demonstration guide only. This is not official guidance on entry, health or airline requirements.\n\nMake a note of your proposed dates, preferred pace and questions. Discuss them with the agency and verify current requirements with the responsible authorities.",
    image: image("wildlife"),
    gallery: [],
    relatedPackageSlugs: ["kenya-sample-journey"],
  },
];
export const localCollectionsEnabled = () =>
  import.meta.env.DEV &&
  !["staging", "production"].includes(process.env.PUBLIC_APP_ENV || "") &&
  !process.env.TWE_CONTENT_SNAPSHOT;
export const demoCollectionsEnabled = () =>
  localCollectionsEnabled() ||
  (import.meta.env.PUBLIC_APP_ENV === "staging" &&
    import.meta.env.PUBLIC_STAGING_DEMO_ENABLED === "true");
export const localCollectionRequest = (url) =>
  localCollectionsEnabled() &&
  ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
export const demoCollectionRequest = (url) =>
  localCollectionRequest(url) ||
  (import.meta.env.PUBLIC_APP_ENV === "staging" &&
    import.meta.env.PUBLIC_STAGING_DEMO_ENABLED === "true");
