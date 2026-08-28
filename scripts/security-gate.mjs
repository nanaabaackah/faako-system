import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  BASE_SECURITY_HEADERS,
  SECURITY_PROFILE_MATRIX,
  isSensitivePublicEnvKey,
  validateAppSystemConfig,
} from "../packages/security/src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const appsDir = path.join(rootDir, "apps");
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".toml"]);
const SKIP_SEGMENTS = new Set(["node_modules", "dist", "build", ".turbo", "coverage", "generated"]);

const walkFiles = (directory) => {
  if (!fs.existsSync(directory)) return [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  entries.forEach((entry) => {
    if (SKIP_SEGMENTS.has(entry.name)) return;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(absolutePath));
      return;
    }
    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(absolutePath);
    }
  });

  return files;
};

const readIfExists = (filePath) => {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
};

const hasHeadersBaseline = (appDir, profileId) => {
  const candidates = [
    path.join(appDir, "public", "_headers"),
    path.join(appDir, "backend", "security", "securityHeaders.js"),
    path.join(appDir, "src", "security", "securityHeaders.js"),
    path.join(appDir, "backend", "functions", "_shared", "http.js"),
  ];

  const combined = candidates
    .filter((filePath) => fs.existsSync(filePath))
    .map((filePath) => readIfExists(filePath).toLowerCase())
    .join("\n");

  if (!combined) return false;

  const hasBaseHeaders = Object.keys(BASE_SECURITY_HEADERS).every((headerName) =>
    combined.includes(headerName.toLowerCase()),
  );
  const hasCsp = combined.includes("content-security-policy");

  return hasBaseHeaders && hasCsp;
};

const scanCookieAppsForTokenStorage = (appDir) => {
  const sourceFiles = walkFiles(path.join(appDir, "src"));
  const findings = [];
  const tokenStoragePattern =
    /(localStorage|sessionStorage)\.(getItem|setItem)\((["'`])(?:token|auth_token|reebs_auth_token)\3/;

  sourceFiles.forEach((filePath) => {
    const content = readIfExists(filePath);
    if (tokenStoragePattern.test(content)) {
      findings.push(path.relative(rootDir, filePath));
    }
  });

  return findings;
};

const scanForWildcardCredentialedCors = (appDir) => {
  const sourceFiles = walkFiles(appDir);
  const findings = [];
  const originWildcardPattern = /access-control-allow-origin["':=\s]+\*/i;
  const credentialsPattern = /access-control-allow-credentials["':=\s]+true/i;

  sourceFiles.forEach((filePath) => {
    const content = readIfExists(filePath);
    if (originWildcardPattern.test(content) && credentialsPattern.test(content)) {
      findings.push(path.relative(rootDir, filePath));
    }
  });

  return findings;
};

const scanEnvExamples = (appDir) => {
  const findings = [];
  const envFiles = [".env.example", ".env.sample", ".env.template"]
    .map((name) => path.join(appDir, name))
    .filter((filePath) => fs.existsSync(filePath));

  envFiles.forEach((filePath) => {
    readIfExists(filePath)
      .split(/\r?\n/g)
      .forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return;
        const [rawKey] = trimmed.split("=");
        if (isSensitivePublicEnvKey(rawKey.trim())) {
          findings.push(`${path.relative(rootDir, filePath)} -> ${rawKey.trim()}`);
        }
      });
  });

  return findings;
};

const isTestSourceFile = (filePath) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(filePath);

const scanSourceForSensitivePublicEnv = (appDir) => {
  const sourceFiles = walkFiles(path.join(appDir, "src"));
  const findings = [];
  const viteEnvPattern = /\bVITE_[A-Z0-9_]+\b/g;

  sourceFiles.forEach((filePath) => {
    if (isTestSourceFile(filePath)) return;

    const content = readIfExists(filePath);
    const matches = content.match(viteEnvPattern) || [];
    const sensitiveKeys = [...new Set(matches.filter((key) => isSensitivePublicEnvKey(key)))];

    sensitiveKeys.forEach((key) => {
      findings.push(`${path.relative(rootDir, filePath)} -> ${key}`);
    });
  });

  return findings;
};

const scanSourceForBrowserVisibleAccessCodes = (appDir) => {
  const sourceFiles = walkFiles(path.join(appDir, "src"));
  const findings = [];
  const browserCodeLeakPattern = /\b(previewCode|createPreviewCode|resolveLocalDemoAccess|browser-visible access code)\b/i;

  sourceFiles.forEach((filePath) => {
    if (isTestSourceFile(filePath)) return;

    const content = readIfExists(filePath);
    if (browserCodeLeakPattern.test(content)) {
      findings.push(path.relative(rootDir, filePath));
    }
  });

  return findings;
};

const getAppDirectories = () =>
  fs.readdirSync(appsDir, { withFileTypes: true })
    .filter((entry) =>
      entry.isDirectory()
      && fs.existsSync(path.join(appsDir, entry.name, "package.json")),
    )
    .map((entry) => path.join(appsDir, entry.name));

const findings = [];

for (const appDir of getAppDirectories()) {
  const appSystemPath = path.join(appDir, "appSystem.js");
  const packageJsonPath = path.join(appDir, "package.json");
  const packageJson = fs.existsSync(packageJsonPath)
    ? JSON.parse(readIfExists(packageJsonPath))
    : { name: path.basename(appDir) };
  const appLabel = packageJson.name || path.basename(appDir);

  if (!fs.existsSync(appSystemPath)) {
    findings.push(`[config] ${appLabel}: missing ${path.relative(rootDir, appSystemPath)}`);
    continue;
  }

  const imported = await import(pathToFileURL(appSystemPath).href);
  const appSystem = imported.default;
  const validation = validateAppSystemConfig(appSystem);

  if (!validation.valid) {
    validation.errors.forEach((message) => {
      findings.push(`[config] ${appLabel}: ${message}`);
    });
    continue;
  }

  const profileId = appSystem.security.profileId;
  const authMode = appSystem.security.authMode;
  const matrix = SECURITY_PROFILE_MATRIX[profileId];

  if (matrix?.requiresHeaders && !hasHeadersBaseline(appDir, profileId)) {
    findings.push(`[headers] ${appLabel}: required security headers/CSP baseline not found in app config files`);
  }

  if (authMode === "cookie") {
    const tokenStorageFindings = scanCookieAppsForTokenStorage(appDir);
    tokenStorageFindings.forEach((filePath) => {
      findings.push(`[auth-storage] ${appLabel}: cookie app reads or writes browser token storage in ${filePath}`);
    });
  }

  scanForWildcardCredentialedCors(appDir).forEach((filePath) => {
    findings.push(`[cors] ${appLabel}: wildcard origin used with credentialed CORS in ${filePath}`);
  });

  scanEnvExamples(appDir).forEach((entry) => {
    findings.push(`[env] ${appLabel}: suspicious client-visible env key ${entry}`);
  });

  scanSourceForSensitivePublicEnv(appDir).forEach((entry) => {
    findings.push(`[env-source] ${appLabel}: sensitive client-visible env key ${entry}`);
  });

  scanSourceForBrowserVisibleAccessCodes(appDir).forEach((filePath) => {
    findings.push(`[demo-access] ${appLabel}: browser-visible access-code logic found in ${filePath}`);
  });
}

if (findings.length > 0) {
  console.error("Security gate failed:");
  findings.forEach((finding) => {
    console.error(`- ${finding}`);
  });
  process.exit(1);
}

console.log("Security gate passed. App configs, header baselines, env exposure, auth storage, and CORS checks look good.");
