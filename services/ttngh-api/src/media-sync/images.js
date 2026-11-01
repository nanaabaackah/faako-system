import sharp from "sharp";
import {createHash} from "node:crypto";
export const recipe = "webp-v1";
export async function imageVariants(bytes) {
  const options={limitInputPixels:60_000_000,failOn:"warning"};
  const metadata=await sharp(bytes,options).metadata();
  if(!["jpeg","png","webp"].includes(metadata.format) || (metadata.pages || 1)>1)throw new Error("Unsupported image format or animation");
  const width=metadata.autoOrient?.width || ([5,6,7,8].includes(metadata.orientation)?metadata.height:metadata.width);
  if(!width || !metadata.height)throw new Error("Invalid image dimensions");
  const widths=[...new Set([640,960,1600].map(size=>Math.min(size,width)))];
  const variants=[];
  for(const size of widths) {
    // Auto-orient then strip all source metadata (Sharp default). Never upscale.
    const {data,info}=await sharp(bytes,options).rotate().resize({width:size,withoutEnlargement:true}).webp({quality:82,effort:4}).toBuffer({resolveWithObject:true});
    if(data.length>10*1024*1024)throw new Error("Optimized image exceeds limit");
    variants.push({bytes:data,width:info.width,height:info.height,sha256:createHash("sha256").update(data).digest("hex")});
  }
  return variants;
}
