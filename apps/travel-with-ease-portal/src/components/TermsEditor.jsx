import { TextField } from "@faako/ui";
import Button from "./ActionButton.jsx";
import RichTextField from "./RichTextField.jsx";

// Match the public terms page's existing Section A / Section B order.
// Old revisions have no section key; their original four-entry split is retained.
export const sectionFor = (entry, index) => entry.section || (index < 4 ? "A" : "B");
export const assignSections = entries => entries.map((entry, index) =>
  ({ ...entry, section: sectionFor(entry, index) }));

const groups = [
  { id: "A", label: "Section A · Planning services", add: "Add planning term" },
  { id: "B", label: "Section B · Package bookings", add: "Add package term" },
];

export default function TermsEditor({ entries = [], onChange }) {
  const normalized = assignSections(entries);
  const update = (index, changes) => onChange(normalized.map((entry, i) =>
    i === index ? { ...entry, ...changes } : entry));
  const remove = (index) => onChange(normalized.filter((_, i) => i !== index));
  const add = (section) => {
    const next = [...normalized];
    const firstB = next.findIndex(entry => entry.section === "B");
    const insertAt = section === "A" && firstB >= 0 ? firstB : next.length;
    next.splice(insertAt,
      0, { heading: "", text: "", attribution: "", section });
    onChange(next);
  };
  return (
    <section className="cms-editor-groups" aria-label="Booking and planning terms">
      {groups.map(group => {
        const members = normalized.map((entry, index) => ({ entry, index }))
          .filter(({ entry }) => entry.section === group.id);
        return <fieldset className="cms-editor-group" key={group.id}>
          <legend>{group.label}</legend>
          {members.map(({ entry, index }, position) => (
            <fieldset key={entry.id || `${group.id}-${index}`}>
              <legend>Term {position + 1}</legend>
              <TextField label="Term heading" required maxLength={160} value={entry.heading || ""}
                onChange={event => update(index, { heading: event.target.value })} />
              <RichTextField label="Term details" required maxLength={2000} value={entry.text || ""}
                onChange={event => update(index, { text: event.target.value })} />
              <TextField label="Attribution (optional)" maxLength={160} value={entry.attribution || ""}
                onChange={event => update(index, { attribution: event.target.value })} />
              <Button type="button" icon="close" disabled={members.length <= 1}
                onClick={() => remove(index)}>Remove term {position + 1}</Button>
            </fieldset>
          ))}
          <Button type="button" icon="plus" disabled={entries.length >= 30}
            onClick={() => add(group.id)}>{group.add}</Button>
        </fieldset>;
      })}
    </section>
  );
}
