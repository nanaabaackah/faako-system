// Offline, explicit Drive downloads only. Never reads Google credentials or writes R2.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareImage } from "../../travel-with-ease-api/src/media/images.js";

const sourceRoot = process.argv[2];
if (!sourceRoot || !path.isAbsolute(sourceRoot))
  throw new Error("Provide an absolute local source review directory.");
const destination = fileURLToPath(new URL("../public/media/", import.meta.url));
const reviewed = [
  {
    file: "kenya-a.jpg",
    key: "kenya-giraffe",
    country: "Kenya",
    placement: "wildlife",
    driveId: "1srai16o0GXawJ0-4lefpzX1QUb0nVEZS",
    alt: "A giraffe beside a feeding platform in Kenya.",
  },
  {
    file: "kenya-c.jpg",
    key: "kenya-pelicans",
    country: "Kenya",
    placement: "hero",
    driveId: "17MLVc2kvd7f4xkqcE9iPCq23s1yyav-G",
    alt: "Pelicans lifting from the water of a lake in Kenya.",
  },
  {
    file: "zanzibar-a.jpg",
    key: "zanzibar-sunset",
    country: "Zanzibar",
    placement: "journal",
    driveId: "1TGX0GrhbvNXkghKOBd-DAS-ckuDxWcMG",
    alt: "Sunset over the sea in Zanzibar, with a silhouetted person in the foreground.",
  },
  {
    file: "zanzibar-c.jpg",
    key: "zanzibar-pool",
    country: "Zanzibar",
    placement: "closing",
    driveId: "13Yn0mjCvvANlHgDB_OsF2BQ9dn1Wa3ON",
    alt: "A poolside view towards the ocean in Zanzibar.",
  },
];
const entries = [];
for (const { file, ...entry } of reviewed) {
  const bytes = await readFile(path.join(sourceRoot, file));
  const sourceSha256 = createHash("sha256").update(bytes).digest("hex");
  const outputs = await prepareImage(bytes, "image/jpeg");
  const sources = [];
  for (const output of outputs) {
    if (sources.some((source) => source.width === output.width)) continue;
    const filename = `${entry.key}-${sourceSha256.slice(0, 12)}-${output.width}.webp`;
    await writeFile(path.join(destination, filename), output.bytes);
    sources.push({
      src: `/media/${filename}`,
      width: output.width,
      bytes: output.bytes.length,
      reviewFile: filename,
    });
  }
  const largest = outputs.at(-1);
  entries.push({
    ...entry,
    sourceSha256,
    width: largest.width,
    height: largest.height,
    sources,
  });
}
// Source manifest changes are reviewed separately; this command writes image assets only.
console.log(JSON.stringify(entries, null, 2));
