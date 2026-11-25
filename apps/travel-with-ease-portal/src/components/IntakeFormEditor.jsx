import { useEffect, useRef, useState } from "react";
import { AnimatedLoadingState, InlineNotice, TextField, SelectField, ERPConfirmDialog } from "@faako/ui";
import Button from "./ActionButton.jsx";
import HistoryDisclosure from "./HistoryDisclosure.jsx";
import { createDraftAutosave } from "../lib/draft-autosave.js";

const endpoint = "/api/agent/enquiry-forms/intake";
const contexts = ["general", "service", "package"];
const types = [["text", "Short text"], ["textarea", "Long text"], ["select", "Dropdown"], ["multiselect", "Multiple selection"], ["date", "Date"], ["number", "Number"]];
const isChoice = type => ["select", "multiselect"].includes(type);
const identifier = prefix => prefix + crypto.randomUUID().replaceAll("-", "");
const newOption = label => ({ value: identifier("choice_"), label });
const reorder = (items, index, delta) => {
  const result = [...items];
  const next = index + delta;
  if (next < 0 || next >= result.length) return result;
  [result[index], result[next]] = [result[next], result[index]];
  return result;
};

export default function IntakeFormEditor({ api, session, onDirtyChange, onRefreshBlockedChange }) {
  const [record, setRecord] = useState(null);
  const [definition, setDefinition] = useState(null);
  const [saveState, setSaveState] = useState({ status: "saved", dirty: false, error: "" });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState([]);
  const [confirmation, setConfirmation] = useState(null);
  const writer = useRef(null);
  const bodyRef = useRef(null);
  const canPublish = session.user.permissions?.includes("content.publish") === true;
  const blocked = busy || Boolean(confirmation);
  const saving = saveState.status === "saving";
  const headers = { "X-CSRF-Token": session.csrfToken };
  useEffect(() => {
    onRefreshBlockedChange?.(loading || blocked || saving || saveState.dirty);
    return () => onRefreshBlockedChange?.(false);
  }, [loading, blocked, saving, saveState.dirty, onRefreshBlockedChange]);
  useEffect(() => {
    let current = true;
    const read = async () => {
      const result = await api.get(endpoint, { responseMode: "data" });
      return { ...result, body: result.draft, version: result.revision };
    };
    const autosave = createDraftAutosave({
      read,
      save: async (body, expectedRevision) => {
        const result = await api.post(endpoint + "/draft", {
          responseMode: "data", headers: { "X-CSRF-Token": session.csrfToken },
          json: { definition: body, expectedRevision },
        });
        return { ...result, body: result.draft, version: result.revision };
      },
      onState: state => { if (current) { setSaveState(state); onDirtyChange?.(state.dirty); } },
      onSaved: (result, replace) => {
        if (!current) return;
        setRecord(result);
        if (replace) { bodyRef.current = result.draft; setDefinition(result.draft); }
      },
    });
    writer.current = autosave;
    setLoading(true);
    read().then(result => {
      if (!current) return;
      setRecord(result);
      bodyRef.current = result.draft;
      setDefinition(result.draft);
      autosave.reset(result.draft, result.revision);
    }).catch(error => { if (current) setError(error.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; autosave.dispose(); if (writer.current === autosave) writer.current = null; };
  }, [api, session.csrfToken, onDirtyChange]);
  function edit(transform) {
    if (blocked || !bodyRef.current) return;
    const next = transform(bodyRef.current);
    bodyRef.current = next;
    setDefinition(next);
    setNotice("");
    writer.current?.edit(next);
  }
  function fieldEdit(group, id, transform) {
    edit(body => ({ ...body, [group]: body[group].map(field => field.id === id ? transform(field) : field) }));
  }
  async function loadHistory() {
    setBusy(true); setError("");
    try { const result = await api.get(endpoint + "/history", { responseMode: "data" }); setHistory(result.items); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  async function apply(action, version) {
    if (busy || saving || saveState.dirty || (action === "activate" && !canPublish)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api.post(endpoint + "/" + action, {
        responseMode: "data", headers,
        json: { expectedRevision: record.revision, ...(action === "restore" ? { version } : {}) },
      });
      bodyRef.current = result.draft;
      setDefinition(result.draft); setRecord(result);
      writer.current?.reset(result.draft, result.revision);
      setHistory([]);
      setNotice(action === "activate" ? "Form version activated." : "Version restored as a draft.");
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  function orderControls(group, field, index) {
    return <div className="editor-actions">
      <Button type="button" icon="back" disabled={blocked || index === 0} onClick={() => edit(body => ({ ...body, [group]: reorder(body[group], index, -1) }))}>Move up</Button>
      <Button type="button" icon="arrow" disabled={blocked || index === definition[group].length - 1} onClick={() => edit(body => ({ ...body, [group]: reorder(body[group], index, 1) }))}>Move down</Button>
      {group === "additional" && <Button type="button" icon="close" disabled={blocked} onClick={() => edit(body => ({ ...body, additional: body.additional.filter(item => item.id !== field.id) }))}>Remove question</Button>}
    </div>;
  }
  function choices(group, field) {
    if (!field.options) return null;
    const custom = group === "additional";
    return <div className="cms-editor-groups">
      {field.options.map((option, i) => <div key={option.value} className="cms-editor-group">
        <TextField label={"Choice " + (i + 1)} value={option.label} maxLength={160} required disabled={blocked}
          onChange={event => fieldEdit(group, field.id, item => ({ ...item, options: item.options.map(choice => choice.value === option.value ? { ...choice, label: event.target.value } : choice) }))}/>
        <div className="editor-actions">
          <Button type="button" icon="back" disabled={blocked || i === 0} onClick={() => fieldEdit(group, field.id, item => ({ ...item, options: reorder(item.options, i, -1) }))}>Move up</Button>
          <Button type="button" icon="arrow" disabled={blocked || i === field.options.length - 1} onClick={() => fieldEdit(group, field.id, item => ({ ...item, options: reorder(item.options, i, 1) }))}>Move down</Button>
          {custom && <Button type="button" icon="close" disabled={blocked || field.options.length <= 2} onClick={() => fieldEdit(group, field.id, item => ({ ...item, options: item.options.filter(choice => choice.value !== option.value) }))}>Remove choice</Button>}
        </div>
      </div>)}
      {custom && <Button type="button" icon="plus" disabled={blocked || field.options.length >= 20} onClick={() => fieldEdit(group, field.id, item => ({ ...item, options: [...item.options, newOption("New choice")] }))}>Add choice</Button>}
    </div>;
  }
  return <section className="workspace-panel" aria-label="Initial enquiry form">
    {error && <InlineNotice tone="danger" title="Form action unsuccessful" message={error}/>}
    {notice && <p role="status">{notice}</p>}
    {loading ? <AnimatedLoadingState compact title="Loading enquiry form"/> : definition && record && <>
      <p role="status">Active version {record.activeVersion} · {saving ? "Saving draft…" : saveState.dirty ? "Unsaved changes" : "Draft saved"}</p>
      {saveState.error && <InlineNotice tone="danger" title="Draft not saved" message={saveState.error}/>}
      <TextField label="Form heading" value={definition.title} maxLength={160} disabled={blocked} required onChange={event => edit(body => ({ ...body, title: event.target.value }))}/>
      <div className="cms-editor-groups">
        <h2>Core questions</h2>
        {definition.core.map((field, index) => <fieldset className="cms-editor-group" key={field.id}>
          <legend>{field.id}</legend>
          <TextField label="Question label" value={field.label} required maxLength={160} disabled={blocked} onChange={event => fieldEdit("core", field.id, item => ({ ...item, label: event.target.value }))}/>
          {!field.options && <TextField label="Placeholder" value={field.placeholder || ""} maxLength={240} disabled={blocked} onChange={event => fieldEdit("core", field.id, item => ({ ...item, placeholder: event.target.value }))}/>}
          {choices("core", field)}
          {orderControls("core", field, index)}
        </fieldset>)}
        <h2>Additional questions</h2>
        {definition.additional.map((field, index) => <fieldset className="cms-editor-group" key={field.id}>
          <legend>Question {index + 1}</legend>
          <TextField label="Question label" value={field.label} required maxLength={160} disabled={blocked} onChange={event => fieldEdit("additional", field.id, item => ({ ...item, label: event.target.value }))}/>
          <TextField label="Description" value={field.description} maxLength={240} disabled={blocked} onChange={event => fieldEdit("additional", field.id, item => ({ ...item, description: event.target.value }))}/>
          <SelectField label="Answer type" value={field.type} disabled={blocked} onChange={event => {
            const type = event.target.value;
            fieldEdit("additional", field.id, item => ({ ...item, type, options: isChoice(type) ? (isChoice(item.type) ? item.options : [newOption("Choice 1"), newOption("Choice 2")]) : [] }));
          }}>{types.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</SelectField>
          <SelectField label="Answer requirement" value={field.required ? "required" : "optional"} disabled={blocked} onChange={event => fieldEdit("additional", field.id, item => ({ ...item, required: event.target.value === "required" }))}>
            <option value="optional">Optional</option><option value="required">Required</option>
          </SelectField>
          {contexts.map(context => <SelectField key={context} label={context[0].toUpperCase()+context.slice(1)+" enquiries"} value={field.entries.includes(context) ? "show" : "hide"} disabled={blocked || (field.entries.length === 1 && field.entries.includes(context))} onChange={event => fieldEdit("additional", field.id, item => ({ ...item, entries: event.target.value === "show" ? [...new Set([...item.entries, context])] : item.entries.filter(entry => entry !== context) }))}>
            <option value="show">Show question</option><option value="hide">Hide question</option>
          </SelectField>)}
          {isChoice(field.type) && choices("additional", field)}
          {orderControls("additional", field, index)}
        </fieldset>)}
        <Button type="button" icon="plus" disabled={blocked || definition.additional.length >= 12} onClick={() => edit(body => ({ ...body, additional: [...body.additional, { id: identifier("custom_"), label: "New question", description: "", type: "text", required: false, entries: [...contexts], options: [] }] }))}>Add question</Button>
      </div>
      <div className="editor-actions">
        <Button type="button" icon="save" disabled={blocked || saving || !saveState.dirty} onClick={() => writer.current?.flush()}>Save draft</Button>
        {canPublish && <Button type="button" icon="check" disabled={blocked || saving || saveState.dirty || record.revision === 0} onClick={() => setConfirmation({ action: "activate" })}>Activate form</Button>}
      </div>
      <HistoryDisclosure title="Activated versions" count={history.length}>
        <Button type="button" icon="refresh" disabled={blocked || saving} onClick={loadHistory}>Load history</Button>
        {history.map(item => <div key={item.version} className="editor-actions">
          <span>Version {item.version}{item.activated_at ? " · " + new Date(item.activated_at).toLocaleString() : ""}</span>
          <Button type="button" disabled={blocked || saving || saveState.dirty} onClick={() => setConfirmation({ action: "restore", version: item.version })}>Restore draft</Button>
        </div>)}
      </HistoryDisclosure>
    </>}
    <ERPConfirmDialog open={Boolean(confirmation)} title={confirmation?.action === "restore" ? "Restore form version?" : "Activate form?"}
      message={confirmation?.action === "restore" ? "Restore as a new draft without changing the active version." : "Activate the saved configuration for new enquiries."}
      confirmLabel={confirmation?.action === "restore" ? "Restore draft" : "Activate form"} confirmTone="primary"
      onCancel={() => setConfirmation(null)} onConfirm={() => { const pending = confirmation; setConfirmation(null); if (pending) void apply(pending.action, pending.version); }}/>
  </section>;
}
