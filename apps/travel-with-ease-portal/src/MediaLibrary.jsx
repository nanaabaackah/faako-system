import Button from "./ActionButton.jsx";
import "./media-library.css";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  InlineNotice,
  TextField,
  TextareaField,
  SelectField,
  AnimatedLoadingState,
} from "@faako/ui";

export default function MediaLibrary({ api, session, onSelect }) {
  const [items, setItems] = useState([]);
  const [configured, setConfigured] = useState(false);
  const [driveConfigured, setDriveConfigured] = useState(false);
  const [driveItems, setDriveItems] = useState([]);
  const [driveSelection, setDriveSelection] = useState("");
  const [driveNext, setDriveNext] = useState("");
  const [driveLoaded, setDriveLoaded] = useState(false);
  const [state, setState] = useState({ loading: true, error: "", message: "" });
  const [replacement, setReplacement] = useState("");
  const [preview, setPreview] = useState(null);
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
          "X-Media-Rights": encodeURIComponent(
            String(fields.get("rights")).trim(),
          ),
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
  async function browseDrive(append = false) {
    setState({ loading: true, error: "", message: "" });
    try {
      const token = append ? driveNext : "";
      const result = await api.get(
        "/api/agent/media/drive" +
          (token ? "?pageToken=" + encodeURIComponent(token) : ""),
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
      setDriveNext(result.nextPageToken || "");
      setDriveLoaded(true);
      if (!append) setDriveSelection("");
      setState({
        loading: false,
        error: "",
        message: result.incomplete
          ? "Drive returned an incomplete listing. Refresh before relying on missing files. Nothing was imported, deleted or published."
          : "Drive folder refreshed. No images were imported or published.",
      });
    } catch (error) {
      setState({ loading: false, error: error.message, message: "" });
    }
  }
  async function importDrive(event) {
    event.preventDefault();
    const item = driveItems.find((value) => value.id === driveSelection);
    if (!item) return;
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
          rights: String(fields.get("rights")).trim(),
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
        message: result.demo
          ? "Demo image selected in the simulated library. No Drive or R2 request was made; nothing was sent or published."
          : result.unchanged
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
    if (
      !window.confirm(
        "Archive this image? Images referenced by content history cannot be archived.",
      )
    )
      return;
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
    } catch (error) {
      setState({ loading: false, error: error.message, message: "" });
    }
  }

  return (
    <section
      className="content-editor media-workspace"
      aria-labelledby="media-heading"
    >
      <h2 id="media-heading">Media library</h2>
      <p className="workspace-caption">
        Manage licensed photography and descriptive text. Assets remain private
        until published through a content revision.
      </p>
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
          message="Preparing the private library or confirming your operation."
        />
      ) : (
        <p role="status">{state.message}</p>
      )}
      {session.demo && (
        <p>
          This is a simulated Drive library. No Google Drive, R2 or upload
          connection is used in the demo.
        </p>
      )}
      {!session.demo && !state.loading && !configured && (
        <p>
          Private storage is not configured. Baaba must complete the
          environment-specific R2 setup before uploads or previews are
          available.
        </p>
      )}
      <section
        className="workspace-panel"
        aria-labelledby="drive-media-heading"
      >
        <h3 id="drive-media-heading">Google Drive → image library</h3>
        <p>
          Refresh the configured folder, then import a reviewed image. Updating
          a file in Drive creates a new library revision on import; existing
          website images stay unchanged until you select and publish the
          replacement.
        </p>
        {!driveConfigured && !state.loading && (
          <p>
            Drive import is not configured for this environment. Direct uploads
            remain available when R2 is configured.
          </p>
        )}
        <Button
          type="button"
          disabled={state.loading || !driveConfigured}
          onClick={() => browseDrive(false)}
        >
          Refresh Drive folder
        </Button>
        {driveLoaded && (
          <form onSubmit={importDrive}>
            <fieldset disabled={state.loading || !driveConfigured}>
              <legend>Import from the approved folder</legend>
              <SelectField
                label="Drive image"
                value={driveSelection}
                onChange={(event) => setDriveSelection(event.target.value)}
                options={[
                  { value: "", label: "Choose an image" },
                  ...driveItems.map((item) => ({
                    value: item.id,
                    label:
                      item.name +
                      (item.importedId
                        ? " — already imported"
                        : item.archived
                          ? " — archived revision"
                          : ""),
                  })),
                ]}
                required
              />
              <TextField
                label="Alternative text"
                name="alt"
                maxLength={500}
                required
              />
              <TextareaField
                label="Source and licence evidence"
                name="rights"
                maxLength={2000}
                required
              />
              <p>
                JPEG, PNG or WebP only, up to 8 MiB. Unsupported files and
                subfolders are not imported. Nothing is deleted from Drive.
                Already imported revisions retain their saved alternative text
                and licence evidence.
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
            </fieldset>
          </form>
        )}
        {driveLoaded && !driveItems.length && (
          <p>
            No supported, downloadable images were found directly inside this
            folder.
          </p>
        )}
        {driveNext && (
          <Button
            type="button"
            disabled={state.loading}
            onClick={() => browseDrive(true)}
          >
            Load more Drive images
          </Button>
        )}
      </section>
      <form data-tour="media-upload" ref={form} onSubmit={upload}>
        <fieldset disabled={state.loading || !configured}>
          <legend>
            {replacement
              ? "Upload replacement as a new asset"
              : "Upload a licensed image"}
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
          <TextareaField
            label="Source and licence evidence"
            name="rights"
            maxLength={2000}
            required
          />
          <p>
            JPEG, PNG or WebP, up to 8 MiB. Images are re-encoded; original
            metadata is removed. Never upload identity documents.
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
      </form>
      <h3>
        Active library <span className="library-count">{items.length}</span>
      </h3>
      <ul className="media-list">
        {items.map((item) => (
          <li key={item.id}>
            <h3>{item.alt_text}</h3>
            <p>
              {item.width} × {item.height} pixels
            </p>
            <p>{item.rights}</p>
            <div className="editor-actions">
              <Button
                type="button"
                disabled={state.loading || !configured}
                onClick={() => showPreview(item)}
              >
                Preview {item.alt_text}
              </Button>
              {onSelect && (
                <Button
                  type="button"
                  disabled={state.loading}
                  onClick={() => onSelect(item)}
                >
                  Use {item.alt_text}
                </Button>
              )}
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
                onClick={() => archive(item)}
              >
                Archive {item.alt_text}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {!state.loading && !state.error && !items.length && (
        <div className="workspace-empty">
          <h4>Your library is empty</h4>
          <p>
            Add licensed images when private storage is available. No
            placeholder assets will be published.
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
          <figcaption>Private preview. Not published.</figcaption>
          <Button type="button" onClick={() => setPreview(null)}>
            Close preview
          </Button>
        </figure>
      )}
    </section>
  );
}
