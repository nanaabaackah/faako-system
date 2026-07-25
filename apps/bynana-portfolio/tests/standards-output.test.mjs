import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import test from 'node:test';

const DIST_DIR = new URL('../dist/', import.meta.url).pathname;

const walk = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });

const htmlFiles = walk(DIST_DIR).filter((file) => extname(file) === '.html');
const allOutputFiles = walk(DIST_DIR);

const resolveOutputTarget = (htmlFile, rawTarget) => {
  const target = rawTarget.split('?')[0];
  const absolute = target.startsWith('/')
    ? join(DIST_DIR, target)
    : resolve(htmlFile, '..', target);

  return [absolute, `${absolute}.html`, join(absolute, 'index.html')];
};

test('generated HTML has no broken local links, missing assets, or duplicate ids', () => {
  const issues = [];

  for (const htmlFile of htmlFiles) {
    const html = readFileSync(htmlFile, 'utf8');
    const outputName = relative(DIST_DIR, htmlFile);

    for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
      const target = match[1];
      if (/^(?:https?:|mailto:|tel:|data:)/.test(target)) continue;
      if (!resolveOutputTarget(htmlFile, target).some(existsSync)) {
        issues.push(`${outputName} references missing ${target}`);
      }
    }

    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
    const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    if (duplicates.length) issues.push(`${outputName} duplicates ${duplicates.join(', ')}`);
  }

  assert.deepEqual(issues, []);
});

test('the initial application chunk stays inside its performance budget', () => {
  const assetDirectory = join(DIST_DIR, '_astro');
  const applicationChunk = readdirSync(assetDirectory).find((name) =>
    /^PortfolioApp\..+\.js$/.test(name)
  );

  assert.ok(applicationChunk, 'missing PortfolioApp client chunk');
  assert.ok(
    statSync(join(assetDirectory, applicationChunk)).size <= 150_000,
    'PortfolioApp client chunk exceeds the 150 KB minified budget'
  );
});

test('generated images stay inside their delivery budget and all rewritten references resolve', () => {
  const imageDirectory = join(DIST_DIR, 'imgs');
  const imageFiles = walk(imageDirectory);
  const totalImageBytes = imageFiles.reduce((total, file) => total + statSync(file).size, 0);
  const issues = [];

  assert.ok(totalImageBytes <= 70 * 1024 * 1024, 'generated images exceed the 70 MB delivery budget');

  for (const file of allOutputFiles.filter((output) =>
    ['.css', '.html', '.js', '.json', '.txt', '.xml'].includes(extname(output))
  )) {
    const content = readFileSync(file, 'utf8');
    for (const match of content.matchAll(/\/imgs\/[^"'`)\s]+/g)) {
      const target = match[0].split('?')[0];
      if (!existsSync(join(DIST_DIR, target))) {
        issues.push(`${relative(DIST_DIR, file)} references missing ${target}`);
      }
    }
  }

  assert.deepEqual(issues, []);
});

test('heavy decorative code is deferred and removed libraries stay out of the primary chunk', () => {
  const home = readFileSync(join(DIST_DIR, 'index.html'), 'utf8');
  const assetDirectory = join(DIST_DIR, '_astro');
  const applicationChunk = readdirSync(assetDirectory).find((name) =>
    /^PortfolioApp\..+\.js$/.test(name)
  );
  const applicationCode = readFileSync(join(assetDirectory, applicationChunk), 'utf8');

  assert.equal(home.includes('ShapeBlur.'), false, 'homepage eagerly preloads WebGL decoration');
  assert.equal(applicationCode.includes('mathjs'), false, 'primary chunk still contains mathjs');
  assert.equal(applicationCode.includes('Loading By Nana'), false, 'forced page loader remains');
});

test('Cloudflare output retains the required browser-security baseline', () => {
  const headers = readFileSync(join(DIST_DIR, '_headers'), 'utf8');

  assert.match(headers, /Content-Security-Policy:/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /Referrer-Policy: strict-origin-when-cross-origin/);
  assert.match(headers, /Permissions-Policy:/);
});

test('known stale public claims and broken repository destinations are absent', () => {
  const output = htmlFiles.map((file) => readFileSync(file, 'utf8')).join('\n');

  assert.equal(output.includes('github.com/nanaabaackah/bynana-portfolio'), false);
  assert.equal(output.includes('Optimized image usage with lazy loading'), false);
  assert.equal(output.includes('Vite build pipeline keeps delivery fast'), false);
});

test('trust stats use the live endpoint without presenting a fabricated fallback', () => {
  const homeSource = readFileSync(new URL('../src/views/Home.jsx', import.meta.url), 'utf8');

  assert.match(homeSource, /api\.dev\.nanaabaackah\.com\/api\/public\/trust-stats/);
  assert.match(homeSource, /cache:\s*'no-store'/);
  assert.equal(homeSource.includes('LIVE_SYSTEMS_FALLBACK'), false);
  assert.equal(homeSource.includes("useState('3')"), false);
});

test('theme state uses a deterministic server and first-client snapshot', () => {
  const themeSource = readFileSync(new URL('../src/hooks/useTheme.js', import.meta.url), 'utf8');

  assert.match(themeSource, /useState\('light'\)/);
  assert.match(themeSource, /useState\('system'\)/);
  assert.equal(themeSource.includes('useState(getSystemTheme)'), false);
  assert.equal(themeSource.includes("typeof window === 'undefined'"), false);
});
