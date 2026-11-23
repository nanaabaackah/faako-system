import { TextField, TextareaField } from "@faako/ui";
import { editorialFields, editorialValues, approvedTravellerReviews } from "../../../travel-with-ease-api/src/content/editorial-fields.js";
import Button from "./ActionButton.jsx";

export default function EditorialFields({ page, body, change }) {
  const fields = editorialFields[page] || [];
  const values = editorialValues(page, body.editorialCopy);
  const reviews = body.reviews ?? approvedTravellerReviews;
  const updateReview = (index, key, value) => change("reviews", reviews.map((review, i) => i === index ? { ...review, [key]: value } : review));
  return <>
    {fields.length > 0 && <fieldset><legend>{page === "site-appearance" ? "Navigation labels" : page === "footer" ? "Footer content, headings and legal information" : "Section headings and links"}</legend>
      {fields.map(([key, label, fallback]) => {
        const Field = fallback.length > 120 || key.endsWith("Body") || key === "companyDetails" ? TextareaField : TextField;
        return <Field key={key} label={label} maxLength={2000} required value={body.editorialCopy?.[key] ?? values[key]} onChange={event => change("editorialCopy", { ...body.editorialCopy, [key]: event.target.value })} />;
      })}
    </fieldset>}
    {page === "home" && <section aria-label="Traveller reviews"><h3>Traveller reviews</h3>
      {reviews.map((review, index) => <fieldset key={index}><legend>Review {index + 1}</legend>
        <TextareaField label="Review preview" required maxLength={3000} value={review.preview} onChange={event => updateReview(index, "preview", event.target.value)} />
        <TextareaField label="Full review continuation" maxLength={6000} value={review.more} onChange={event => updateReview(index, "more", event.target.value)} />
        <Button type="button" onClick={() => change("reviews", reviews.filter((_, i) => i !== index))}>Remove review {index + 1}</Button>
      </fieldset>)}
      <Button type="button" disabled={reviews.length >= 30} onClick={() => change("reviews", [...reviews, { preview: "", more: "" }])}>Add review</Button>
    </section>}
  </>;
}
