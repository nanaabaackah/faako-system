// Application-owned, framework-neutral placement metadata. No credentials or IO.
export const sharedMockupSlots = [
  "headphones",
  "tablet",
  "laptop",
  "phone",
  "camera",
];
export function placementSlots(page) {
  if (page === "site-appearance")
    return [
      {
        id: "footer-background",
        label: "Enquiry and footer background",
        shape: "Tall portrait on mobile; one continuous background",
        minWidth: 1920,
      },
      ...sharedMockupSlots.map((name) => ({
        id: `cta-${name}`,
        label: `CTA ${name}`,
        shape: "Transparent mockup; original composition retained",
        minWidth: 960,
      })),
    ];
  if (page === "home")
    return [
      {
        id: "hero",
        label: "Homepage hero",
        shape: "Wide landscape",
        minWidth: 1920,
      },
    ];
  if (page === "about")
    return [
      {
        id: "header",
        label: "Page header",
        shape: "Landscape",
        minWidth: 1280,
      },
      {
        id: "story",
        label: "About story image",
        shape: "Portrait or landscape",
        minWidth: 1280,
        split: true,
      },
    ];
  if (page === "how-it-works")
    return [
      {
        id: "feature",
        label: "How It Works image",
        shape: "Portrait",
        minWidth: 1280,
        split: true,
      },
    ];
  return [
    { id: "header", label: "Page header", shape: "Landscape", minWidth: 1280 },
  ];
}
