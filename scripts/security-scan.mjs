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

// Path segments that skip the file entirely (no file or content checks).
const SKIPPED_PATH_SEGMENTS = new Set([
  "node_modules",
  ".pnpm",
  ".turbo",
  "coverage",
]);

// Files that pass the file-path checks but should NOT be content-scanned
// because they are intentionally allowed to contain placeholder-looking values.
// Matches are checked against the full relative path from the repo root.
const CONTENT_SCAN_EXCLUDED_SUFFIXES = [
  // Env templates — placeholders are expected
  ".env.example",
  ".env.sample",
  ".env.template",
  ".env.dist",
  // Documentation — connection strings are shown as examples
  ".md",
  ".mdx",
  ".txt",
  ".rst",
  // Test files — test DB URLs and fixture secrets are not real
  ".test.js",
  ".test.ts",
  ".test.jsx",
  ".test.tsx",
  ".spec.js",
  ".spec.ts",
  ".spec.jsx",
  ".spec.tsx",
];

// Top-level directory prefixes that are documentation and should not be
// content-scanned for secrets.
const CONTENT_SCAN_EXCLUDED_DIR_PREFIXES = [
  "docs/",
  ".claude/",
];

// Lines containing this marker are exempt from content scanning.
// Add it as a comment on any line that intentionally contains a pattern.
// Example:  DATABASE_URL=postgresql://user:pass@host/db  # security-scan-ok
const CONTENT_SCAN_LINE_ALLOWLIST_MARKER = "security-scan-ok";

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
  {
    name: "openai api key",
    pattern: /\bsk-(?:proj-|[A-Za-z0-9]{20,}T3BlbkFJ)[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    name: "resend api key",
    pattern: /\bre_[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    // Matches postgresql://user:pass@host/db but skips template placeholders
    // (<...> syntax, keyword "placeholder", and common example words).
    name: "postgresql connection string with credentials",
    pattern: /postgresql:\/\/(?!(?:[^@]*<[^>]*>|[^@]*\bplaceholder\b|[^@]*\bexample\b|[^@]*\byour[-_]?(?:pass|password|user|db)\b))[^:@\s]+:[^@\s]{8,}@[^/\s]+\/\S+/gi,
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
  let output;
  try {
    // `rg --files` honours repository ignore files without invoking Git. This
    // keeps the security check usable in restricted build environments and in
    // workflows that explicitly prohibit Git commands.
    output = execFileSync(
      "rg",
      ["--files", "--hidden", "--null", "--glob", "!.git/**"],
      { cwd: rootDir, encoding: "utf8" }
    );
  } catch (error) {
    if (error?.status === 1 && !error?.stdout) return [];
    throw new Error(
      "Security scan requires ripgrep (rg) to enumerate non-ignored workspace files without Git.",
      { cause: error }
    );
  }

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

function shouldSkipContentScan(filePath) {
  const lower = filePath.toLowerCase();
  if (CONTENT_SCAN_EXCLUDED_DIR_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    return true;
  }
  if (CONTENT_SCAN_EXCLUDED_SUFFIXES.some((suffix) => lower.endsWith(suffix))) {
    return true;
  }
  // Also skip files whose basename matches the allowed env-template suffixes,
  // regardless of where in the tree they live (e.g. apps/dev-erp/.env.example).
  const baseName = path.basename(lower);
  if (baseName.startsWith(".env") && ALLOWED_ENV_FILE_SUFFIXES.some((s) => baseName.endsWith(s))) {
    return true;
  }
  return false;
}

function findSensitiveContent(files) {
  const findings = [];

  for (const filePath of files) {
    if (shouldSkipContentScan(filePath)) {
      continue;
    }

    const absolutePath = path.join(rootDir, filePath);
    if (!isScannableFile(absolutePath)) {
      continue;
    }

    const buffer = readFileSync(absolutePath);

    if (isBinaryContent(buffer)) {
      continue;
    }

    const content = buffer.toString("utf8");
    // Strip lines that carry the per-line allowlist marker before scanning.
    const scannable = content
      .split("\n")
      .filter((line) => !line.includes(CONTENT_SCAN_LINE_ALLOWLIST_MARKER))
      .join("\n");

    for (const signature of CONTENT_SIGNATURES) {
      signature.pattern.lastIndex = 0;
      if (signature.pattern.test(scannable)) {
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

console.log(`Security scan passed. Checked ${trackedFiles.length} non-ignored workspace files.`);
