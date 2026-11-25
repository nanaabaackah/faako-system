import { richTextBlocks } from "../../../travel-with-ease-api/src/content/rich-text.js";

// Presentation-only parser for client-authored plain-text Journal entries.
// Preserves every entry-rule sentence and supplied date verbatim; it only
// converts existing numbered/bulleted paragraphs to semantic lists.
export function journalBodyBlocks(body = "") {
  /** @type {Array<
   *  {type: "ordered", items: string[], start: number} |
   *  {type: "unordered", items: string[]} |
   *  {type: "heading", text: string} |
   *  {type: "paragraph", text: string} |
   *  {type: "disclaimer", text: string}
   * >} */
  const blocks = [];
  for (const raw of String(body).split(/\n\s*\n/)) {
    const text = raw.trim();
    if (!text) continue;
    const lines = text.split("\n").map(line => line.trim()).filter(Boolean);
    if (["Why it happens", "If you're turned away at the desk"].includes(text)) {
      blocks.push({ type: "heading", text });
      continue;
    }
    if (text.startsWith("Entry rules change.")) {
      blocks.push({ type: "disclaimer", text: lines.join(" ") });
      continue;
    }
    for (const block of richTextBlocks(text)) {
      if (block.type === "paragraph") blocks.push({ type: "paragraph", text: block.text.replace(/\n/g, " ") });
      else if (block.type === "ordered") {
        // Preserve the published legacy numbered paragraphs that are separated
        // by blank lines while honouring explicit restarts and non-1 numbering.
        const last = blocks.at(-1);
        if (last?.type === "ordered" && block.start === last.start + last.items.length) last.items.push(...block.items);
        else blocks.push(block);
      }
      else blocks.push({ type: "unordered", items: block.items });
    }
  }
  return blocks;
}
