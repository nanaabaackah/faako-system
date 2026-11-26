import Button from "./ActionButton.jsx";
import NavigationIcon from "./NavigationIcon.jsx";
import "../styles/media-library.css";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  InlineNotice,
  TextField,
   AnimatedLoadingState,
  ERPConfirmDialog,
  useToast,
} from "@faako/ui";

export default function MediaLibrary({ api, session, onSelect }) {
  const { pushToast } = useToast();
  const [items, setItems] = useState([]);
  const [librarySearch, setLibrarySearch] = useState("");
  const [driveSearch, setDriveSearch] = useState("");
  const [layout, setLayout] = useState("grid");
  const canWrite = session.user.permissions?.includes("media.write") === true;
  const [configured, setConfigured] = useState(false);
  const [driveConfigured, setDriveConfigured] = useState(false);
  const [driveItems, setDriveItems] = useState([]);
  const [driveFolders, setDriveFolders] = useState([]);
  const [drivePath, setDrivePath] = useState([]);
  const [driveSelection, setDriveSelection] = useState("");
  const [driveNext, setDriveNext] = useState("");
  const [driveLoaded, setDriveLoaded] = useState(false);
  const [state, setState] = useState({ loading: true, error: "", message: "" });
  const [replacement, setReplacement] = useState("");
  const [preview, setPreview] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const form = useRef(null);
  const notice = useRef(null);
  const load = useCallback(async () => {
    const result = await api.get("/api/agent/media", { responseMode: "data" });
    if (!Array.isArray(result?.items) || typeof result.configured !== "boolean")
      throw new Error("The media response was incomplete.");
    setItems(result.items);
    setConfigured(result.configured);
    setDriveConfigured(result.driveConfigured === true);
  }, [api]);
  useEffect(() => {
    let active = true;
    load()
      .then(() => {
        if (active) setState({ loading: false, error: "", message: "" });
      })
      .catch((error) => {
        if (active)
          setState({ loading: false, error: error.message, message: "" });
      });
    return () => {
      active = false;
    };
  }, [load]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  useEffect(() => {
    if (state.error) notice.current?.focus();
  }, [state.error]);

  async function upload(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const file = fields.get("image");
    if (
      !(file instanceof File) ||
      !file.size ||
      file.size > 8 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setState({
        loading: false,
        error: "Choose a JPEG, PNG or WebP image up to 8 MiB.",
        message: "",
      });
      return;
    }
    setState({ loading: true, error: "", message: "" });
    try {
      const path = replacement
        ? `/api/agent/media/${replacement}/replace`
        : "/api/agent/media/upload";
      await api.post(path, {
        body: file,
        responseMode: "data",
        headers: {
          "Content-Type": file.type,
          "X-CSRF-Token": session.csrfToken,
          "X-Media-Alt": encodeURIComponent(String(fields.get("alt")).trim()),
        },
      });
      form.current.reset();
      setReplacement("");
      // A successful mutation is not retried if refreshing the list fails.
      try {
        await load();
      } catch {
        setState({
          loading: false,
          error:
            "Image saved, but the list could not refresh. Reload the library; do not upload again.",
          message: "",
        });
        return;
      }
      setState({
        loading: false,
        error: "",
        message:
          "Image saved privately. Select it in a content draft; existing revisions are unchanged.",
      });
    } catch (error) {
      setState({ loading: false, error: error.message, message: "" });
    }
  }
  async function browseDrive(append = false, path = drivePath) {
    setState({ loading: true, error: "", message: "" });
    try {
      const token = append ? driveNext : "";
      const params = new URLSearchParams();
      if (token) params.set("pageToken", token);
      if (path.length) params.set("folderId", path.at(-1).id);
      const result = await api.get(
        "/api/agent/media/drive" + (params.size ? "?" + params.toString() : ""),
        { responseMode: "data" },
      );
      if (!result.configured || !Array.isArray(result.items))
        throw new Error(
          "Google Drive import is not configured. Ask Faako to check the TWE media account and folder.",
        );
      setDriveItems((current) =>
        append
          ? [
              ...new Map(
                [...current, ...result.items].map((item) => [item.id, item]),
              ).values(),
            ]
          : result.items,
      );
      setDriveFolders((current) => append
        ? [...new Map([...current, ...(result.folders || [])].map((folder) => [folder.id, folder])).values()]
        : result.folders || []);
      setDrivePath(path);
      setDriveNext(result.nextPageToken || "");
      setDriveLoaded(true);
      if (!append) { setDriveSelection(""); setDriveSearch(""); }
      setState({
        loading: false,
        error: "",
        message: result.incomplete
          ? "Drive returned an incomplete listing. Refresh before relying on missing files. Nothing was imported, deleted or published."
          : "",
      });
    } catch (error) {
      setState({ loading: false, error: error.message, message: "" });
    }
  }
  async function importDrive(event) {
    event.preventDefault();
    const item = driveItems.find((value) => value.id === driveSelection);
    if (!item || !canWrite || item.archived) return;
    const fields = new FormData(event.currentTarget);
    setState({ loading: true, error: "", message: "" });
    try {
      const result = await api.post("/api/agent/media/drive/import", {
        responseMode: "data",
        headers: { "X-CSRF-Token": session.csrfToken },
        json: {
          fileId: item.id,
          version: item.version,
          alt: String(fields.get("alt")).trim(),
        },
      });
      setDriveItems((current) =>
        current.map((value) =>
          value.id === item.id ? { ...value, importedId: result.id } : value,
        ),
      );
      try {
        await load();
      } catch {
        setState({
          loading: false,
          error:
            "Image imported, but the library could not refresh. Reload the library; do not import again.",
          message: "",
        });
        return;
      }
      setState({
        loading: false,
        error: "",
        message: result.unchanged
            ? "This Drive revision is already in the private library. Select it in a draft to use it."
            : "Drive image imported into private R2 storage. Select it in a draft, save and request publication. The live website has not changed.",
      });
    } catch (error) {
      setState({ loading: false, error: error.message, message: "" });
    }
  }
  async function showPreview(item) {
    setState({ loading: true, error: "", message: "" });
    try {
      const blob = await api.get(`/api/agent/media/${item.id}/preview`, {
        responseMode: "blob",
      });
      if (blob.type !== "image/webp")
        throw new Error("The image preview was invalid.");
      setPreview({
        url: URL.createObjectURL(blob),
        alt: item.alt_text,
        width: item.width,
        height: item.height,
      });
      setState({
        loading: false,
        error: "",
        message: "Private image preview loaded.",
      });
    } catch (error) {
      setState({ loading: false, error: error.message, message: "" });
    }
  }
  async function archive(item) {
    setState({ loading: true, error: "", message: "" });
    try {
      await api.post(`/api/agent/media/${item.id}/archive`, {
        responseMode: "data",
        headers: { "X-CSRF-Token": session.csrfToken },
      });
      setItems((current) => current.filter((value) => value.id !== item.id));
      setPreview(null);
      setState({
        loading: false,
        error: "",
        message:
          "Image archived. Stored files are retained; nothing was permanently deleted.",
      });
      pushToast({ tone: "success", title: "Image archived", message: "Stored files were retained; nothing was permanently deleted." });
    } catch (error) {
      setState({ loading: false, error: error.message, message: "" });
    }
  }

  return (
    <section
      className="content-editor media-workspace"
      aria-labelledby="media-heading"
    >
      <h2 id="media-heading">{onSelect ? "Choose image" : "Media library"}</h2>
      <div ref={notice} tabIndex={-1}>
        {state.error && (
          <InlineNotice
            tone="danger"
            title="Media request unsuccessful"
            message={state.error}
          />
        )}
      </div>
      {state.loading ? (
        <AnimatedLoadingState
          compact
          title="Loading media"
          message="Loading images…"
        />
      ) : (
        <p role="status">{state.message}</p>
      )}
      {!state.loading && !configured && (
        <InlineNotice
          tone="warning"
          title="Media uploads are unavailable"
          message="Photo storage is not connected for this workspace. Ask Faako for help; your existing content is unchanged."
        />
      )}
      {canWrite && <section
        className="workspace-panel twe-drive-browser"
        aria-labelledby="drive-media-heading"
      >
        <div className="twe-media-toolbar">
          <h3 id="drive-media-heading">Google Drive</h3>
        {!driveConfigured && !state.loading && (
          <p>
            Drive import is unavailable. {configured ? "You can upload a JPG, PNG or WebP directly." : "Private image storage must be connected first."}
          </p>
        )}
        <Button icon="refresh"
          type="button"
          disabled={state.loading || !driveConfigured}
          onClick={() => browseDrive(false)}
        >
          Refresh Drive folder
        </Button>
        </div>
        {driveLoaded && drivePath.length > 0 && (
          <div className="editor-actions">
            <Button type="button" disabled={state.loading} onClick={() => browseDrive(false, [])}>Drive root</Button>
            <Button type="button" disabled={state.loading} onClick={() => browseDrive(false, drivePath.slice(0, -1))}>Back</Button>
            <span>{drivePath.map((folder) => folder.name).join(" / ")}</span>
          </div>
        )}
        {driveLoaded && driveFolders.length > 0 && (
          <div className="twe-drive-folders" aria-label="Drive subfolders">
            {driveFolders.map((folder) => (
              <button className="twe-drive-folder" key={folder.id} type="button" disabled={state.loading}
                onClick={() => browseDrive(false, [...drivePath, folder])}><NavigationIcon name="content"/><span>{folder.name}</span><NavigationIcon name="arrow"/></button>
            ))}
          </div>
        )}
        {driveLoaded && driveItems.length > 0 && (
          <form onSubmit={importDrive}>
            <fieldset disabled={state.loading || !driveConfigured}>
              <legend>Import from the approved folder</legend>
              <TextField label="Search this folder" value={driveSearch} onChange={event => setDriveSearch(event.target.value)}/>
              <div className="twe-drive-files" role="group" aria-label="Drive images">
                {driveItems.filter(item => item.name.toLowerCase().includes(driveSearch.trim().toLowerCase())).map(item => (
                  <button type="button" className="twe-drive-file" key={item.id}
                    aria-pressed={driveSelection === item.id} disabled={state.loading || item.archived}
                    onClick={() => setDriveSelection(item.id)}>
                    <NavigationIcon name="media"/>
                    <span><strong>{item.name}</strong><small>{item.archived ? "Archived revision" : item.importedId ? "Imported" : "Not imported"}</small></span>
                    <NavigationIcon name={driveSelection === item.id ? "check" : "arrow"}/>
                  </button>
                ))}
              </div>
              {driveSearch && !driveItems.some(item => item.name.toLowerCase().includes(driveSearch.trim().toLowerCase())) && <p>No matching images on this page.</p>}
              {driveSelection && <>
              <TextField
                label="Alternative text"
                name="alt"
                maxLength={500}
                required
              />
              <p>
                JPG, PNG or WebP · Maximum 8 MB. Use only photos you have permission to publish.
              </p>
              <Button
                type="submit"
                disabled={
                  !driveSelection ||
                  driveItems.find((item) => item.id === driveSelection)
                    ?.archived
                }
              >
                Import selected image
              </Button>
              </>}
            </fieldset>
          </form>
        )}
        {driveLoaded && !driveItems.length && !driveFolders.length && !driveNext && (
          <p>No supported images or subfolders found.</p>
        )}
        {driveNext && (
          <Button
            type="button"
            disabled={state.loading}
            onClick={() => browseDrive(true)}
          >
            Load more
          </Button>
        )}
      </section>}
      {canWrite && <form data-tour="media-upload" ref={form} onSubmit={upload}>
        <fieldset disabled={state.loading || !configured}>
          <legend>
            {replacement
              ? "Upload replacement as a new asset"
              : "Upload a TWE image"}
          </legend>
          <label className="file-picker">
            Image
            <input
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </label>
          <TextField
            label="Alternative text"
            name="alt"
            maxLength={500}
            required
          />
          <p>
            JPG, PNG or WebP · Maximum 8 MB. Do not upload identity documents.
          </p>
          <Button type="submit">
            {replacement ? "Save replacement" : "Upload image"}
          </Button>
          {replacement && (
            <Button type="button" onClick={() => setReplacement("")}>
              Cancel replacement
            </Button>
          )}
        </fieldset>
      </form>}
      <div className="twe-media-toolbar">
        <h3>Active library <span className="library-count">{items.length}</span></h3>
        <div className="twe-media-view-options" role="group" aria-label="Library view">
          <Button type="button" icon="media" aria-pressed={layout === "grid"} onClick={() => setLayout("grid")}>Grid</Button>
          <Button type="button" icon="content" aria-pressed={layout === "list"} onClick={() => setLayout("list")}>List</Button>
        </div>
      </div>
      <TextField label="Search library" value={librarySearch} onChange={event => setLibrarySearch(event.target.value)} />
      <ul className={`media-list twe-asset-list twe-asset-list--${layout}`}>
        {items.filter(item => (item.alt_text || "").toLowerCase().includes(librarySearch.trim().toLowerCase())).map((item) => (
          <li key={item.id}>
            <button type="button" className="twe-asset-primary" disabled={state.loading || (!onSelect && !configured)}
              aria-label={onSelect ? `Use ${item.alt_text}` : `Preview ${item.alt_text}`}
              onClick={() => onSelect ? onSelect(item) : showPreview(item)}>
              <span className="twe-asset-image"><NavigationIcon name="media"/><img src={`/api/agent/media/${item.id}/preview`} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }}/></span>
              <span className="twe-asset-copy"><strong>{item.alt_text}</strong><small>{item.width && item.height ? `${item.width} × ${item.height}px` : "Image"}</small></span>
              <NavigationIcon name="arrow"/>
            </button>
            <details className="twe-asset-actions">
              <summary><span>More actions</span><NavigationIcon name="arrow"/></summary>
              <div className="editor-actions">
              {onSelect && <Button type="button" disabled={state.loading || !configured} onClick={() => showPreview(item)}>Preview {item.alt_text}</Button>}
              {canWrite && <>
              <Button
                type="button"
                disabled={state.loading || !configured}
                onClick={() => {
                  setReplacement(item.id);
                  form.current?.querySelector("input")?.focus();
                }}
              >
                Replace {item.alt_text}
              </Button>
              <Button
                type="button"
                disabled={state.loading}
                onClick={() => setArchiveTarget(item)}
              >
                Archive {item.alt_text}
              </Button>
              </>}
              </div>
            </details>
          </li>
        ))}
      </ul>
      {librarySearch && !items.some(item => (item.alt_text || "").toLowerCase().includes(librarySearch.trim().toLowerCase())) && <p>No matching images.</p>}
      {!state.loading && !state.error && !items.length && (
        <div className="workspace-empty">
          <h4>Your library is empty</h4>
          <p>
            Import from Drive or upload a photo.
          </p>
        </div>
      )}
      {preview && (
        <figure>
          <img
            className="media-preview"
            src={preview.url}
            alt={preview.alt}
            width={preview.width}
            height={preview.height}
          />
          <figcaption>Preview</figcaption>
          <Button type="button" onClick={() => setPreview(null)}>
            Close preview
          </Button>
        </figure>
      )}
      <ERPConfirmDialog open={Boolean(archiveTarget)} title="Archive this image?" message="Images referenced by content history cannot be archived. Stored files are retained; nothing is permanently deleted." confirmLabel="Archive image" loading={state.loading}
        onCancel={() => setArchiveTarget(null)} onConfirm={async () => { const item = archiveTarget; setArchiveTarget(null); await archive(item); }} />
    </section>
  );
}
