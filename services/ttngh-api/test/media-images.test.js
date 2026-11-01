import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {imageVariants} from "../src/media-sync/images.js";
import {createR2} from "../src/media-sync/r2.js";
test("image conversion keeps aspect ratio, strips metadata and never upscales",async()=>{
  const input=await sharp({create:{width:1200,height:800,channels:3,background:"#cc2277"}}).jpeg().withMetadata().toBuffer();
  const variants=await imageVariants(input);
  assert.deepEqual(variants.map(v=>v.width),[640,960,1200]);
  for(const variant of variants){const meta=await sharp(variant.bytes).metadata();assert.equal(meta.format,"webp");assert.equal(meta.exif,undefined);assert.equal(meta.icc,undefined);assert.ok(Math.abs(variant.height/variant.width-2/3)<.002);}
  const small=await sharp({create:{width:100,height:80,channels:4,background:"transparent"}}).png().toBuffer();
  const result=await imageVariants(small);assert.equal(result.length,1);assert.equal(result[0].width,100);
  await assert.rejects(imageVariants(Buffer.from("not an image")));
});
test("R2 writes are conditional and verified; mismatched existing objects are never overwritten",async()=>{
  const config={environment:"staging",bucket:"ttngh-media"}, variant={bytes:Buffer.from("webp"),sha256:"abc"};
  let object, writes=0;
  const client={destroy(){},send:async command=>{
    if(command.constructor.name==="HeadObjectCommand") {if(!object)throw {$metadata:{httpStatusCode:404}};return object;}
    writes++;assert.equal(command.input.IfNoneMatch,"*");assert.equal(command.input.ContentType,"image/webp");
    object={ContentLength:4,ContentType:"image/webp",Metadata:{sha256:"abc"}};return {};
  }};
  const store=createR2(config,client),key="ttngh/staging/images/hash/640.webp";
  assert.equal(await store.putIfAbsent(key,variant),"uploaded");
  assert.equal(await store.putIfAbsent(key,variant),"existing");assert.equal(writes,1);
  await assert.rejects(store.putIfAbsent(key,{...variant,sha256:"changed"}));assert.equal(writes,1);
  await assert.rejects(store.putIfAbsent("ttngh/production/images/unsafe",variant));
  store.close();
});
