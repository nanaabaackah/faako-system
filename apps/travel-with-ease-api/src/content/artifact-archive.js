import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const safePath = value => typeof value === "string" && value.length < 500 && !/[%\\\0?#]/.test(value) && !value.startsWith("/") && value.split("/").every(part => part && !part.startsWith("."));
// Worker-only archive in the existing environment-scoped private R2 bucket.
// Nothing here is exposed through media/browser APIs.
export class ArtifactArchive {
  constructor(store, { organisationId, environment }) {
    if (!store?.client || !/^[a-f0-9-]{36}$/i.test(organisationId || "") || !["staging", "production"].includes(environment)) throw new Error("Private artifact archive configuration is incomplete.");
    this.store = store; this.prefix = `publications/${organisationId}/${environment}/`;
  }
  key(id, suffix) { if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error("Invalid publication reference."); return `${this.prefix}${id}/${suffix}`; }
  async put(key, bytes) {
    await this.store.client.send(new PutObjectCommand({ Bucket: this.store.bucket, Key: key, Body: bytes, ContentType: "application/octet-stream", CacheControl: "private, no-store" }), { abortSignal: AbortSignal.timeout(30_000) });
  }
  async get(key, limit) {
    const result = await this.store.client.send(new GetObjectCommand({ Bucket: this.store.bucket, Key: key }), { abortSignal: AbortSignal.timeout(30_000) });
    if (!result.ContentLength || result.ContentLength > limit) throw new Error("Invalid archived asset size.");
    const bytes = Buffer.from(await result.Body.transformToByteArray());
    if (bytes.length > limit) throw new Error("Archived asset exceeds limit.");
    return bytes;
  }
  async retain(id, directory) {
    const files = [];
    const walk = async relative => {
      for (const entry of await readdir(path.join(directory, relative), { withFileTypes: true })) {
        const name = relative ? `${relative}/${entry.name}` : entry.name;
        if (!safePath(name) || entry.isSymbolicLink()) throw new Error("Unsafe artifact entry.");
        if (entry.isDirectory()) await walk(name);
        else if (entry.isFile()) {
          const bytes = await readFile(path.join(directory, name));
          if (bytes.length > 25 * 1024 * 1024 || files.length >= 5000) throw new Error("Artifact exceeds archive limits.");
          const hash = digest(bytes); await this.put(this.key(id, hash), bytes);
          files.push({ path: name, digest: hash, size: bytes.length });
        }
      }
    };
    await walk("");
    await this.put(this.key(id, "manifest.json"), Buffer.from(JSON.stringify({ version: 1, files })));
  }
  async restore(id, directory) {
    const manifest = JSON.parse((await this.get(this.key(id, "manifest.json"), 2 * 1024 * 1024)).toString("utf8"));
    if (manifest.version !== 1 || !Array.isArray(manifest.files) || manifest.files.length > 5000) throw new Error("Invalid archived manifest.");
    const names = new Set();
    for (const file of manifest.files) {
      if (!safePath(file.path) || !/^[a-f0-9]{64}$/.test(file.digest) || !Number.isInteger(file.size) || file.size < 0 || file.size > 25 * 1024 * 1024 || names.has(file.path)) throw new Error("Invalid archived entry.");
      names.add(file.path);
      const bytes = await this.get(this.key(id, file.digest), 25 * 1024 * 1024);
      if (digest(bytes) !== file.digest || bytes.length !== file.size) throw new Error("Archived artifact integrity mismatch.");
      const target = path.join(directory, file.path);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes, { mode: 0o600 });
    }
  }
}
