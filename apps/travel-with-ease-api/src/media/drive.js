import { createHash } from "node:crypto";
import { importPKCS8, SignJWT } from "jose";
import { z } from "zod";
import { ContentError } from "../content/schema.js";
import { MAX_UPLOAD_BYTES } from "./images.js";

const tokenEndpoint = "https://oauth2.googleapis.com/token";
const scope = "https://www.googleapis.com/auth/drive.readonly";
const pkcs8Header = "-----BEGIN PRIVATE KEY-----"; // security-scan-ok: PEM format marker only, not key material.
export const driveId = z.string().regex(/^[A-Za-z0-9_-]{10,200}$/);
const folderMime = "application/vnd.google-apps.folder";
const folderSchema = z.object({
  id: driveId,
  name: z.string().min(1).max(1024),
  mimeType: z.literal(folderMime),
  parents: z.array(driveId).max(10),
  trashed: z.literal(false),
});
const mime = z.enum(["image/jpeg", "image/png", "image/webp"]);
const fileSchema = z.object({
  id: driveId,
  name: z.string().min(1).max(1024),
  mimeType: mime,
  size: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .refine((n) => n > 0 && n <= MAX_UPLOAD_BYTES),
  version: z.string().regex(/^\d{1,30}$/),
  md5Checksum: z.string().regex(/^[a-f0-9]{32}$/),
  parents: z.array(driveId).max(10),
  trashed: z.literal(false),
  capabilities: z.object({ canDownload: z.literal(true) }),
});
const fields =
  "id,name,mimeType,size,version,md5Checksum,parents,trashed,capabilities(canDownload)";
const unavailable = () =>
  new ContentError(
    503,
    "service_unavailable",
    "Google Drive could not be read. Check the media account, folder sharing and Drive API configuration.",
  );

export function readDriveConfig(env = process.env) {
  const raw = env.TWE_GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  const folderId = env.TWE_GOOGLE_DRIVE_MEDIA_FOLDER_ID?.trim();
  const clientId = env.TWE_GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.TWE_GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = env.TWE_GOOGLE_OAUTH_REFRESH_TOKEN?.trim();
  const oauth = [clientId, clientSecret, refreshToken];
  if (!raw && !folderId && !oauth.some(Boolean)) return null;
  try {
    if (oauth.some(Boolean)) {
      // Never silently select between credential modes or fall back to another app.
      if (raw || !oauth.every(Boolean) ||
        !/^[A-Za-z0-9._-]{1,512}\.apps\.googleusercontent\.com$/.test(clientId) ||
        clientSecret.length > 2048 || refreshToken.length > 8192 ||
        /\s/.test(clientSecret) || /\s/.test(refreshToken)) throw new Error();
      return { mode: "oauth", clientId, clientSecret, refreshToken, folderId: driveId.parse(folderId) };
    }
    if (!raw || raw.length > 32_768) throw new Error();
    const account = JSON.parse(raw);
    if (
      account.type !== "service_account" ||
      !/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.iam\.gserviceaccount\.com$/.test(
        account.client_email,
      ) ||
      typeof account.private_key !== "string" ||
      !account.private_key.startsWith(pkcs8Header) ||
      (account.token_uri && account.token_uri !== tokenEndpoint)
    )
      throw new Error();
    return {
      email: account.client_email,
      privateKey: account.private_key,
      folderId: driveId.parse(folderId),
    };
  } catch {
    throw new Error("TWE Google Drive configuration is incomplete or invalid.");
  }
}

async function readBytes(response, maximum) {
  if (!response.ok || !response.body) throw unavailable();
  if (Number(response.headers.get("content-length")) > maximum) {
    await response.body.cancel();
    throw new ContentError(
      413,
      "validation_error",
      "The Drive image is too large.",
    );
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maximum) {
        await reader.cancel();
        throw new ContentError(
          413,
          "validation_error",
          "The Drive response exceeds its size limit.",
        );
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

export class DriveReader {
  constructor(config, fetcher = fetch) {
    this.config = config;
    this.fetcher = fetcher;
    this.token = null;
    this.tokenRequest = null;
  }
  async accessToken() {
    if (this.token?.expires > Date.now() + 60_000) return this.token.value;
    if (!this.tokenRequest) {
      this.tokenRequest = this.requestToken().finally(() => {
        this.tokenRequest = null;
      });
    }
    return this.tokenRequest;
  }
  async requestToken() {
    try {
      let body;
      if (this.config.mode === "oauth") {
        body = new URLSearchParams({
          grant_type: "refresh_token",
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: this.config.refreshToken,
        });
      } else {
        const key = await importPKCS8(this.config.privateKey, "RS256");
        const assertion = await new SignJWT({ scope })
          .setProtectedHeader({ alg: "RS256", typ: "JWT" })
          .setIssuer(this.config.email)
          .setAudience(tokenEndpoint)
          .setIssuedAt()
          .setExpirationTime("5m")
          .sign(key);
        body = new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion,
        });
      }
      const response = await this.fetcher(tokenEndpoint, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const token = JSON.parse((await readBytes(response, 16_384)).toString());
      // Google can omit scope on refresh. If supplied, reject anything other
      // than the reviewed read-only grant; provisioning must request only it.
      if (this.config.mode === "oauth" && token.scope !== undefined &&
        (typeof token.scope !== "string" || token.scope.trim() !== scope)) throw unavailable();
      if (
        typeof token.access_token !== "string" ||
        !token.access_token.length ||
        token.access_token.length > 8192 ||
        token.token_type?.toLowerCase() !== "bearer" ||
        !Number.isFinite(token.expires_in) ||
        token.expires_in < 120 ||
        token.expires_in > 3600
      )
        throw unavailable();
      this.token = {
        value: token.access_token,
        expires: Date.now() + token.expires_in * 1000,
      };
      return token.access_token;
    } catch {
      throw unavailable();
    }
  }
  async request(parameters, suffix = "") {
    const token = await this.accessToken();
    try {
      // The caller supplies IDs/parameters, never an origin or download URL.
      return await this.fetcher(
        new URL(
          `https://www.googleapis.com/drive/v3/files${suffix}?${new URLSearchParams(parameters)}`,
        ),
        {
          redirect: "error",
          signal: AbortSignal.timeout(15_000),
          headers: { Authorization: `Bearer ${token}` },
        },
      );
    } catch {
      throw unavailable();
    }
  }
  validateFile(input, parentId = this.config.folderId) {
    const parsed = fileSchema.safeParse(input);
    if (!parsed.success || !parsed.data.parents.includes(parentId))
      throw new ContentError(
        400,
        "validation_error",
        "Choose a downloadable JPEG, PNG or WebP up to 8 MiB inside the configured media folder or its subfolders.",
      );
    return parsed.data;
  }
  // Verify ancestry on each nested listing and import, never trust a browser
  // folder ID, cached listing, shortcut or caller-supplied path.
  async assertFolder(folderId) {
    driveId.parse(folderId);
    const visited = new Set();
    let current = folderId;
    for (let depth = 0; depth < 12; depth++) {
      if (current === this.config.folderId) return;
      if (visited.has(current)) break;
      visited.add(current);
      const response = await this.request(
        { fields: "id,name,mimeType,parents,trashed", supportsAllDrives: "true" },
        `/${current}`,
      );
      let data;
      try {
        data = JSON.parse((await readBytes(response, 16_384)).toString());
      } catch {
        throw unavailable();
      }
      const parsed = folderSchema.safeParse(data);
      if (!parsed.success || parsed.data.id !== current || parsed.data.parents.length !== 1) break;
      current = parsed.data.parents[0];
    }
    if (current === this.config.folderId) return;
    throw new ContentError(400, "validation_error", "Choose a folder within the approved Drive media folder.");
  }
  async list(pageToken = "", folderId = this.config.folderId) {
    z.string().max(2048).parse(pageToken);
    await this.assertFolder(folderId);
    const query = `'${folderId}' in parents and trashed = false and (mimeType = '${folderMime}' or mimeType = 'image/jpeg' or mimeType = 'image/png' or mimeType = 'image/webp')`;
    const response = await this.request({
      q: query,
      fields: `nextPageToken,incompleteSearch,files(${fields})`,
      pageSize: "100",
      orderBy: "modifiedTime desc",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      ...(pageToken ? { pageToken } : {}),
    });
    let data;
    try {
      data = JSON.parse((await readBytes(response, 256 * 1024)).toString());
    } catch {
      throw unavailable();
    }
    if (
      !Array.isArray(data.files) ||
      data.files.length > 100 ||
      (data.nextPageToken &&
        (typeof data.nextPageToken !== "string" ||
          data.nextPageToken.length > 2048))
    )
      throw unavailable();
    // Recheck the folder after listing in case it was moved while fetching.
    if (folderId !== this.config.folderId) await this.assertFolder(folderId);
    const items = [];
    const folders = [];
    for (const file of data.files) {
      const folder = folderSchema.safeParse(file);
      if (folder.success && folder.data.parents.includes(folderId)) {
        folders.push({ id: folder.data.id, name: folder.data.name });
        continue;
      }
      try {
        const item = this.validateFile(file, folderId);
        items.push({
          id: item.id,
          name: item.name,
          mimeType: item.mimeType,
          size: item.size,
          version: item.version,
        });
      } catch {
        /* Unsupported, inaccessible or moved files are never offered. */
      }
    }
    return {
      items,
      folders,
      nextPageToken: data.nextPageToken || "",
      incomplete: data.incompleteSearch === true,
    };
  }
  async metadata(id) {
    driveId.parse(id);
    const response = await this.request(
      { fields, supportsAllDrives: "true" },
      `/${id}`,
    );
    let data;
    try {
      data = JSON.parse((await readBytes(response, 16_384)).toString());
    } catch {
      throw unavailable();
    }
    const parsed = fileSchema.safeParse(data);
    if (!parsed.success || parsed.data.parents.length !== 1)
      throw new ContentError(400, "validation_error", "Choose a supported image within the approved Drive media folder.");
    const file = parsed.data;
    if (file.id !== id) throw unavailable();
    await this.assertFolder(file.parents[0]);
    return file;
  }
  async download(file) {
    // Verify the source has not moved outside the approved tree before reading.
    const before = await this.metadata(file.id);
    if (before.version !== file.version || before.md5Checksum !== file.md5Checksum)
      throw new ContentError(409, "conflict", "The Drive image changed during download. Refresh the folder and try again.");
    const response = await this.request(
      { alt: "media", supportsAllDrives: "true" },
      `/${file.id}`,
    );
    const type = response.headers.get("content-type")?.split(";")[0].trim();
    if (type !== file.mimeType) {
      await response.body?.cancel();
      throw unavailable();
    }
    const bytes = await readBytes(response, MAX_UPLOAD_BYTES);
    if (
      bytes.length !== file.size ||
      createHash("md5").update(bytes).digest("hex") !== file.md5Checksum
    )
      throw new ContentError(
        409,
        "conflict",
        "The Drive image changed during download. Refresh the folder and try again.",
      );
    const current = await this.metadata(file.id);
    if (
      current.version !== file.version ||
      current.md5Checksum !== file.md5Checksum
    )
      throw new ContentError(
        409,
        "conflict",
        "The Drive image changed during download. Refresh the folder and try again.",
      );
    return bytes;
  }
}
