import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  blogSeoEntries,
  projectSeoEntries,
  staticPageSeo,
} from '../src/content/seo.js';

const DIST_DIR = new URL('../dist/', import.meta.url).pathname;
const publicStaticPaths = Object.keys(staticPageSeo).filter((path) => path !== '/404');
const contentPaths = [...projectSeoEntries, ...blogSeoEntries].map((entry) => entry.path);
const expectedPaths = [...publicStaticPaths, ...contentPaths];

const outputFileForPath = (path) =>
  path === '/' ? join(DIST_DIR, 'index.html') : join(DIST_DIR, path.slice(1), 'index.html');

test('every public route is emitted as metadata-rich HTML', () => {
  for (const path of expectedPaths) {
    const outputFile = outputFileForPath(path);
    assert.equal(existsSync(outputFile), true, `missing generated page for ${path}`);

    const html = readFileSync(outputFile, 'utf8');
    const canonical = new URL(path === '/' ? '/' : path, 'https://nanaabaackah.com').toString();

    assert.match(html, /<title>[^<]+<\/title>/, `missing title for ${path}`);
    assert.match(html, /<meta name="description" content="[^"]+">/, `missing description for ${path}`);
    assert.ok(html.includes(`<link rel="canonical" href="${canonical}">`), `wrong canonical for ${path}`);
    assert.match(html, /<script type="application\/ld\+json">.+<\/script>/, `missing JSON-LD for ${path}`);
    assert.match(html, /<h1(?:\s|>)/, `missing server-rendered h1 for ${path}`);
  }
});

test('the generated sitemap matches the current public content routes', () => {
  const sitemap = readFileSync(join(DIST_DIR, 'sitemap-0.xml'), 'utf8');

  for (const path of expectedPaths) {
    const expectedUrl = path === '/' ? 'https://nanaabaackah.com' : `https://nanaabaackah.com${path}`;
    assert.ok(sitemap.includes(`<loc>${expectedUrl}</loc>`), `sitemap missing ${path}`);
  }

  assert.equal(sitemap.includes('/projects/lms'), false);
  assert.equal(sitemap.includes('/projects/stock-management'), false);
  assert.equal(sitemap.includes('/404'), false);
});

test('404 output is non-indexable and SPA fallback is removed', () => {
  const html = readFileSync(join(DIST_DIR, '404.html'), 'utf8');

  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.equal(existsSync(join(DIST_DIR, '_redirects')), false);
});
