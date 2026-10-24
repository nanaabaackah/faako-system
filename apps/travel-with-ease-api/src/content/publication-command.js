import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { readConfig, assertLocalFoundation } from "../config.js";
import { createDatabase, verifyDatabaseIdentity } from "../db/database.js";
import { MediaService } from "../media/service.js";
import { readR2Config, R2Store } from "../media/r2.js";
import { PublicationRepository, manifestDigest } from "./publication.js";
import { preparePublication, verifyPublishedMarker } from "./artifact.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const run = (command, args, env = process.env) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: root, env, shell: false, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (data) => { output += data; });
  child.stderr.on("data", () => {});
  child.on("error", reject);
  child.on("close", (code) => code === 0 ? resolve(output.trim()) : reject(new Error("Publication command failed. Inspect the reviewed build locally.")));
});
const { environment } = readConfig();
assertLocalFoundation(environment);
const pool = createDatabase();
let job;
const publication = new PublicationRepository(pool, { environment, organisationId: process.env.TWE_ORGANISATION_ID });
try {
  await verifyDatabaseIdentity(pool, { environment, organisationId: process.env.TWE_ORGANISATION_ID });
  const action = process.argv[2];
  if (action === "build") {
    const status = await run("git", ["status", "--porcelain", "--", "apps/travel-with-ease-api", "apps/travel-with-ease-web", "packages", "pnpm-lock.yaml", "package.json", "pnpm-workspace.yaml"]);
    if (status) throw new Error("Publication requires a clean reviewed checkout of TWE and shared dependencies.");
    const sha = await run("git", ["rev-parse", "HEAD"]);
    job = await publication.claim();
    if (job) {
      if (job.source_sha !== sha) throw new Error("Checkout does not match the requested publication source.");
      const directory = await mkdtemp(path.join(tmpdir(), "twe-publication-"));
      const storage = readR2Config();
      const media = new MediaService(pool, process.env.TWE_ORGANISATION_ID, storage ? new R2Store(storage) : null);
      const artifact = await preparePublication(job, media, directory);
      const out = path.join(directory, "dist");
      await run("pnpm", ["--filter", "@faako/travel-with-ease-web", "run", "build"], {
        PATH: process.env.PATH, NODE_ENV: "production", ASTRO_TELEMETRY_DISABLED: "1",
        PUBLIC_SITE_URL: process.env.TWE_PUBLIC_SITE_ORIGIN || "https://travelwithease.example",
        PUBLIC_APP_ENV: environment, PUBLIC_SITE_INDEXABLE: "false",
        PUBLIC_API_BASE_URL: process.env.TWE_PUBLIC_API_ORIGIN || "",
        TWE_CONTENT_SNAPSHOT: artifact.snapshot, TWE_BUILD_PUBLIC_DIR: artifact.publicDirectory, TWE_BUILD_OUT_DIR: out,
      });
      console.log(JSON.stringify({ jobId: job.id, artifactDirectory: out, status: "building", message: "Built, not deployed. Separate deployment approval and marker verification are required." }));
    } else console.log("No pending publication.");
  } else if (action === "confirm") {
    const id = z.string().uuid().parse(process.argv[3]);
    const deployment = z.string().regex(/^[a-zA-Z0-9_-]{1,120}$/).parse(process.argv[4]);
    const result = await pool.query("SELECT * FROM twe.publication_jobs WHERE id = $1 AND organisation_id = $2 AND environment = $3 AND status = 'building'", [id, process.env.TWE_ORGANISATION_ID, environment]);
    const active = result.rows[0];
    if (!active) throw new Error("No matching active publication.");
    const digest = manifestDigest(active.manifest);
    await verifyPublishedMarker(process.env.TWE_PUBLIC_SITE_ORIGIN, { jobId: id, sourceSha: active.source_sha, digest });
    await publication.confirm(id, active.build_token, deployment, digest);
    console.log(JSON.stringify({ jobId: id, status: "live" }));
  } else throw new Error("Choose build or confirm <job UUID> <verified deployment ID>.");
} catch {
  if (job) {
    try { await publication.fail(job.id, job.build_token); }
    catch { console.error("Publication status could not be persisted; operator reconciliation is required."); }
  }
  console.error("Publication did not complete. Check source, configuration and deployment evidence; no successful publication was recorded.");
  process.exitCode = 1;
} finally { await pool.end(); }
