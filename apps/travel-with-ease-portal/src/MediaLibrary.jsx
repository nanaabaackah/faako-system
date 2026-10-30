import Button from "./ActionButton.jsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { InlineNotice, TextField, TextareaField } from "@faako/ui";

export default function MediaLibrary({ api, session, onSelect }) {
  const [items, setItems] = useState([]);
  const [configured, setConfigured] = useState(false);
  const [state, setState] = useState({ loading: true, error: "", message: "" });
  const [replacement, setReplacement] = useState("");
  const [preview, setPreview] = useState(null);
  const form = useRef(null);
  const notice = useRef(null);
  const load = useCallback(async () => {
    const result = await api.get("/api/agent/media", { responseMode: "data" });
    if (!Array.isArray(result?.items) || typeof result.configured !== "boolean") throw new Error("The media response was incomplete.");
    setItems(result.items); setConfigured(result.configured);
  }, [api]);
  useEffect(() => {
    let active = true;
    load().then(() => { if (active) setState({ loading: false, error: "", message: "" }); })
      .catch((error) => { if (active) setState({ loading: false, error: error.message, message: "" }); });
    return () => { active = false; };
  }, [load]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  useEffect(() => { if (state.error) notice.current?.focus(); }, [state.error]);

  async function upload(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const file = fields.get("image");
    if (!(file instanceof File) || !file.size || file.size > 8 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setState({ loading: false, error: "Choose a JPEG, PNG or WebP image up to 8 MiB.", message: "" }); return;
    }
    setState({ loading: true, error: "", message: "" });
    try {
      const path = replacement ? `/api/agent/media/${replacement}/replace` : "/api/agent/media/upload";
      await api.post(path, { body: file, responseMode: "data", headers: {
        "Content-Type": file.type, "X-CSRF-Token": session.csrfToken,
        "X-Media-Alt": encodeURIComponent(String(fields.get("alt")).trim()),
        "X-Media-Rights": encodeURIComponent(String(fields.get("rights")).trim()),
      } });
      form.current.reset(); setReplacement("");
      // A successful mutation is not retried if refreshing the list fails.
      try { await load(); }
      catch { setState({ loading: false, error: "Image saved, but the list could not refresh. Reload the library; do not upload again.", message: "" }); return; }
      setState({ loading: false, error: "", message: "Image saved privately. Select it in a content draft; existing revisions are unchanged." });
    } catch (error) { setState({ loading: false, error: error.message, message: "" }); }
  }
  async function showPreview(item) {
    setState({ loading: true, error: "", message: "" });
    try {
      const blob = await api.get(`/api/agent/media/${item.id}/preview`, { responseMode: "blob" });
      if (blob.type !== "image/webp") throw new Error("The image preview was invalid.");
      setPreview({ url: URL.createObjectURL(blob), alt: item.alt_text, width: item.width, height: item.height });
      setState({ loading: false, error: "", message: "Private image preview loaded." });
    } catch (error) { setState({ loading: false, error: error.message, message: "" }); }
  }
  async function archive(item) {
    if (!window.confirm("Archive this image? Images referenced by content history cannot be archived.")) return;
    setState({ loading: true, error: "", message: "" });
    try {
      await api.post(`/api/agent/media/${item.id}/archive`, { responseMode: "data", headers: { "X-CSRF-Token": session.csrfToken } });
      setItems((current) => current.filter((value) => value.id !== item.id)); setPreview(null);
      setState({ loading: false, error: "", message: "Image archived. Stored files are retained; nothing was permanently deleted." });
    } catch (error) { setState({ loading: false, error: error.message, message: "" }); }
  }

  return <section className="content-editor media-workspace" aria-labelledby="media-heading">
    <h2 id="media-heading">Media library</h2><p className="workspace-caption">Manage licensed photography and descriptive text. Assets remain private until published through a content revision.</p>
    <div ref={notice} tabIndex={-1}>{state.error && <InlineNotice tone="danger" title="Media request unsuccessful" message={state.error} />}</div>
    <p role="status">{state.loading ? "Working…" : state.message}</p>
    {!state.loading && !configured && <p>Private storage is not configured. Baaba must complete the environment-specific R2 setup before uploads or previews are available.</p>}
    <form data-tour="media-upload" ref={form} onSubmit={upload}>
      <fieldset disabled={state.loading || !configured}>
        <legend>{replacement ? "Upload replacement as a new asset" : "Upload a licensed image"}</legend>
        <label className="file-picker">Image<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
        <TextField label="Alternative text" name="alt" maxLength={500} required />
        <TextareaField label="Source and licence evidence" name="rights" maxLength={2000} required />
        <p>JPEG, PNG or WebP, up to 8 MiB. Images are re-encoded; original metadata is removed. Never upload identity documents.</p>
        <Button type="submit">{replacement ? "Save replacement" : "Upload image"}</Button>
        {replacement && <Button type="button" onClick={() => setReplacement("")}>Cancel replacement</Button>}
      </fieldset>
    </form>
    <h3>Active library <span className="library-count">{items.length}</span></h3><ul className="media-list">{items.map((item) => <li key={item.id}>
      <h3>{item.alt_text}</h3><p>{item.width} × {item.height} pixels</p><p>{item.rights}</p>
      <div className="editor-actions">
        <Button type="button" disabled={state.loading || !configured} onClick={() => showPreview(item)}>Preview {item.alt_text}</Button>
        {onSelect && <Button type="button" disabled={state.loading} onClick={() => onSelect(item)}>Use {item.alt_text}</Button>}
        <Button type="button" disabled={state.loading || !configured} onClick={() => { setReplacement(item.id); form.current?.querySelector("input")?.focus(); }}>Replace {item.alt_text}</Button>
        <Button type="button" disabled={state.loading} onClick={() => archive(item)}>Archive {item.alt_text}</Button>
      </div>
    </li>)}</ul>
    {!state.loading && !state.error && !items.length && <div className="workspace-empty"><h4>Your library is empty</h4><p>Add licensed images when private storage is available. No placeholder assets will be published.</p></div>}
    {preview && <figure><img className="media-preview" src={preview.url} alt={preview.alt} width={preview.width} height={preview.height} /><figcaption>Private preview. Not published.</figcaption><Button type="button" onClick={() => setPreview(null)}>Close preview</Button></figure>}
  </section>;
}
