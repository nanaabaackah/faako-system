import {S3Client,HeadObjectCommand,PutObjectCommand} from "@aws-sdk/client-s3";
export function createR2(config, client = new S3Client({region:"auto",endpoint:`https://${config.account}.r2.cloudflarestorage.com`,credentials:{accessKeyId:config.accessKeyId,secretAccessKey:config.secretAccessKey},maxAttempts:1})) {
  const head=async key=>{
    try{return await client.send(new HeadObjectCommand({Bucket:config.bucket,Key:key}),{abortSignal:AbortSignal.timeout(30000)});}
    catch(error){if(error.$metadata?.httpStatusCode===404)return null;throw new Error("R2 metadata request failed");}
  };
  const matches=(stored,variant)=>stored.ContentLength===variant.bytes.length && stored.ContentType==="image/webp" && stored.Metadata?.sha256===variant.sha256;
  return {
    async putIfAbsent(key,variant) {
      if(!key.startsWith(`ttngh/${config.environment}/images/`))throw new Error("R2 key outside approved prefix");
      const existing=await head(key);
      if(existing){if(!matches(existing,variant))throw new Error("Existing R2 object does not match; refusing overwrite");return "existing";}
      let outcome="uploaded";
      try {
        await client.send(new PutObjectCommand({Bucket:config.bucket,Key:key,Body:variant.bytes,ContentType:"image/webp",CacheControl:"public, max-age=31536000, immutable",Metadata:{sha256:variant.sha256},IfNoneMatch:"*"}),{abortSignal:AbortSignal.timeout(60000)});
      } catch(error) {
        if(error.$metadata?.httpStatusCode!==412)throw new Error("R2 upload failed");
        outcome="existing";
      }
      const stored=await head(key);
      if(!stored || !matches(stored,variant))throw new Error("R2 upload verification failed");
      return outcome;
    },
    close(){client.destroy();},
  };
}
