import { productionOrigin } from './indexability.js';

export const defaultShareImage = {
  url: '/images/social/ttngh-default.png', width: 1200, height: 630,
  alt: 'The Thriving Network GH — Peace Over Everything.',
};
const present = (...values) => values.find(value => typeof value === 'string' && value.trim())?.trim();

// Never derive discovery URLs from the deployment/request hostname.
export function productionUrl(value = '/') {
  const url = new URL(value, productionOrigin);
  const production = new URL(productionOrigin);
  production.pathname = url.pathname;
  return production.href;
}

function publicImage(image) {
  if (!image?.url) return undefined;
  try {
    const url = new URL(image.url, productionOrigin);
    if (url.username || url.password) return undefined;
    if (['thethrivingnetworkgh.org', 'preview.thethrivingnetworkgh.org'].includes(url.hostname)) {
      return { ...image, url: productionUrl(url.href) };
    }
    if (url.protocol === 'https:' && url.hostname === 'cdn.sanity.io') return { ...image, url: url.href };
  } catch { /* Invalid optional overrides fall back to approved defaults. */ }
}

export function socialMetadata({ title, description, path = '/', seo = {}, image, siteSeo = {}, article = false } = {}) {
  seo ||= {};
  siteSeo ||= {};
  return {
    title: present(seo.socialTitle, seo.title, title, siteSeo.socialTitle, siteSeo.title, 'The Thriving Network GH'),
    description: present(seo.socialDescription, seo.description, description, siteSeo.socialDescription, siteSeo.description, 'Mental wellness education, advocacy and community support in Ghana.'),
    url: productionUrl(path), type: article ? 'article' : 'website',
    image: publicImage(seo.socialImage) || publicImage(image) || publicImage(siteSeo.socialImage) || publicImage(defaultShareImage),
  };
}
