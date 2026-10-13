import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { validateEnvironment } from "../config.js";

export function readR2Config(env = process.env) {
  const names = ["TWE_R2_ACCOUNT_ID", "TWE_R2_ACCESS_KEY_ID", "TWE_R2_SECRET_ACCESS_KEY", "TWE_R2_PRIVATE_BUCKET"];
  if (!names.some((name) => env[name])) return null;
  const environment = validateEnvironment(env.APP_ENV || "development", env.NODE_ENV);
  if (names.some((name) => !env[name]) || !/^[a-f0-9]{32}$/.test(env.TWE_R2_ACCOUNT_ID)) throw new Error("R2 configuration is incomplete or invalid.");
  if (!new RegExp(`^twe-${environment}-[a-z0-9-]+$`).test(env.TWE_R2_PRIVATE_BUCKET)) throw new Error("R2 bucket name must include the exact TWE environment prefix.");
  return { accountId: env.TWE_R2_ACCOUNT_ID, accessKeyId: env.TWE_R2_ACCESS_KEY_ID, secretAccessKey: env.TWE_R2_SECRET_ACCESS_KEY, bucket: env.TWE_R2_PRIVATE_BUCKET };
}

export class R2Store {
  constructor(config) {
    this.bucket = config.bucket;
    this.client = new S3Client({ region: "auto", endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }, maxAttempts: 1 });
  }
  async put(key, bytes) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes, ContentType: "image/webp", CacheControl: "private, no-store" }), { abortSignal: AbortSignal.timeout(15_000) });
  }
  async get(key) {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }), { abortSignal: AbortSignal.timeout(15_000) });
    if (!result.ContentLength || result.ContentLength > 10 * 1024 * 1024) throw new Error("Stored image size is invalid");
    return Buffer.from(await result.Body.transformToByteArray());
  }
  async remove(key) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }), { abortSignal: AbortSignal.timeout(15_000) });
  }
}
