import { useRef, useState } from "react";
import { Button, TextareaField } from "@faako/ui";
import { formatSelection } from "../../../travel-with-ease-api/src/content/rich-text.js";
import RichText from "../../../travel-with-ease-web/src/components/RichText.jsx";
import "../styles/rich-text.css";

const actions = [
  ["bold", "Bold", <strong>B</strong>],
  ["italic", "Italic", <em>I</em>],
  ["unordered", "Bulleted list", <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/><path d="M9 6h12M9 12h12M9 18h12"/></svg>],
  ["ordered", "Numbered list", <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 4h2v5M3 9h4M3 14c0-2 4-2 4 0 0 1-4 4-4 5h4M10 6h11M10 16h11"/></svg>],
];

export default function RichTextField({ value = "", onChange, disabled, maxLength, ...props }) {
  const input = useRef(null);
  const [preview, setPreview] = useState(false);
  const apply = action => {
    const node = input.current;
    if (!node || node.matches(":disabled")) return;
    const result = formatSelection(value, node.selectionStart, node.selectionEnd, action);
    if (maxLength && result.value.length > maxLength) return;
    onChange?.({ target: { value: result.value }, currentTarget: { value: result.value } });
    node.focus();
    requestAnimationFrame(() => node.setSelectionRange(result.start, result.end));
  };
  return <div className="twe-rich-field">
    <TextareaField {...props} value={value} onChange={onChange} ref={input} disabled={disabled} maxLength={maxLength}
      rows={props.rows || 5} onKeyDown={event => {
        if ((event.ctrlKey || event.metaKey) && ["b", "i"].includes(event.key.toLowerCase())) {
          event.preventDefault();
          apply(event.key.toLowerCase() === "b" ? "bold" : "italic");
        }
      }} />
    <div className="twe-rich-toolbar" role="group" aria-label={`${props.label || "Text"} formatting`}>
      {actions.map(([key, label, icon]) => <Button key={key} type="button" variant="ghost" disabled={disabled}
        aria-label={label} title={label} onMouseDown={event => event.preventDefault()} onClick={() => apply(key)}>{icon}</Button>)}
      <Button type="button" variant="ghost" aria-pressed={preview} onClick={() => setPreview(value => !value)}>{preview ? "Hide preview" : "Preview"}</Button>
    </div>
    {preview && <div className="twe-rich-preview" aria-label={`${props.label || "Text"} formatted preview`}><RichText value={value}/></div>}
  </div>;
}
