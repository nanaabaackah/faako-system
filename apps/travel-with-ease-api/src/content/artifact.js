import { mkdir, writeFile, cp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { manifestDigest } from "./publication.js";
import { contentBodySchema, pageSchema } from "./schema.js";
import sharp from "sharp";

export async function preparePublication(job, media, directory) {
  const publicDirectory = path.join(directory, "public");
  await cp(fileURLToPath(new URL("../../../travel-with-ease-web/public/", import.meta.url)), publicDirectory, { recursive: true });
  await mkdir(path.join(publicDirectory, "media"), { recursive: true });
  const pages = {};
  for (const item of job.manifest.pages) {
    pageSchema.parse(item.slug);
    if (!item.body) { pages[item.slug] = null; continue; }
    const body = contentBodySchema.parse(item.body);
    let image = null;
    let socialImage = null;
    if (body.imageId) {
      const stored = await media.get(body.imageId);
      if (stored.archived_at) throw new Error("Selected media is archived.");
      const filename = `${body.imageId}.webp`;
      await writeFile(path.join(publicDirectory, "media", filename), await media.preview(body.imageId), { mode: 0o600 });
      const variant = stored.derivatives[0];
      image = { src: `/media/${filename}`, alt: stored.alt_text, width: variant.width, height: variant.height };
      const socialFilename = `${body.imageId}-social.jpg`;
      const source = await media.store.get(stored.derivatives.at(-1).key);
      await sharp(source).rotate().resize(1200, 630, { fit: "cover", position: "centre" }).jpeg({ quality: 88 }).toFile(path.join(publicDirectory, "media", socialFilename));
      socialImage = { src: `/media/${socialFilename}`, alt: stored.alt_text, width: 1200, height: 630 };
    }
    pages[item.slug] = { ...body, image, socialImage };
  }
  const marker = { jobId: job.id, sourceSha: job.source_sha, digest: manifestDigest(job.manifest) };
  const snapshot = path.join(directory, "snapshot.json");
  // The snapshot contains only selected public fields, never sessions, rights evidence or object keys.
  await writeFile(snapshot, JSON.stringify({ version: 1, pages }), { mode: 0o600 });
  await writeFile(path.join(publicDirectory, "twe-publication.json"), JSON.stringify(marker), { mode: 0o600 });
  return { snapshot, publicDirectory, marker };
}

export async function verifyPublishedMarker(origin, expected, fetcher = fetch) {
  const url = new URL(origin);
  if (url.origin !== origin || url.protocol !== "https:") throw new Error("Publication verification requires an exact HTTPS origin.");
  const response = await fetcher(new URL("/twe-publication.json", url), { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("Publication marker is unavailable.");
  const marker = await response.json();
  if (marker.jobId !== expected.jobId || marker.sourceSha !== expected.sourceSha || marker.digest !== expected.digest) throw new Error("Deployed marker does not match this publication.");
}
