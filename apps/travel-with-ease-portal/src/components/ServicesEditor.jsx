import { TextField, TextareaField } from "@faako/ui";
import Button from "./ActionButton.jsx";
import RichTextField from "./RichTextField.jsx";

const splitHeading = (heading = "") => {
  const [title, ...feeParts] = heading.split(" · ");
  return { title, fee: feeParts.join(" · ") };
};
const joinHeading = (title, fee) => fee?.trim() ? `${title} · ${fee}` : title;

export default function ServicesEditor({ entries = [], onChange }) {
  const edit = (index, key, value) =>
    onChange(entries.map((entry, i) => i === index ? { ...entry, [key]: value } : entry));
  const editHeading = (index, key, value) => {
    const parts = splitHeading(entries[index].heading);
    onChange(entries.map((entry, i) => i === index
      ? { ...entry, heading: joinHeading(key === "title" ? value : parts.title, key === "fee" ? value : parts.fee) }
      : entry));
  };

  return (
    <section className="cms-editor-groups" aria-label="Services listing and detail editors">
      <fieldset className="cms-editor-group">
        <legend>Service listing cards</legend>
        {entries.map((entry, index) => {
          const { title, fee } = splitHeading(entry.heading);
          return <fieldset key={entry.id || entry.serviceSlug || index}>
            <legend>Card {index + 1}{title ? ` · ${title}` : ""}</legend>
            <TextField label="Service name" required maxLength={160}
              value={title} onChange={event => editHeading(index, "title", event.target.value)} />
            <TextField label="Displayed fee" maxLength={90}
              value={fee} onChange={event => editHeading(index, "fee", event.target.value)} />
            <TextareaField label="Card summary" maxLength={240}
              value={entry.cardSummary ?? ""}
              placeholder="Leave blank to use the detail description"
              onChange={event => edit(index, "cardSummary", event.target.value)} />
            <Button type="button" icon="close" onClick={() => onChange(entries.filter((_, i) => i !== index))}>
              Remove service {index + 1}
            </Button>
          </fieldset>;
        })}
        <Button type="button" icon="plus" disabled={entries.length >= 30}
          onClick={() => onChange([...entries, { heading: "", text: "", attribution: "", cardSummary: "" }])}>
          Add service
        </Button>
      </fieldset>
      <fieldset className="cms-editor-group">
        <legend>Individual service detail pages</legend>
        {entries.map((entry, index) => {
          const { title } = splitHeading(entry.heading);
          return <fieldset key={entry.id || entry.serviceSlug || index}>
            <legend>{title || `Service ${index + 1}`}</legend>
            <RichTextField label="Full service description" required maxLength={2000}
              value={entry.text || ""}
              onChange={event => edit(index, "text", event.target.value)} />
            <TextField label="Attribution (optional)" maxLength={160}
              value={entry.attribution || ""}
              onChange={event => edit(index, "attribution", event.target.value)} />
          </fieldset>;
        })}
      </fieldset>
    </section>
  );
}
