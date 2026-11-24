import { inlineRuns, richTextBlocks } from "../../../travel-with-ease-api/src/content/rich-text.js";

export function RichInline({ value }) {
  return inlineRuns(value).map((run, index) => run.type === "bold" ? <strong key={index}>{run.text}</strong> :
    run.type === "italic" ? <em key={index}>{run.text}</em> : run.text);
}

export default function RichText({ value, className = "" }) {
  return <div className={`twe-rich-text ${className}`.trim()}>
    {richTextBlocks(value).map((block, index) => {
      if (block.type === "paragraph") return <p key={index}><RichInline value={block.text}/></p>;
      const List = block.type === "ordered" ? "ol" : "ul";
      return <List key={index} start={block.start}>{block.items.map((item, i) => <li key={i}><RichInline value={item}/></li>)}</List>;
    })}
  </div>;
}
