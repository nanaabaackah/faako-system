import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

// Fontsource's open-license WOFF2 distributions, pinned to an inspected
// upstream commit. Git blob IDs verify the exact published bytes, not secrets.
const source = "https://raw.githubusercontent.com/fontsource/font-files/5a72889057f592bb0659629e38337359f94d53b2/";
const entries = [
  ["fonts/google/poiret-one/files/poiret-one-latin-400-normal.woff2", "poiret-one.woff2", "c9420ef53c9149151d29c6ee53ca350765a3b726", 7824],
  ["fonts/google/poiret-one/files/poiret-one-latin-ext-400-normal.woff2", "poiret-one-latin-ext.woff2", "71619a96c832041f6a995a670f3b52ca6fc0aa81", 5280],
  ["fonts/variable/quicksand/files/quicksand-latin-wght-normal.woff2", "quicksand.woff2", "b29be8d0ef8caac5c9cdf359c600ae4aca081ef6", 28244],
  ["fonts/variable/quicksand/files/quicksand-latin-ext-wght-normal.woff2", "quicksand-latin-ext.woff2", "a57e727c0ee309d2f4d12627d6f26dd488ce450f", 26616],
  ["fonts/variable/inter/files/inter-latin-wght-normal.woff2", "inter.woff2", "d15208de03cd1ad7c5199f0a0ce915fe841e4722", 48256],
  ["fonts/variable/inter/files/inter-latin-ext-wght-normal.woff2", "inter-latin-ext.woff2", "479d010d2902fa3a5b48e84a973db1978b2e9949", 85068],
  ["fonts/google/poiret-one/LICENSE", "poiret-one-OFL.txt", "8aaa7f06c9a3740ddb2c9a4e9b29645b4f883d87", 4388],
  ["fonts/variable/quicksand/LICENSE", "quicksand-OFL.txt", "fcc0a1ae8a4a90bdfcc7c9b7270cabadd638e1f2", 4443],
  ["fonts/variable/inter/LICENSE", "inter-OFL.txt", "40589daa9de8bc96606292ea0be712ff0f0626eb", 4477],
];
const valid = (bytes, hash, size) => bytes.length === size &&
  createHash("sha1").update("blob " + size + "\0").update(bytes).digest("hex") === hash;
export async function preparePortalFonts() {
  const dir = fileURLToPath(new URL("../public/fonts/twe/", import.meta.url));
  await mkdir(dir, { recursive: true });
  await Promise.all(entries.map(async ([path, file, hash, size]) => {
    const target = join(dir, file);
    try { if (valid(await readFile(target), hash, size)) return; } catch (error) { if (error.code !== "ENOENT") throw error; }
    const response = await fetch(source + path, { redirect: "error", signal: AbortSignal.timeout(25000) });
    if (!response.ok || !response.body) throw new Error("Could not fetch pinned portal font: " + file);
    const chunks = [];
    let length = 0;
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > size) throw new Error("Unexpected portal font size: " + file);
      chunks.push(Buffer.from(chunk));
    }
    const bytes = Buffer.concat(chunks);
    if (!valid(bytes, hash, size)) throw new Error("Portal font integrity check failed: " + file);
    const temporary = target + "." + process.pid + ".tmp";
    await writeFile(temporary, bytes);
    await rename(temporary, target);
  }));
}
