export interface PublicImage {
  src: string;
  alt: string;
  width: number;
  height: number;
  sources?: { src: string; width: number }[];
}
export interface ImagePlacement {
  image?:PublicImage|null; mobileImage?:PublicImage|null;
  focalX?:number; focalY?:number; mobileFocalX?:number; mobileFocalY?:number;
  alt?:string; layout?:'default'|'left'|'right';
}
export interface TravelPackage {
  imagePlacement?:ImagePlacement;
  id: string;
  slug: string;
  title: string;
  destination: string;
  overview: string;
  category?: string;
  duration?: string;
  dates?: string;
  priceFrom?: string;
  priceDisclosure?: string;
  availability?: string;
  image?: PublicImage | null;
  gallery?: PublicImage[];
  highlights?: string[];
  inclusions?: string[];
  exclusions?: string[];
  transport?: string;
  accommodation?: string;
  important?: string;
  itinerary?: { day: number; title: string; text: string }[];
  relatedArticles?: string[];
  relatedPackageSlugs?: string[];
  tagline?: string;
  occasions?: string[];
  groupFriendly?: boolean;
  nights?: number | null;
  days?: number | null;
  pricingStatus?: string;
  referenceMonth?: string;
  priceDisclaimer?: string;
  tiers?: { id: string; label: string; description?: string; amountMinor: number | null; currency?: string }[];
}
export interface JournalArticle {
  imagePlacement?:ImagePlacement;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  date: string;
  category?: string;
  author?: string;
  image?: PublicImage | null;
  gallery?: PublicImage[];
  relatedPackageSlugs?: string[];
}
