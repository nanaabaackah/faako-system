import packageManifest from "../../package.json" with { type: "json" };

// Generated from the actual website checkout, independently of CMS revisions.
export const prerender = true;
export function GET() {
  return new Response(JSON.stringify({ version: packageManifest.version }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
