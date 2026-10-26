import sharp from "sharp";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
const [originals, output, inventoryPath] = process.argv.slice(2);
if (![originals, output, inventoryPath].every(value => value && path.isAbsolute(value))) throw new Error("Provide absolute original, private review output and inventory paths.");
await mkdir(output, {recursive:true,mode:0o700});
const files = JSON.parse(await readFile(inventoryPath,"utf8")).files.filter(file => file.folder !== "Logos");
const seen = new Map(); const report = []; const thumbnails = [];
for (const file of files) {
  const original = path.join(originals,file.driveId);
  const bytes = await readFile(original);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const record = {driveId:file.driveId,filename:file.filename,folder:file.folder,bytes:bytes.length,sha256:hash,duplicateOf:seen.get(hash)||null};
  if (record.duplicateOf) { report.push(record); continue; }
  seen.set(hash,file.driveId);
  let input = original;
  if (/heic|heif/.test(file.mimeType)) {
    input = path.join(output,`${hash}.jpg`);
    await promisify(execFile)("/usr/bin/sips",["-s","format","jpeg",original,"--out",input]);
  }
  const metadata = await sharp(input,{limitInputPixels:50000000}).metadata();
  record.sourceMetadataPresent = Boolean(metadata.exif || metadata.xmp || metadata.iptc);
  record.derivatives = [];
  for (const width of [640,1280,1920]) {
    const filename = `${hash}-${width}.webp`;
    const image = await sharp(input,{limitInputPixels:50000000}).rotate().resize({width,withoutEnlargement:true}).webp({quality:82}).toBuffer();
    const meta = await sharp(image).metadata();
    if (meta.exif || meta.xmp || meta.iptc) throw new Error("Private metadata remained.");
    await writeFile(path.join(output,filename),image,{mode:0o600});
    record.derivatives.push({filename,width:meta.width,height:meta.height,bytes:image.length});
  }
  record.reviewIndex=thumbnails.length+1;
  const thumb = await sharp(input).rotate().resize(260,180,{fit:"inside"}).extend({top:0,bottom:24,left:0,right:0,background:"white"}).png().toBuffer();
  thumbnails.push(thumb); report.push(record);
}
for (let start=0;start<thumbnails.length;start+=12) {
  const composite=[];
  for(let index=start;index<Math.min(start+12,thumbnails.length);index++) {
    const left=((index-start)%3)*280; const top=Math.floor((index-start)/3)*230;
    composite.push({input:thumbnails[index],left,top});
    composite.push({input:Buffer.from(`<svg width="260" height="24"><text x="8" y="18" font-size="16">Review ${index+1}</text></svg>`),left,top:top+205});
  }
  await sharp({create:{width:840,height:920,channels:3,background:"#eee"}}).composite(composite).png().toFile(path.join(output,`review-${start/12+1}.png`));
}
await writeFile(path.join(output,"report.json"),JSON.stringify(report,null,2),{mode:0o600});
console.log(JSON.stringify({originals:files.length,unique:seen.size,duplicates:files.length-seen.size,report:path.join(output,"report.json")}));
