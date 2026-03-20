import {
  faBolt,
  faHeart,
  faRocket,
  faShieldHeart,
} from "/src/icons/iconSet";

export const HERO_PROOF_ITEMS = [
  "Bouncy Castles",
  "Cotton Candy",
  "Popcorn",
  "Trampoline",
  "Face Painting",
  "Party Supplies",
];

export const HERO_STATS = [
  {
    key: "inventory",
    label: "Inventory Items",
    meta: "cleaned and event-ready",
  },
  {
    key: "rentals",
    label: "Rentals",
    meta: "bookable party options",
  },
  {
    key: "years",
    label: "Serving Ghana",
    meta: "trusted celebrations delivered",
  },
];

export const WHY_REEBS_ITEMS = [
  {
    icon: faRocket,
    title: "We show up early",
    copy: "Setup starts before guests arrive, so your event starts on time and calm.",
  },
  {
    icon: faBolt,
    title: "No last-minute stress",
    copy: "We confirm details ahead of time and stay reachable when you need us.",
  },
  {
    icon: faHeart,
    title: "Packages that fit your budget",
    copy: "From simple setups to full styling, we help you choose what you actually need.",
  },
  {
    icon: faShieldHeart,
    title: "Kid-friendly and safe",
    copy: "Clean equipment, secure setup, and a team that knows how to run family events.",
  },
];

export const PROCESS_STEPS = [
  {
    title: "Tell us the plan",
    copy: "Share your date, guest count, and vibe. We reply fast with a clear game plan.",
  },
  {
    title: "Pick your setup",
    copy: "Choose your rentals, decor, and extras. We bundle everything so it is easy to approve.",
  },
  {
    title: "We deliver and style",
    copy: "Our team arrives, sets up, tests each item, and styles the space so you can breathe.",
  },
  {
    title: "You enjoy, we wrap",
    copy: "After the party, we handle pickup and reset quickly. No post-party headache for you.",
  },
];

export const HOME_SERVICES = [
  {
    title: "Party Rentals",
    copy: "Bouncy castles, tents, tables, chairs, games, and crowd favorites for every party size.",
    to: "/Rentals",
    image: "/imgs/services/bouncer.png",
    alt: "Party equipment rentals",
    linkLabel: "See rentals",
  },
  {
    title: "Full Party Styling",
    copy: "From balloons to backdrops, we style the space so it looks great in real life and in photos.",
    to: "/Contact",
    image: "/imgs/services/decor.png",
    alt: "Full party styling service",
    linkLabel: "Plan with us",
  },
  {
    title: "Party Supply Shop",
    copy: "Need quick add-ons? Grab decor, balloons, favors, and essentials in one stop.",
    to: "/Shop",
    image: "/imgs/services/supplies.png",
    alt: "Party supplies shop",
    linkLabel: "Shop now",
  },
];

export const REAL_PARTY_MOMENTS = [
  {
    quote: "REEBS handled setup and pickup so smoothly. We actually enjoyed the party instead of stressing.",
    name: "Ama, East Legon",
    event: "Birthday setup",
  },
  {
    quote: "The kids stayed busy all day and the team arrived early. Everything felt organized and fun.",
    name: "Kwame, Tema Community 25",
    event: "Kids party",
  },
  {
    quote: "Fast response, clear pricing, no surprises. Exactly what we needed for our office fun day.",
    name: "Nana, Airport Residential",
    event: "Corporate fun day",
  },
];

export const QUICK_ANSWERS = [
  {
    question: "How long does setup take?",
    answer: "Most setups take 45 to 120 minutes depending on package size.",
  },
  {
    question: "Which areas do you deliver to?",
    answer: "We deliver across Accra, Tema, and nearby areas. Ask us for your exact location.",
  },
  {
    question: "What payment options are available?",
    answer: "Mobile money, bank transfer, and card options are available based on your booking.",
  },
];

export const SERVICE_START_YEAR = 2004;
