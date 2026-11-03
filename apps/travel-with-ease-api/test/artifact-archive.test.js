import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { ArtifactArchive } from "../src/content/artifact-archive.js";

test("private artifact archive restores exact bytes and refuses corruption and unsafe manifests", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "twe-archive-test-"));
  const objects = new Map();
  const store = { bucket: "twe-staging-media", client: { send: async command => {
    const input = command.input;
    if (input.Body) { objects.set(input.Key, Buffer.from(input.Body)); return {}; }
    const bytes = objects.get(input.Key);
    return { ContentLength: bytes?.length, Body: { transformToByteArray: async () => bytes } };
  } } };
  const archive = new ArtifactArchive(store, { organisationId: "10000000-0000-4000-8000-000000000001", environment: "staging" });
  const id = "20000000-0000-4000-8000-000000000001";
  try {
    await mkdir(path.join(directory, "source/_astro"), { recursive: true });
    await writeFile(path.join(directory, "source/index.html"), "Exact prior release");
    await writeFile(path.join(directory, "source/_astro/style.css"), "body{color:navy}");
    await archive.retain(id, path.join(directory, "source"));
    await archive.restore(id, path.join(directory, "restored"));
    assert.equal(await readFile(path.join(directory, "restored/index.html"), "utf8"), "Exact prior release");
    assert.ok([...objects.keys()].every(key => key.includes("/staging/")));
    const manifestKey = [...objects.keys()].find(key => key.endsWith("manifest.json"));
    const manifest = JSON.parse(objects.get(manifestKey));
    objects.set(archive.key(id, manifest.files[0].digest), Buffer.from("Corrupted"));
    await assert.rejects(archive.restore(id, path.join(directory, "corrupt")), /integrity mismatch/);
    manifest.files[0].path = "../outside";
    objects.set(manifestKey, Buffer.from(JSON.stringify(manifest)));
    await assert.rejects(archive.restore(id, path.join(directory, "unsafe")), /Invalid archived entry/);
    assert.throws(() => new ArtifactArchive(store, { organisationId: "other", environment: "staging" }));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
