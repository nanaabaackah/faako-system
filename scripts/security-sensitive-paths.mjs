import path from "node:path";

// Classify by filename only. The scanner must never open credential exports,
// environment files, private keys or certificates to decide if they are safe.
export function sensitivePathReason(filePath) {
  const parts = filePath.replaceAll("\\", "/").toLowerCase().split("/");
  const name = path.posix.basename(parts.join("/"));
  const template = /\.env\.(?:example|sample|template|dist)$/.test(name);
  if (!template && (name.startsWith(".env") || name.endsWith(".env"))) return "environment file";
  if (/\.(?:pem|key|p12|pfx|jks|keystore|crt|cer)$/.test(name)) return "key or certificate file";
  if (parts.some((part) => /^(?:\.ssh|\.aws|\.kube|secrets?|credentials?|private-keys?)$/.test(part))) {
    return "credential directory";
  }
  // Plaintext/tabular exports are not application source or design tokens.
  if (/\.(?:csv|tsv|json|txt|yaml|yml|toml|ini|conf)$/.test(name)
    && /(?:^|[._-])(?:secrets?|credentials?|passwords?|tokens?)(?:[._-]|$)/.test(name)) {
    return "credential-named data file";
  }
  if (/^(?:id_rsa|id_ed25519|\.netrc|\.npmrc|\.pypirc)$/.test(name)) return "credential-capable local configuration";
  return null;
}
