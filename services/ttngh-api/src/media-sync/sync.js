import {inventoryDrive,eligibleImage,assertDriveId} from "./drive.js";
export const approvedFolder="1ifwYbrAS88Q3DrYps1xMpMbkLn3QTa51";
export function mediaConfig(env,{apply=false}={}) {
  const folder=env.GOOGLE_DRIVE_MEDIA_FOLDER_ID;
  assertDriveId(folder);
  if(folder!==approvedFolder)throw new Error("Drive root is not the approved TTNGH library");
  const environment=env.TTNGH_MEDIA_ENV || "staging";
  if(!["staging","production"].includes(environment))throw new Error("Choose staging or production media environment");
  if(!env.GOOGLE_SERVICE_ACCOUNT_JSON)throw new Error("Configure the read-only Drive service account in the server sync environment");
  let serviceAccount;
  try{serviceAccount=JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);}catch{throw new Error("Invalid service account JSON");}
  const result={folder,environment,serviceAccount};
  if(!apply)return result;
  if(env.TTNGH_MEDIA_PUBLICATION_APPROVED!=="true")throw new Error("Public image-copy approval is required for apply");
  if(!/^[a-f0-9]{32}$/.test(env.R2_ACCOUNT_ID || "") || !/^ttngh-[a-z0-9-]+$/.test(env.R2_BUCKET_NAME || "") || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY)throw new Error("Dedicated TTNGH R2 configuration is incomplete");
  let origin;
  try{origin=new URL(env.R2_PUBLIC_ORIGIN);}catch{throw new Error("Invalid R2 public origin");}
  if(origin.protocol!=="https:" || origin.username || origin.password || origin.pathname!=="/" || origin.search || origin.hash || !["media.thethrivingnetworkgh.org","media-staging.thethrivingnetworkgh.org"].includes(origin.hostname))throw new Error("R2 public origin is not an approved TTNGH media hostname");
  return {...result,origin:origin.origin,account:env.R2_ACCOUNT_ID,bucket:env.R2_BUCKET_NAME,accessKeyId:env.R2_ACCESS_KEY_ID,secretAccessKey:env.R2_SECRET_ACCESS_KEY};
}

export async function syncMedia({drive,store,transform,config,apply=false}) {
  const files=await inventoryDrive(drive,config.folder);
  const entries=[];
  let uploaded=0,existing=0;
  for(const file of files) {
    const entry={driveId:file.id,sourceName:file.name,folderPath:file.folderPath,modifiedTime:file.modifiedTime,sourceChecksum:file.md5Checksum || null,status:eligibleImage(file)?"planned":"excluded",variants:[]};
    if(!eligibleImage(file)){entry.reason="Not a supported bounded JPEG/PNG/WebP image with a checksum";entries.push(entry);continue;}
    if(apply) {
      const variants=await transform(await drive.download(file));
      for(const variant of variants) {
        const key=`ttngh/${config.environment}/images/webp-v1/${variant.sha256}/${variant.width}.webp`;
        const result=await store.putIfAbsent(key,variant);
        if(result==="existing")existing++;else uploaded++;
        entry.variants.push({key,url:`${config.origin}/${key}`,width:variant.width,height:variant.height,bytes:variant.bytes.length,sha256:variant.sha256});
      }
      entry.status="synced";
    }
    entries.push(entry);
  }
  return {version:1,generatedAt:new Date().toISOString(),environment:config.environment,mode:apply?"apply":"dry-run",rootFolder:config.folder,websiteAssignmentsChanged:false,uploaded,existing,entries};
}
