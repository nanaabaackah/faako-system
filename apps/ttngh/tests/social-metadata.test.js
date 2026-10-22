import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { imageMetadata } from 'astro/assets/utils';
import { socialMetadata, productionUrl } from '../src/lib/social-metadata.js';
import { isIndexable } from '../src/lib/indexability.js';
import { contentIssues } from '../src/lib/cms-validation.js';
import { seo } from '../studio/schema/fields.js';
const root = new URL('../public/', import.meta.url);
test('default branded share image has absolute production URL and actual 1200×630 dimensions', async () => {
  const result = socialMetadata();
  assert.equal(result.image.url, 'https://thethrivingnetworkgh.org/images/social/ttngh-default.png');
  const dimensions = await imageMetadata(await readFile(new URL('images/social/ttngh-default.png', root)), 'default');
  assert.equal(dimensions.width, result.image.width);
  assert.equal(dimensions.height, result.image.height);
  assert.equal(result.image.width, 1200); assert.equal(result.image.height, 630);
});
test('page social fields beat SEO/content, which beat site defaults', () => {
  const input = { title: 'Content', description: 'Content description', siteSeo: { socialTitle: 'Site', socialDescription: 'Site description' }, seo: { title: 'SEO', description: 'SEO description', socialTitle: 'Share', socialDescription: 'Share description' } };
  assert.equal(socialMetadata(input).title, 'Share');
  assert.equal(socialMetadata(input).description, 'Share description');
  delete input.seo.socialTitle; delete input.seo.socialDescription;
  assert.equal(socialMetadata(input).title, 'SEO');
  assert.equal(socialMetadata({...input, seo: {}}).title, 'Content');
  assert.equal(socialMetadata({siteSeo:input.siteSeo}).title, 'Site');
});
test('page image beats site image; optional social image beats page image', () => {
  const asset = {url:'https://cdn.sanity.io/images/project/production/approved.jpg',width:1200,height:630,alt:'Participants at a community event'};
  const input = {image:{url:'/images/home/closing-community.jpg'},siteSeo:{socialImage:asset}};
  assert.match(socialMetadata(input).image.url,/thethrivingnetworkgh.org\/images\/home/);
  assert.deepEqual(socialMetadata({...input,seo:{socialImage:asset}}).image,asset);
  assert.deepEqual(socialMetadata({siteSeo:input.siteSeo}).image,asset);
  assert.equal(socialMetadata({article:true}).type,'article');
});
test('preview canonical, sharing URLs and indexing cannot leak preview hostname', () => {
  for (const path of ['/events?preview=true','https://preview.thethrivingnetworkgh.org/events?preview=true','https://other.example/events']) assert.equal(productionUrl(path),'https://thethrivingnetworkgh.org/events');
  assert.equal(socialMetadata({image:{url:'https://preview.thethrivingnetworkgh.org/image.png'}}).image.url,'https://thethrivingnetworkgh.org/image.png');
  assert.match(socialMetadata({image:{url:'http://localhost:5177/image.png'}}).image.url,/thethrivingnetworkgh.org/);
  assert.equal(isIndexable('https://preview.thethrivingnetworkgh.org','true'),false);
  assert.equal(isIndexable('https://thethrivingnetworkgh.org','false'),false);
});
test('favicon assets, manifest paths and BaseLayout references exist', async () => {
  const layout = await readFile(new URL('../src/layouts/BaseLayout.astro',import.meta.url),'utf8');
  for (const path of ['favicon.svg','favicon.ico','favicon_io/favicon-32x32.png','favicon_io/favicon-16x16.png','favicon_io/apple-touch-icon.png','favicon_io/site.webmanifest']) {
    assert.ok((await readFile(new URL(path,root))).length); assert.ok(layout.includes(`href="/${path}"`));
  }
  const manifest = JSON.parse(await readFile(new URL('favicon_io/site.webmanifest',root),'utf8'));
  for (const icon of manifest.icons) assert.ok((await readFile(new URL(`.${icon.src}`,root))).length);
  for (const property of ['og:type','og:site_name','og:title','og:description','og:url','og:image','og:image:width','og:image:height','og:image:alt','twitter:card','twitter:title','twitter:description','twitter:image','twitter:image:alt']) assert.ok(layout.includes(`"${property}"`));
  assert.match(layout,/isPreviewDomain \|\| noIndex \? "noindex, nofollow"/);
});
test('optional Studio controls exist and malformed social content fails boundary validation', () => {
  for (const name of ['socialTitle','socialDescription','socialImage']) assert.ok(seo.fields.some(field=>field.name===name));
  const errors=contentIssues({_type:'impactStat',seo:{socialTitle:'x'.repeat(121),socialImage:{url:'https://evil.example/photo.jpg'}}});
  assert.ok(errors.some(error=>error.includes('socialTitle')));
  assert.ok(errors.some(error=>error.includes('Social image')));
});
