import { createHash, randomUUID } from "node:crypto";
import { contentForPage } from "./schema.js";

const stableId = (value) => {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ["8", "9", "a", "b"][Number.parseInt(hex[16], 16) % 4];
  return `${hex.slice(0,8).join("")}-${hex.slice(8,12).join("")}-${hex.slice(12,16).join("")}-${hex.slice(16,20).join("")}-${hex.slice(20).join("")}`;
};
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === "object"
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const canonical = (value) => JSON.stringify(stable(value));

export function prepareCodeAuthoredContent(page, body) {
  const prepared = structuredClone(body);
  prepared.entries = (prepared.entries || []).map((entry, index) => ({
    ...entry,
    id: entry.id || stableId(`${page}:entry:${index}:${entry.heading}`),
  }));
  return contentForPage(page, prepared);
}

export async function importCodeAuthoredDraft({ repository, page, body, expectedVersion, actor, dryRun = true, requestId = randomUUID() }) {
  const prepared = prepareCodeAuthoredContent(page, body);
  const current = await repository.get(page);
  const actualVersion = current?.version || 0;
  if (actualVersion !== expectedVersion) return { status: "conflict", expectedVersion, actualVersion };
  if (current && canonical(current.body) === canonical(prepared)) return { status: "unchanged", version: actualVersion };
  if (dryRun) return { status: current ? "would_update" : "would_create", expectedVersion, actualVersion };
  const saved = await repository.save(page, prepared, expectedVersion, actor, requestId);
  return { status: "saved_draft", version: saved.version, revisionId: saved.revisionId };
}
