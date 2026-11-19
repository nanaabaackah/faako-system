import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { runReviewedCommand } from "./build.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const commitPattern = /^[a-f0-9]{40}$/;

/** Railway's Git-linked deployment identity; never a staff-managed release setting. */
export function railwaySourceSha(env = process.env) {
  const sha = env.RAILWAY_GIT_COMMIT_SHA;
  return typeof sha === "string" && commitPattern.test(sha) ? sha : undefined;
}

export function requireRailwaySourceSha(env = process.env) {
  const sha = railwaySourceSha(env);
  if (!sha) throw new Error("Git-linked Railway commit identity is required for hosted publishing.");
  return sha;
}

/**
 * Hosted publication trusts the Git-linked Railway deployment commit and also
 * checks the checkout if Git metadata is present. Local/test executions must
 * prove their reviewed checkout through Git as before.
 */
export async function assertPublicationSource(expected, { env = process.env, run = runReviewedCommand, gitMetadataPresent = existsSync(path.join(root, ".git")) } = {}) {
  if (!commitPattern.test(expected || "")) throw new Error("Publication requires a reviewed source commit.");
  const hosted = ["staging", "production"].includes(env.APP_ENV);
  if (hosted && requireRailwaySourceSha(env) !== expected)
    throw new Error("Deployed Railway source does not match the requested publication release.");

  if (!hosted || gitMetadataPresent) {
    const sha = await run("git", ["rev-parse", "HEAD"], { PATH: env.PATH });
    if (sha !== expected) throw new Error("Checkout does not match the approved publication source.");
    const dirty = await run("git", ["status", "--porcelain", "--",
      "apps/travel-with-ease-api", "apps/travel-with-ease-web", "packages", "package.json", "pnpm-lock.yaml"], { PATH: env.PATH });
    if (dirty) throw new Error("Publication requires a clean reviewed checkout.");
  }
  return expected;
}
