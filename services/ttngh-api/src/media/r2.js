import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

// Existing Railway credentials are server-only. A shared bucket is acceptable only
// because every object is isolated under a TTNGH + environment-specific key prefix.
export function readR2Config(env = process.env) {
  const names = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"];
  if (!names.some(name => env[name])) return null;
  const stage = env.TTNGH_MEDIA_ENV || env.RAILWAY_ENVIRONMENT_NAME || (env.NODE_ENV === "production" ? "" : "development");
  if (names.some(name => !env[name]) || !/^[a-f\d]{32}$/i.test(env.R2_ACCOUNT_ID) ||
      !/^[a-z\d][a-z\d-]{2,62}$/.test(env.R2_BUCKET_NAME) ||
      !["staging", "production", "development"].includes(stage)) {
    throw new Error("TTNGH R2 credentials or environment separation are incomplete.");
  }
  return { accountId: env.R2_ACCOUNT_ID, accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY, bucket: env.R2_BUCKET_NAME,
    prefix: "ttngh/" + stage + "/media/" };
}

export class R2Store {
  constructor(config, client) {
    this.bucket = config.bucket;
    this.prefix = config.prefix;
    this.client = client || new S3Client({ region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      maxAttempts: 2 });
  }
  assertKey(key) {
    if (typeof key !== "string" || !key.startsWith(this.prefix) || key.includes("..") ||
        key.includes("\\") || /[?#\x00-\x1f]/.test(key)) throw new Error("Unapproved R2 object key");
    return key;
  }
  async put(key, bytes) {
    this.assertKey(key);
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key,
      Body: bytes, ContentType: "image/webp", CacheControl: "private, no-store" }),
      { abortSignal: AbortSignal.timeout(30_000) });
  }
  async exists(key) {
    this.assertKey(key);
    try { await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      { abortSignal: AbortSignal.timeout(15_000) }); return true; }
    catch (error) {
      if (error?.$metadata?.httpStatusCode === 404 || ["NotFound","NoSuchKey"].includes(error?.name)) return false;
      throw new Error("R2 media read unavailable");
    }
  }
  async get(key) {
    this.assertKey(key);
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { abortSignal: AbortSignal.timeout(30_000) });
    if (!result.ContentLength || result.ContentLength > 10 * 1024 * 1024) throw new Error("Invalid stored media size");
    return Buffer.from(await result.Body.transformToByteArray());
  }
}
