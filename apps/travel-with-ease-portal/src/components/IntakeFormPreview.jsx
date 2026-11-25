import { useState } from "react";
import { Button, SelectField, IconsaxIcon } from "@faako/ui";
import IntakeQuestionFields from "../../../travel-with-ease-web/src/components/IntakeQuestionFields.jsx";

const initial = { enquiryType: "trip", service: "not_sure", destination: "", travelTimeframe: "", travellers: "2", budget: "", name: "", email: "", phone: "", consent: false };

export default function IntakeFormPreview({ definition }) {
  const [viewport, setViewport] = useState("desktop");
  const [entryType, setEntryType] = useState("general");
  const [form, setForm] = useState(initial);
  const [additionalAnswers, setAdditionalAnswers] = useState({});
  const update = event => {
    const { name, type, checked, value } = event.target;
    setForm(current => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };
  return <section className="cms-editor-groups" aria-label="Draft form preview">
    <div className="editor-actions">
      <Button type="button" aria-pressed={viewport === "desktop"} onClick={() => setViewport("desktop")}>Desktop</Button>
      <Button type="button" aria-pressed={viewport === "mobile"} onClick={() => setViewport("mobile")}>Mobile</Button>
    </div>
    <SelectField label="Enquiry context" value={entryType} onChangeValue={value => { setEntryType(value); setAdditionalAnswers({}); }}>
      <option value="general">General enquiry</option><option value="service">Service enquiry</option><option value="package">Package enquiry</option>
    </SelectField>
    <div className="public-enquiry-form intake-preview" style={{ width: "100%", maxWidth: viewport === "mobile" ? 390 : 760, marginInline: "auto", minWidth: 0 }}>
      <fieldset>
        <legend>{definition.title}</legend>
        <IntakeQuestionFields definition={definition} entryType={entryType} form={form} setForm={setForm} update={update} additionalAnswers={additionalAnswers} setAnswer={(id,value) => setAdditionalAnswers(current => ({ ...current, [id]: value }))} viewport={viewport}/>
        <p className="enquiry-privacy-note">We only use your details to respond. Privacy notice</p>
        <label className="enquiry-consent"><input name="consent" type="checkbox" checked={form.consent} onChange={update}/><span>I agree that Travel With Ease may use these details to respond to my enquiry.</span></label>
        <Button type="button" disabled>Send enquiry <IconsaxIcon name="ArrowRight4"/></Button>
      </fieldset>
    </div>
  </section>;
}
