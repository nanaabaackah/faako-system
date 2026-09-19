import { spawnSync } from "node:child_process";
import { APP_ENVIRONMENTS } from "@faako/config";
import { assertPrismaCommandAllowed } from "./prismaEnvironmentPolicy.mjs";

const [, , requestedEnvironment, command, ...commandArgs] = process.argv;
const environmentArgument = String(requestedEnvironment || "").trim().toLowerCase();
const supportedEnvironments = new Set(APP_ENVIRONMENTS);

if ((!supportedEnvironments.has(environmentArgument) && environmentArgument !== "current") || !command) {
  console.error("Usage: node scripts/runPrismaCommand.mjs <current|development|staging|production> <prisma-command> [...args]");
  process.exit(2);
}

if (environmentArgument !== "current") {
  process.env.APP_ENV = environmentArgument;
}
const runtime = await import("../runtimeEnv.js");
const environment = runtime.APP_ENV;
const requiresDatabase = new Set(["migrate", "db", "studio"]).has(command);

if (requiresDatabase && !runtime.isValidDatabaseUrl(runtime.DATABASE_URL)) {
  console.error(`Prisma ${command} failed safely: no valid ${environment} database configuration is available.`);
  process.exit(2);
}

try {
  assertPrismaCommandAllowed({ environment, command, commandArgs, env: process.env });
} catch (error) {
  console.error(error.message);
  process.exit(2);
}

console.log(`Running Prisma ${command} for the explicit ${environment} environment.`);
const result = spawnSync("pnpm", ["exec", "prisma", command, ...commandArgs], {
  cwd: new URL("..", import.meta.url),
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  console.error(`Prisma command could not start: ${result.error.message}`);
  process.exit(2);
}
process.exit(result.status ?? 1);
