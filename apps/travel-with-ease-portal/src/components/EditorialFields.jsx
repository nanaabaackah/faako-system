import { TextField, TextareaField } from "@faako/ui";
import { editorialFields, editorialValues, approvedTravellerReviews } from "../../../travel-with-ease-api/src/content/editorial-fields.js";
import Button from "./ActionButton.jsx";
import RichTextField from "./RichTextField.jsx";
import NavigationIcon from "./NavigationIcon.jsx";

export default function EditorialFields({ page, body, change }) {
  const fields = editorialFields[page] || [];
  const values = editorialValues(page, body.editorialCopy);
  const reviews = body.reviews ?? approvedTravellerReviews;
  const grouped = new Map();
  for (const field of fields) {
    const label = field[1];
    const context = label.includes(" · ") ? label.split(" · ")[0] : "Page content";
    if (!grouped.has(context)) grouped.set(context, []);
    grouped.get(context).push(field);
  }
  const updateReview = (index, key, value) => change("reviews", reviews.map((review, i) => i === index ? { ...review, [key]: value } : review));
  return <>
    {fields.length > 0 && <section className="cms-editor-groups" aria-label="Page sections and labels">
      {[...grouped].map(([context, groupFields]) => (
        <details key={context} className="twe-cms-section-disclosure" open>
          <summary><span>{context}</span><NavigationIcon name="arrow"/></summary>
          <fieldset className="cms-editor-group">
          <legend className="twe-visually-hidden">{context}</legend>
          {groupFields.map(([key, label, fallback]) => {
            const Field = key.endsWith("Body") || key === "companyDetails" ? RichTextField : fallback.length > 120 ? TextareaField : TextField;
            return <Field key={key} label={label} maxLength={2000} required
              value={body.editorialCopy?.[key] ?? values[key]}
              onChange={event => change("editorialCopy", { ...body.editorialCopy, [key]: event.target.value })} />;
          })}
          </fieldset>
        </details>
      ))}
    </section>}
    {page === "home" && <section className="cms-editor-groups" aria-label="Traveller reviews">
      <h3>Traveller reviews</h3>
      {reviews.map((review, index) => <fieldset className="cms-editor-group" key={index}>
        <legend>Review {index + 1}</legend>
        <RichTextField label="Card preview" required maxLength={3000} value={review.preview} onChange={event => updateReview(index, "preview", event.target.value)} />
        <RichTextField label="Expanded review" maxLength={6000} value={review.more} onChange={event => updateReview(index, "more", event.target.value)} />
        <Button type="button" icon="close" onClick={() => change("reviews", reviews.filter((_, i) => i !== index))}>Remove review {index + 1}</Button>
      </fieldset>)}
      <Button type="button" icon="plus" disabled={reviews.length >= 30} onClick={() => change("reviews", [...reviews, { preview: "", more: "" }])}>Add review</Button>
    </section>}
  </>;
}
