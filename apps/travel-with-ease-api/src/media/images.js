import sharp from "sharp";
import { ContentError } from "../content/schema.js";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const formats = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };

export async function prepareImage(bytes, contentType) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_UPLOAD_BYTES) throw new ContentError(413, "validation_error", "Choose an image up to 8 MiB.");
  if (!formats[contentType]) throw new ContentError(400, "validation_error", "Choose a JPEG, PNG or WebP image.");
  try {
    const options = { limitInputPixels: 24_000_000, failOn: "warning", animated: false };
    const metadata = await sharp(bytes, options).metadata();
    if (metadata.format !== formats[contentType] || (metadata.pages || 1) !== 1) throw new Error("Unsupported image");
    const outputs = [];
    for (const width of [640, 1280, 1920]) {
      const { data, info } = await sharp(bytes, options).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
      outputs.push({ bytes: data, width: info.width, height: info.height, variant: width });
    }
    return outputs;
  } catch {
    throw new ContentError(400, "validation_error", "This image is invalid, animated or too large to process.");
  }
}
