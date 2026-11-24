import test from "node:test";
import assert from "node:assert/strict";
import { formatSelection, inlineRuns, richTextBlocks, plainRichText } from "../src/content/rich-text.js";

test("bold, italic, lists and paragraph formatting remain plain data", () => {
  assert.deepEqual(inlineRuns("A **bold** and *italic* sentence."), [
    {type:"text",text:"A "},{type:"bold",text:"bold"},{type:"text",text:" and "},{type:"italic",text:"italic"},{type:"text",text:" sentence."}
  ]);
  const content = "Intro\n- **First**\n- Second\n\n1. Third\n2. Fourth";
  assert.deepEqual(richTextBlocks(content), [
    {type:"paragraph",text:"Intro"},{type:"unordered",items:["**First**","Second"]},{type:"ordered",start:1,items:["Third","Fourth"]}
  ]);
  assert.equal(plainRichText(content), "Intro First Second Third Fourth");
  assert.deepEqual(richTextBlocks("Existing copy\nwithout styling."), [{type:"paragraph",text:"Existing copy\nwithout styling."}]);
});
test("toolbar preserves selections and supports undoing formatting", () => {
  const bold = formatSelection("Travel safely",0,6,"bold");
  assert.deepEqual(bold, {value:"**Travel** safely",start:2,end:8});
  assert.deepEqual(formatSelection(bold.value,bold.start,bold.end,"bold"),{value:"Travel safely",start:0,end:6});
  const list = formatSelection("Pack\nFly",0,8,"ordered");
  assert.equal(list.value,"1. Pack\n2. Fly");
  assert.equal(formatSelection(list.value,0,list.value.length,"unordered").value,"- Pack\n- Fly");
});
test("HTML and script-like strings are never interpreted as markup", () => {
  const malicious = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
  assert.deepEqual(inlineRuns(malicious),[{type:"text",text:malicious}]);
  assert.equal(plainRichText(malicious),malicious);
});
