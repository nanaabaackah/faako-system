import { createSign, createHash } from "node:crypto";

const idPattern = /^[a-zA-Z0-9_-]{10,160}$/;
export const folderMime = "application/vnd.google-apps.folder";
export const maxBytes = 50 * 1024 * 1024;
export function assertDriveId(id) { if (!idPattern.test(id || "")) throw new Error("Invalid Drive ID"); }
export async function boundedBody(response, limit) {
  if (!response.ok) throw new Error("Drive request failed");
  if (Number(response.headers.get("content-length")) > limit) throw new Error("Drive response exceeds limit");
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    for (;;) {
      const {done,value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("Drive response exceeds limit");
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks);
}

export function createDrive(serviceAccount, request = fetch) {
  if (serviceAccount?.type !== "service_account" || !/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/.test(serviceAccount.client_email || "") || !serviceAccount.private_key) throw new Error("Invalid Drive service account");
  let cached;
  const token = async () => {
    if (cached && cached.expires > Date.now()) return cached.value;
    const now = Math.floor(Date.now()/1000);
    const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${encode({alg:"RS256",typ:"JWT"})}.${encode({iss:serviceAccount.client_email,scope:"https://www.googleapis.com/auth/drive.readonly",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600})}`;
    const signer=createSign("RSA-SHA256"); signer.update(unsigned); signer.end();
    const assertion=`${unsigned}.${signer.sign(serviceAccount.private_key,"base64url")}`;
    const response=await request("https://oauth2.googleapis.com/token",{method:"POST",redirect:"error",signal:AbortSignal.timeout(30000),headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion})});
    const data=JSON.parse((await boundedBody(response,65536)).toString());
    if(typeof data.access_token!=="string" || !Number.isFinite(data.expires_in) || data.expires_in<120)throw new Error("Drive authentication failed");
    cached={value:data.access_token,expires:Date.now()+(Math.min(data.expires_in,3600)-60)*1000};
    return cached.value;
  };
  const get = async (path, params, limit=4*1024*1024) => {
    const url=new URL(`https://www.googleapis.com/drive/v3/${path}`);
    url.search=new URLSearchParams(params).toString();
    return boundedBody(await request(url,{headers:{Authorization:`Bearer ${await token()}`},redirect:"error",signal:AbortSignal.timeout(60000)}),limit);
  };
  return {
    async metadata(id) { assertDriveId(id); return JSON.parse((await get(`files/${id}`,{supportsAllDrives:"true",fields:"id,name,mimeType,trashed,parents,size,md5Checksum,modifiedTime"})).toString()); },
    async list(folderId,pageToken) {
      assertDriveId(folderId);
      return JSON.parse((await get("files",{q:`'${folderId}' in parents and trashed = false`,pageSize:"100",supportsAllDrives:"true",includeItemsFromAllDrives:"true",fields:"nextPageToken,incompleteSearch,files(id,name,mimeType,trashed,parents,size,md5Checksum,modifiedTime)",...(pageToken?{pageToken}:{})})).toString());
    },
    async download(file) {
      assertDriveId(file.id);
      const bytes=await get(`files/${file.id}`,{alt:"media",supportsAllDrives:"true"},maxBytes);
      if(bytes.length!==Number(file.size) || createHash("md5").update(bytes).digest("hex")!==file.md5Checksum)throw new Error("Drive image changed during sync; rerun inventory");
      return bytes;
    },
  };
}

export async function inventoryDrive(drive, rootId) {
  assertDriveId(rootId);
  const root=await drive.metadata(rootId);
  if(root.id!==rootId || root.trashed || root.mimeType!==folderMime)throw new Error("Approved Drive root is unavailable");
  const queue=[{id:rootId,path:[]}], seen=new Set(), files=[];
  while(queue.length) {
    const folder=queue.shift();
    if(seen.has(folder.id))continue;
    seen.add(folder.id);
    if(seen.size>200 || folder.path.length>12)throw new Error("Drive folder traversal limit exceeded");
    let pageToken;
    const tokens=new Set();
    do {
      const page=await drive.list(folder.id,pageToken);
      if(page.incompleteSearch || !Array.isArray(page.files))throw new Error("Drive inventory is incomplete");
      for(const file of page.files) {
        assertDriveId(file.id);
        if(file.trashed || !file.parents?.includes(folder.id))throw new Error("Drive inventory scope changed");
        if(typeof file.name!=="string" || file.name.length>512)throw new Error("Invalid Drive filename");
        if(file.mimeType===folderMime)queue.push({id:file.id,path:[...folder.path,file.name]});
        else files.push({...file,folderPath:folder.path.join("/")});
        if(queue.length>200)throw new Error("Drive pending folder limit exceeded");
        if(files.length>2000)throw new Error("Drive file inventory limit exceeded");
      }
      pageToken=page.nextPageToken;
      if(pageToken && tokens.has(pageToken))throw new Error("Drive pagination loop");
      if(pageToken)tokens.add(pageToken);
    } while(pageToken);
  }
  return [...new Map(files.map(file=>[file.id,file])).values()].sort((a,b)=>a.id.localeCompare(b.id));
}

export function eligibleImage(file) {
  return ["image/jpeg","image/png","image/webp"].includes(file.mimeType) && Number.isSafeInteger(Number(file.size)) && Number(file.size)>0 && Number(file.size)<=maxBytes && /^[a-f0-9]{32}$/.test(file.md5Checksum || "");
}
