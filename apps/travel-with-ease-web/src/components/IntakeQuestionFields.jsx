import { TextField, TextareaField, SelectField, DateField } from "@faako/ui";
import { INTAKE_CORE_FIELDS } from "../../../travel-with-ease-api/src/enquiries/intake-definition.js";
import "../styles/components/enquiry-form.css";

export default function IntakeQuestionFields({ definition, entryType, form, setForm, update, additionalAnswers, setAnswer, viewport = "auto" }) {
  function coreControl(field) {
    const { id, label, placeholder, options } = field;
    const original = INTAKE_CORE_FIELDS.find(item => item.id === id);
    if (id === "budget" && entryType === "package") return null;
    if (options) return <SelectField key={id} name={id} label={label} value={form[id]} onChangeValue={value => setForm(current => ({ ...current, [id]: value }))} required>
      {options.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
    </SelectField>;
    const constraints = { destination: { minLength: 2, maxLength: 120 }, travelTimeframe: { minLength: 2, maxLength: 160 }, travellers: { min: "1", max: "100", step: "1" }, budget: { maxLength: 160 }, name: { minLength: 2, maxLength: 160, autoComplete: "name" }, email: { maxLength: 254, autoComplete: "email" }, phone: { maxLength: 40, autoComplete: "tel" } }[id] || {};
    return <TextField key={id} name={id} label={label} type={original.type} value={form[id]} onChange={update} required={original.required} placeholder={placeholder} {...constraints}/>;
  }
  function additionalControl(field) {
    const value = additionalAnswers[field.id] ?? (field.type === "multiselect" ? [] : "");
    const props = { label: field.label, name: field.id, value, required: field.required };
    return <div className="question-field" key={field.id}>
      {field.type === "multiselect" ? <fieldset><legend>{field.label}{field.required ? " (required)" : ""}</legend><div className="question-options">
        {field.options.map(option => <label key={option.value}><input type="checkbox" checked={value.includes(option.value)} onChange={event => setAnswer(field.id, event.target.checked ? [...value, option.value] : value.filter(item => item !== option.value))}/>{option.label}</label>)}
      </div></fieldset> : field.type === "select" ? <SelectField {...props} onChangeValue={next => setAnswer(field.id, next)}>
        <option value="">Choose an option</option>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </SelectField> : field.type === "textarea" ? <TextareaField {...props} maxLength={1500} onChange={event => setAnswer(field.id, event.target.value)}/> : field.type === "date" ? <DateField {...props} onChangeValue={next => setAnswer(field.id, next)}/> :
      <TextField {...props} type={field.type} {...(field.type === "number" ? { min: -1000000000, max: 1000000000, step: "0.0001" } : field.type === "text" ? { maxLength: 240 } : {})} onChange={event => setAnswer(field.id, event.target.value)}/>}
      {field.description && <p className="question-hint">{field.description}</p>}
    </div>;
  }
  const coreRows = [];
  // Preserve the established two-column arrangement when the original paired
  // questions remain adjacent, without overriding CMS field order.
  const paired = { enquiryType: "service", travelTimeframe: "travellers", email: "phone" };
  for (let index = 0; index < definition.core.length; index++) {
    const field = definition.core[index];
    const next = definition.core[index + 1];
    if (next && paired[field.id] === next.id) {
      coreRows.push(<div key={field.id} className="enquiry-fields-pair">{coreControl(field)}{coreControl(next)}</div>);
      index++;
    } else coreRows.push(coreControl(field));
  }

  return <div className={viewport === "mobile" ? "intake-question-fields intake-question-fields--mobile" : "intake-question-fields"}>
    {coreRows}
    {definition.additional.filter(field => field.entries.includes(entryType)).map(additionalControl)}
  </div>;
}
