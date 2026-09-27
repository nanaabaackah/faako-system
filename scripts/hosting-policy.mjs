// Explicit, source-controlled deployment deferrals. Do not infer these from a
// missing _redirects file or optional monitoring: deployed apps must fail closed.
// Remove TTNGH's entry when its Cloudflare project is configured and reviewed.
const cloudflareDeferrals = [
  {
    packageName: "@faako/ttngh",
    dir: "apps/ttngh",
    reason: "Cloudflare is not configured yet; see docs/apps/ttngh/deployment.md",
  },
];

export function getCloudflareDeferral({ name, dir }) {
  return cloudflareDeferrals.find((entry) => entry.packageName === name && entry.dir === dir)?.reason ?? null;
}
