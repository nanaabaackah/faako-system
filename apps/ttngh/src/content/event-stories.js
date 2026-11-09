import { galleryAlbums, galleryPhoto } from "./gallery.js";

const archivePhoto = (name, alt) => ({ src: `/images/refresh/${name}-960.webp`, width: 960, height: 640, alt });

// Editorial recaps, not scheduled events. Do not invent dates or calendar entries.
export const eventStories = [
  {
    slug: "african-science-academy",
    title: "TTNGH at African Science Academy",
    summary: "A photographic look at TTNGH's visit to African Science Academy.",
    image: galleryPhoto("asa-2.webp"),
    photos: galleryAlbums[0].photos,
    paragraphs: ["Explore moments from TTNGH's visit to African Science Academy, documented in the organisation's approved photography.", "The collection brings together photographs from inside the classroom and outside the school, including the TTNGH team and its display materials."],
    gallery: "african-science-academy",
    links: [],
  },
  {
    slug: "odorgonno-nilee-consult",
    title: "Odorgonno school engagement with Nilee Consult",
    summary: "Nilee Consult and TTNGH came together for a school engagement focused on mental health awareness.",
    image: galleryPhoto("nilee-2.webp"),
    photos: galleryAlbums[1].photos,
    paragraphs: ["The school engagement with Nilee Consult and The Thriving Network GH brought mental health awareness to Odorgonno Senior High School.", "Photographs from the session show speakers, students listening and applauding, and a student taking the microphone. Read the related coverage for more context about the collaboration."],
    gallery: "odorgonno-nilee-consult",
    links: [{href:"/news/coverage/mental-health-education-odorgonno",label:"Read the Pulse Ghana coverage"}, {href:"/news/coverage/nilee-ttngh-school-engagement",label:"Read the Yemmey coverage"}],
  },
  {
    slug: "vision-with-clarity",
    title: "Vision with Clarity",
    summary: "Reflection, intentional planning and connection through TTNGH's annual well-being programme.",
    image: archivePhoto("vision-gathering", "People gathered around tables at Vision with Clarity"),
    photos: [archivePhoto("vision-reflection", "Participants writing at a table during Vision with Clarity")],
    paragraphs: ["Launched in 2026, Vision with Clarity is TTNGH's annual reflection and well-being programme.", "It brings participants together for guided reflection, intentional planning, facilitated learning, connection, and a renewed focus on personal well-being."],
    links: [],
  },
  {
    slug: "tema-school-outreach",
    title: "Mental health education in Tema",
    summary: "School outreach at Presbyterian Senior High School, Tema.",
    image: archivePhoto("tema-school-audience", "Students seated together during TTNGH's school outreach in Tema"),
    photos: [archivePhoto("tema-school-speaker", "A speaker addressing students during the Tema school programme")],
    paragraphs: ["TTNGH's documented community outreach includes a mental health education programme at Presbyterian Senior High School, Tema.", "School outreach is part of the organisation's wider education work, alongside workshops and seminars for workplaces, churches and community centres."],
    links: [],
  },
];
