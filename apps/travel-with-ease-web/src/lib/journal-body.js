// Presentation-only parser for client-authored plain-text Journal entries.
// Preserves every entry-rule sentence and supplied date verbatim; it only
// converts existing numbered/bulleted paragraphs to semantic lists.
export function journalBodyBlocks(body = "") {
  /** @type {Array<
   *  {type: "ordered" | "unordered", items: string[]} |
   *  {type: "heading" | "paragraph" | "disclaimer", text: string}
   * >} */
  const blocks = [];
  for (const raw of String(body).split(/\n\s*\n/)) {
    const text = raw.trim();
    if (!text) continue;
    const lines = text.split("\n").map(line => line.trim()).filter(Boolean);
    if (lines.every(line => /^-\s+/.test(line))) {
      blocks.push({ type: "unordered", items: lines.map(line => line.replace(/^-\s+/, "")) });
      continue;
    }
    if (lines.length === 1 && /^\d+\.\s+/.test(lines[0])) {
      const item = lines[0].replace(/^\d+\.\s+/, "");
      const last = blocks.at(-1);
      if (last?.type === "ordered") last.items.push(item);
      else blocks.push({ type: "ordered", items: [item] });
      continue;
    }
    if (["Why it happens", "If you're turned away at the desk"].includes(text)) {
      blocks.push({ type: "heading", text });
      continue;
    }
    if (text.startsWith("Entry rules change.")) {
      blocks.push({ type: "disclaimer", text: lines.join(" ") });
      continue;
    }
    blocks.push({ type: "paragraph", text: lines.join(" ") });
  }
  return blocks;
}
