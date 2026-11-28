import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { enumerateDriveImages, MediaSync } from "../src/media/sync.js";
import { readR2Config } from "../src/media/r2.js";
import { readDriveConfig } from "../src/media/drive.js";

const fixtureId = "abcDEFghi123456789";
const nestedId = "nestedDEFghi1234567";
const file = { id: fixtureId, name: "Approved later.png", mimeType: "image/png", size: 68,
  version: "3", md5Checksum: "a".repeat(32), syncEligible: true };
const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6SkWgAAAAASUVORK5CYII=", "base64");

test("Drive media reads must be scoped to TTNGH variables and approved roots", () => {
  assert.equal(readDriveConfig({ TWE_GOOGLE_SERVICE_ACCOUNT_JSON: "another app" }), null);
  assert.throws(() => readDriveConfig({ GOOGLE_DRIVE_ROOT_FOLDER_ID: nestedId }), /incomplete/);
});
test("R2 media keys require an explicit staging or production environment", () => {
  const base = { R2_ACCOUNT_ID: "a".repeat(32), R2_ACCESS_KEY_ID: "synthetic-id",
    R2_SECRET_ACCESS_KEY: "synthetic-secret", R2_BUCKET_NAME: "ttngh-media" };
  assert.throws(() => readR2Config({ ...base, NODE_ENV: "production" }));
  const staging = readR2Config({ ...base, NODE_ENV: "production", TTNGH_MEDIA_ENV: "staging" });
  assert.equal(staging.prefix, "ttngh/staging/media/");
  assert.equal(readR2Config({ ...base, TTNGH_MEDIA_ENV: "production" }).prefix, "ttngh/production/media/");
});
test("nested folders and pagination are traversed; external folders are never discovered", async () => {
  const calls = [];
  const drive = {
    config: { folderId: "rootABCdef12345678" },
    async list(token, id) {
      calls.push([id, token]);
      if (id === this.config.folderId && !token) return { items: [], folders: [{id:nestedId,name:"Gallery"}],nextPageToken:"more" };
      if (id === this.config.folderId) return { items: [{...file,id:"root_IMAGE123456789"}], folders:[],nextPageToken:"" };
      if (id === nestedId) return { items: [file], folders: [], nextPageToken:"" };
      throw new Error("Unexpected folder");
    }
  };
  const files = [];
  for await (const found of enumerateDriveImages(drive)) files.push(found);
  assert.deepEqual(files.map(f => f.id), ["root_IMAGE123456789",fixtureId]);
  assert.deepEqual(files[1].path, ["Gallery"]);
  assert.equal(calls.length, 3);
  await assert.rejects(async () => {
    for await (const unused of enumerateDriveImages(drive, { maxFolders: 1 })) void unused;
  }, /limit/);
});
test("a read-only media plan never writes to R2 or the registry", async () => {
  let writes = 0;
  const drive={config:{folderId:"rootABCdef12345678"},async list(){return{items:[file],folders:[],nextPageToken:""}}};
  const pool={async connect(){return{async query(sql){if(sql.startsWith("SELECT id,status"))return{rows:[],rowCount:0};throw Error("unexpected write");},release(){}}}};
  const sync=new MediaSync(pool,drive,{async put(){writes++}});
  const result=await sync.sync({apply:false});
  assert.deepEqual(result,{mode:"dry-run",discovered:1,alreadyImported:0,pending:1,imported:0,failed:0});
  assert.equal(writes,0);
});
test("new media stays private until rights and alt text are approved", async () => {
  let updates=0;
  const pool={async query(sql){if(sql.startsWith("UPDATE")){updates++;return{rowCount:1}}return{rows:[]}}};
  const service=new MediaSync(pool);
  await assert.rejects(service.approve("not-an-id",{alt:"",rights:""}),/required/);
  const id="ba53a876-178a-4cba-96aa-2a98e0c4d2a8";
  assert.deepEqual(await service.approve(id,{alt:"A community event",rights:"Photo approved by owner"}),{id,approved:true});
  assert.equal(updates,1);
  await assert.rejects(service.exportToSanity(id,{project:"d5k303l7",dataset:"production",token:"synthetic"}),/Approved media/);
});
