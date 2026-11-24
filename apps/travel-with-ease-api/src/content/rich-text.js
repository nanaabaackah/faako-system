// A deliberately small, text-only formatting dialect. No HTML, links or scripts
// are interpreted. Existing content remains a string in revisions and manifests.
export function inlineRuns(value = "") {
  const text = String(value ?? "");
  const runs = [];
  const pattern = /\*\*([^*\n]+)\*\*|(?<!\*)\*([^*\n]+)\*(?!\*)/g;
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > end) runs.push({ type: "text", text: text.slice(end, match.index) });
    runs.push({ type: match[1] !== undefined ? "bold" : "italic", text: match[1] ?? match[2] });
    end = match.index + match[0].length;
  }
  if (end < text.length) runs.push({ type: "text", text: text.slice(end) });
  return runs;
}

/** @returns {Array<{type:"paragraph", text:string}|{type:"ordered", items:string[], start:number}|{type:"unordered", items:string[]}>} */
export function richTextBlocks(value = "") {
  /** @type {Array<{type:"paragraph", text:string}|{type:"ordered", items:string[], start:number}|{type:"unordered", items:string[]}>} */
  const blocks = [];
  const lines = String(value ?? "").replace(/\r\n?/g, "\n").split("\n");
  let paragraph = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
  };
  for (const line of lines) {
    const match = line.match(/^\s*(?:(\d+)\.|([-•]))\s+(.+)$/);
    if (match) {
      flush();
      const type = match[1] ? "ordered" : "unordered";
      const last = blocks.at(-1);
      if (last?.type === type) last.items.push(match[3]);
      else if (type === "ordered") blocks.push({ type, items: [match[3]], start: Number(match[1]) });
      else blocks.push({ type, items: [match[3]] });
    } else if (!line.trim()) flush();
    else paragraph.push(line);
  }
  flush();
  return blocks;
}

export function plainRichText(value = "") {
  return richTextBlocks(value).map(block => (block.type === "paragraph" ? [block.text] : block.items)
    .map(text => inlineRuns(text).map(run => run.text).join("")).join(" ")).join(" ");
}

// Keep selection changes pure and testable; the editor owns the input and save.
export function formatSelection(value, start, end, action) {
  const text = String(value ?? "");
  if (action === "bold" || action === "italic") {
    const marker = action === "bold" ? "**" : "*";
    const selected = text.slice(start, end);
    // Avoid malformed nested emphasis in this intentionally limited dialect.
    if (selected.includes("\n")) return { value: text, start, end };
    if (start >= marker.length && text.slice(start - marker.length, start) === marker && text.slice(end, end + marker.length) === marker && (action === "bold" || (text[start - 2] !== "*" && text[end + 1] !== "*"))) {
      return { value: text.slice(0, start - marker.length) + selected + text.slice(end + marker.length), start: start - marker.length, end: end - marker.length };
    }
    if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length > marker.length * 2) {
      const stripped = selected.slice(marker.length, -marker.length);
      return { value: text.slice(0, start) + stripped + text.slice(end), start, end: start + stripped.length };
    }
    if (selected.includes("*")) return { value: text, start, end };
    return { value: text.slice(0, start) + marker + selected + marker + text.slice(end),
      start: start + marker.length, end: end + marker.length };
  }
  if (action !== "ordered" && action !== "unordered") return { value: text, start, end };
  const first = start === 0 ? 0 : text.lastIndexOf("\n", start - 1) + 1;
  const next = text.indexOf("\n", Math.max(start, end - (end > start && text[end - 1] === "\n" ? 1 : 0)));
  const last = next === -1 ? text.length : next;
  const selection = text.slice(first, last);
  const lines = selection.split("\n");
  const prefix = action === "ordered" ? /^\s*\d+\.\s+/ : /^\s*[-•]\s+/;
  const remove = lines.every(line => prefix.test(line));
  const formatted = lines.map((line, i) => {
    const clean = line.replace(/^\s*(?:\d+\.|[-•])\s+/, "");
    return remove ? clean : (action === "ordered" ? (i + 1) + ". " : "- ") + clean;
  }).join("\n");
  return { value: text.slice(0, first) + formatted + text.slice(last), start: first, end: first + formatted.length };
}
