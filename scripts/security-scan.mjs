import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const ALLOWED_ENV_FILE_SUFFIXES = [
  ".example",
  ".sample",
  ".template",
  ".dist",
];
const SKIPPED_PATH_SEGMENTS = new Set([
  "node_modules",
  ".pnpm",
  ".turbo",
  "coverage",
]);

const SENSITIVE_FILE_PATTERNS = [
  { name: "tracked env file", test: isTrackedSecretEnvFile },
  { name: "private key file", test: (filePath) => /\.(pem|key|p12|pfx|jks|keystore)$/i.test(filePath) },
];

const CONTENT_SIGNATURES = [
  {
    name: "private key banner",
    pattern: /-----BEGIN(?: [A-Z0-9]+)* PRIVATE KEY-----/g,
  },
  {
    name: "aws access key id",
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    name: "google api key",
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },
  {
    name: "stripe live secret key",
    pattern: /\bsk_live_[0-9A-Za-z]{16,}\b/g,
  },
  {
    name: "slack token",
    pattern: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g,
  },
  {
    name: "github personal access token",
    pattern: /\bghp_[A-Za-z0-9]{36}\b/g,
  },
  {
    name: "github fine-grained token",
    pattern: /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g,
  },
];

function isTrackedSecretEnvFile(filePath) {
  const baseName = path.basename(filePath).toLowerCase();
  if (!baseName.startsWith(".env")) {
    return false;
  }

  return !ALLOWED_ENV_FILE_SUFFIXES.some((suffix) => baseName.endsWith(suffix));
}

function getTrackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], {
    cwd: rootDir,
    encoding: "utf8",
  });

  return output
    .split("\0")
    .filter(Boolean)
    .filter((filePath) => !filePath.split("/").some((segment) => SKIPPED_PATH_SEGMENTS.has(segment)));
}

function isBinaryContent(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
  return sample.includes(0);
}

function isScannableFile(absolutePath) {
  try {
    const stats = lstatSync(absolutePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

function findSensitiveFiles(files) {
  const findings = [];

  for (const filePath of files) {
    for (const rule of SENSITIVE_FILE_PATTERNS) {
      if (rule.test(filePath)) {
        findings.push({
          filePath,
          type: "file",
          rule: rule.name,
        });
      }
    }
  }

  return findings;
}

function findSensitiveContent(files) {
  const findings = [];

  for (const filePath of files) {
    const absolutePath = path.join(rootDir, filePath);
    if (!isScannableFile(absolutePath)) {
      continue;
    }

    const buffer = readFileSync(absolutePath);

    if (isBinaryContent(buffer)) {
      continue;
    }

    const content = buffer.toString("utf8");

    for (const signature of CONTENT_SIGNATURES) {
      signature.pattern.lastIndex = 0;
      if (signature.pattern.test(content)) {
        findings.push({
          filePath,
          type: "content",
          rule: signature.name,
        });
      }
    }
  }

  return findings;
}

const trackedFiles = getTrackedFiles();
const findings = [
  ...findSensitiveFiles(trackedFiles),
  ...findSensitiveContent(trackedFiles),
];

if (findings.length > 0) {
  console.error("Security scan failed. Potential secrets or key material found in tracked files:");
  findings.forEach((finding) => {
    console.error(`- ${finding.filePath}: ${finding.rule}`);
  });
  process.exit(1);
}

console.log(`Security scan passed. Checked ${trackedFiles.length} tracked files.`);
