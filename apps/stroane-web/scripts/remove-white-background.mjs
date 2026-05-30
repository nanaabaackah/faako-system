import fs from "node:fs/promises";
import path from "node:path";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import process from "node:process";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const publicRoot = path.join(appRoot, "public");
const cataloguePath = path.join(appRoot, "src/data/stroaneCatalogue.json");
const imagePathPattern = /^\/imgs\/products\/.+\.(jpe?g|png|webp)$/i;
const maxImageEdge = 1600;
const whiteThreshold = 242;
const maxChannelSpread = 24;

const isImagePath = (value) =>
  typeof value === "string" &&
  imagePathPattern.test(value) &&
  !value.includes("-transparent.") &&
  !value.includes("product-placeholder");

const collectImagePaths = (value, paths = new Set()) => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectImagePaths(item, paths));
    return paths;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectImagePaths(item, paths));
    return paths;
  }

  if (isImagePath(value)) {
    paths.add(value);
  }

  return paths;
};

const isConnectedBackgroundCandidate = (buffer, offset) => {
  const red = buffer[offset];
  const green = buffer[offset + 1];
  const blue = buffer[offset + 2];
  const alpha = buffer[offset + 3];
  const minChannel = Math.min(red, green, blue);
  const maxChannel = Math.max(red, green, blue);

  return alpha > 0 && minChannel >= whiteThreshold && maxChannel - minChannel <= maxChannelSpread;
};

const removeConnectedWhiteBackground = ({ data, width, height }) => {
  const totalPixels = width * height;
  const visited = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;

  const enqueue = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const pixelIndex = (y * width) + x;
    if (visited[pixelIndex]) return;
    const offset = pixelIndex * 4;
    if (!isConnectedBackgroundCandidate(data, offset)) return;
    visited[pixelIndex] = 1;
    queue[tail] = pixelIndex;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const pixelIndex = queue[head];
    head += 1;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  for (let pixelIndex = 0; pixelIndex < totalPixels; pixelIndex += 1) {
    if (!visited[pixelIndex]) continue;
    data[(pixelIndex * 4) + 3] = 0;
  }

  return data;
};

const getTransparentPath = (publicImagePath) => {
  const parsed = path.parse(publicImagePath);
  return path.posix.join(parsed.dir, `${parsed.name}-transparent.webp`);
};

const processImage = async (publicImagePath) => {
  const sourcePath = path.join(publicRoot, publicImagePath);
  const targetPublicPath = getTransparentPath(publicImagePath);
  const targetPath = path.join(publicRoot, targetPublicPath);
  const image = sharp(sourcePath, { limitInputPixels: false }).rotate();
  const metadata = await image.metadata();
  const resizeOptions =
    Math.max(metadata.width || 0, metadata.height || 0) > maxImageEdge
      ? { width: maxImageEdge, height: maxImageEdge, fit: "inside", withoutEnlargement: true }
      : undefined;
  const pipeline = resizeOptions ? image.resize(resizeOptions) : image;
  const { data, info } = await pipeline
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cutout = removeConnectedWhiteBackground({
    data: Buffer.from(data),
    width: info.width,
    height: info.height,
  });

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await sharp(cutout, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .webp({ quality: 88, alphaQuality: 95 })
    .toFile(targetPath);

  return targetPublicPath;
};

const main = async () => {
  const catalogueText = await fs.readFile(cataloguePath, "utf8");
  const catalogue = JSON.parse(catalogueText);
  const imagePaths = [...collectImagePaths(catalogue)].sort();
  const replacements = new Map();

  for (const publicImagePath of imagePaths) {
    const targetPublicPath = await processImage(publicImagePath);
    replacements.set(publicImagePath, targetPublicPath);
    process.stdout.write(`${publicImagePath} -> ${targetPublicPath}\n`);
  }

  let updatedCatalogueText = catalogueText;
  for (const [sourcePath, targetPath] of replacements) {
    updatedCatalogueText = updatedCatalogueText.split(sourcePath).join(targetPath);
  }

  await fs.writeFile(cataloguePath, updatedCatalogueText);
  process.stdout.write(`Updated ${replacements.size} product image references.\n`);
};

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exit(1);
});
