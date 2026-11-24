import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Button, TextareaField } from "@faako/ui";
import { formatSelection } from "../../../travel-with-ease-api/src/content/rich-text.js";
import RichText from "../../../travel-with-ease-web/src/components/RichText.jsx";
import "../styles/rich-text.css";

const actions = [
  ["bold", "Bold", <strong>B</strong>],
  ["italic", "Italic", <em>I</em>],
  ["unordered", "Bulleted list", "Bullets"],
  ["ordered", "Numbered list", "Numbering"],
];

export default function RichTextField({ value = "", onChange, disabled, maxLength, ...props }) {
  const input = useRef(null);
  const [preview, setPreview] = useState(false);
  const apply = action => {
    const node = input.current;
    if (!node || node.matches(":disabled")) return;
    const result = formatSelection(node.value, node.selectionStart, node.selectionEnd, action);
    if (maxLength && result.value.length > maxLength) return;
    // Commit the controlled value and restore selection in the same event.
    // A deferred animation-frame callback can overwrite a later user selection.
    flushSync(() => onChange?.({ target: { value: result.value }, currentTarget: { value: result.value } }));
    const current = input.current;
    if (!current) return;
    current.focus({ preventScroll: true });
    current.setSelectionRange(result.start, result.end);
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
