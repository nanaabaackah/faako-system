import test from "node:test";
import assert from "node:assert/strict";
import {inventoryDrive,folderMime,eligibleImage,boundedBody,createDrive} from "../src/media-sync/drive.js";
import {generateKeyPairSync,createHash} from "node:crypto";
import {approvedFolder,mediaConfig,syncMedia} from "../src/media-sync/sync.js";
const file={id:"image0000001",name:"approved.jpg",mimeType:"image/jpeg",size:"4",md5Checksum:"a".repeat(32),parents:[approvedFolder]};
const drive={metadata:async()=>({id:approvedFolder,mimeType:folderMime}),list:async()=>({files:[file]}),download:async()=>Buffer.from("test")};
test("Drive adapter uses read-only scoped service account authentication and verifies download checksums",async()=>{
  const {privateKey}=generateKeyPairSync("rsa",{modulusLength:2048,privateKeyEncoding:{type:"pkcs8",format:"pem"},publicKeyEncoding:{type:"spki",format:"pem"}});
  let authCalls=0;
  const adapter=createDrive({type:"service_account",client_email:"sync@fixture.iam.gserviceaccount.com",private_key:privateKey},async(input,options)=>{
    const url=new URL(input);
    assert.equal(options.redirect,"error");
    if(url.hostname==="oauth2.googleapis.com") {
      authCalls++;
      const assertion=options.body.get("assertion");
      const claims=JSON.parse(Buffer.from(assertion.split(".")[1],"base64url").toString());
      assert.equal(claims.scope,"https://www.googleapis.com/auth/drive.readonly");
      assert.equal(claims.sub,undefined);
      return Response.json({access_token:"test-token",expires_in:3600});
    }
    assert.equal(url.hostname,"www.googleapis.com");assert.equal(options.headers.Authorization,"Bearer test-token");
    if(url.searchParams.get("alt")==="media")return new Response("test");
    return Response.json({id:approvedFolder,mimeType:folderMime});
  });
  await adapter.metadata(approvedFolder);
  const original={...file,md5Checksum:createHash("md5").update("test").digest("hex")};
  assert.equal((await adapter.download(original)).toString(),"test");
  assert.equal(authCalls,1);
  await assert.rejects(adapter.download({...original,md5Checksum:"0".repeat(32)}));
});
test("inventory stays in approved folder, paginates, walks folders and excludes shortcuts from eligibility",async()=>{
  const nested="folder000001";
  const result=await inventoryDrive({...drive,list:async(id,page)=>id===nested?{files:[{...file,id:"nested000001",parents:[nested]}]}:page?{files:[{...file,id:"shortcut0001",mimeType:"application/vnd.google-apps.shortcut"}]}:{files:[file,{id:nested,name:"Events",mimeType:folderMime,parents:[approvedFolder]}],nextPageToken:"next"}},approvedFolder);
  assert.equal(result.length,3);
  assert.equal(result.find(f=>f.id==="nested000001").folderPath,"Events");
  assert.equal(result.filter(eligibleImage).length,2);
});
test("incomplete inventory and scope changes fail closed",async()=>{
  for(const page of [{incompleteSearch:true,files:[]},{files:[{...file,parents:["different"]}]},{files:[{...file,trashed:true}]}])await assert.rejects(inventoryDrive({...drive,list:async()=>page},approvedFolder));
  await assert.rejects(inventoryDrive({...drive,list:async()=>({files:[],nextPageToken:"repeat"})},approvedFolder));
});
test("dry run has no downloads or object writes",async()=>{
  const report=await syncMedia({drive:{...drive,download:()=>{throw Error("unexpected download");}},config:{folder:approvedFolder,environment:"staging"}});
  assert.equal(report.mode,"dry-run");assert.equal(report.uploaded,0);
  assert.equal(report.entries[0].status,"planned");assert.equal(report.websiteAssignmentsChanged,false);
});
test("apply uploads content-addressed optimized copies and repeat runs reuse keys",async()=>{
  const keys=new Set();
  const store={putIfAbsent:async key=>{if(keys.has(key))return "existing";keys.add(key);return "uploaded";}};
  const config={folder:approvedFolder,environment:"staging",origin:"https://media.thethrivingnetworkgh.org"};
  const transform=async()=>[{bytes:Buffer.from("webp"),width:640,height:426,sha256:"b".repeat(64)}];
  const args={drive,store,config,transform,apply:true};
  const first=await syncMedia(args),second=await syncMedia(args);
  assert.equal(first.uploaded,1);assert.equal(second.existing,1);
  assert.match(first.entries[0].variants[0].key,/^ttngh\/staging\/images\/webp-v1\//);
  assert.equal(keys.size,1);
  await assert.rejects(syncMedia({...args,store:{putIfAbsent:async()=>{throw Error("provider failure");}}}));
});
test("configuration requires explicit apply approval, dedicated bucket and approved origins",()=>{
  const env={GOOGLE_DRIVE_MEDIA_FOLDER_ID:approvedFolder,GOOGLE_SERVICE_ACCOUNT_JSON:"{}"};
  assert.equal(mediaConfig(env).environment,"staging");
  assert.throws(()=>mediaConfig({...env,GOOGLE_DRIVE_MEDIA_FOLDER_ID:"other0000001"}));
  assert.throws(()=>mediaConfig(env,{apply:true}));
  const enabled={...env,TTNGH_MEDIA_PUBLICATION_APPROVED:"true",R2_ACCOUNT_ID:"a".repeat(32),R2_BUCKET_NAME:"ttngh-media",R2_ACCESS_KEY_ID:"fixture",R2_SECRET_ACCESS_KEY:"fixture",R2_PUBLIC_ORIGIN:"https://media.thethrivingnetworkgh.org"};
  assert.equal(mediaConfig(enabled,{apply:true}).bucket,"ttngh-media");
  for(const change of [{R2_BUCKET_NAME:"twe-media"},{R2_PUBLIC_ORIGIN:"https://evil.example"},{R2_PUBLIC_ORIGIN:"http://media.thethrivingnetworkgh.org"},{TTNGH_MEDIA_ENV:"dev"}])assert.throws(()=>mediaConfig({...enabled,...change},{apply:true}));
});
test("oversized/unsupported input is excluded and network bodies are bounded",async()=>{
  for(const change of [{mimeType:"image/svg+xml"},{mimeType:"application/pdf"},{size:"999999999"},{size:"0"},{md5Checksum:""}])assert.equal(eligibleImage({...file,...change}),false);
  await assert.rejects(boundedBody(new Response("too big"),3));
  assert.equal((await boundedBody(new Response("ok"),10)).toString(),"ok");
});
