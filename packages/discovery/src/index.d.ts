export interface BreadcrumbInput {
  name: string;
  path: string;
}

export interface FaqInput {
  question: string;
  answer: string;
}

export interface RobotsOptions {
  indexable?: boolean;
  sitemapUrl?: string | URL;
  disallow?: string[];
}

export interface DiscoveryPageContract {
  title?: string;
  description?: string;
  canonical?: string | URL;
  h1Count?: number;
  indexable?: boolean;
  noIndex?: boolean;
  status?: number;
}

export function normalizeDiscoveryPath(value?: unknown): string;
export function canonicalUrl(path: unknown, origin: string | URL): string;
export function absoluteDiscoveryUrl(value: unknown, origin: string | URL): string;
export function serializeJsonLd(value: unknown): string;
export function buildBreadcrumbList(items: BreadcrumbInput[], origin: string | URL): Record<string, unknown>;
export function buildFaqPage(items: FaqInput[]): Record<string, unknown>;
export function buildRobotsText(options?: RobotsOptions): string;
export function validateDiscoveryPage(page?: DiscoveryPageContract): {
  valid: boolean;
  errors: string[];
};
