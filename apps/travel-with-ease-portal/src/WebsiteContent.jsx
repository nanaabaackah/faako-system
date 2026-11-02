import Button from "./ActionButton.jsx";
import { useEffect, useRef, useState } from "react";
import {
  SelectField,
  TextField,
  TextareaField,
  DateField,
  InlineNotice,
  AnimatedLoadingState,
} from "@faako/ui";
import MediaLibrary from "./MediaLibrary.jsx";
import reviewDrafts from "../../../docs/apps/travel-with-ease/content-review-drafts.json";

import countryOptions from "../../travel-with-ease-web/src/lib/footprint-countries.json";
const countries = [...countryOptions].sort((a, b) =>
  a.name.localeCompare(b.name),
);
const pages = [
  "home",
  "about",
  "services",
  "how-it-works",
  "faqs",
  "testimonials",
  "contact",
  "journal",
  "travel-footprint",
  "privacy",
  "terms",
  "cookies",
];
const emptyBody = () => ({
  heading: "",
  body: "",
  ctaLabel: "",
  ctaPath: "/#plan",
  seoTitle: "",
  seoDescription: "",
  imageId: null,
  entries: [],
  contactEmail: "",
  contactPhone: "",
  articles: [],
  footprint: [],
});

export default function WebsiteContent({ api, session, onDirtyChange }) {
  const canPublish =
    session.user.permissions?.includes("content.publish") === true;
  const [page, setPage] = useState("home");
  const [body, setBody] = useState(emptyBody);
  const [version, setVersion] = useState(0);
  const [history, setHistory] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(null);
  const [chooseImage, setChooseImage] = useState(false);
  const [state, setState] = useState({ loading: true, error: "", message: "" });
  const heading = useRef(null);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    let active = true;
    async function load() {
      setState({ loading: true, error: "", message: "" });
      setPreview(null);
      try {
        let item;
        try {
          item = await api.get(`/api/agent/content/${page}`, {
            responseMode: "data",
          });
        } catch (error) {
          if (error.status !== 404) throw error;
        }
        const revisions = await api.get(
          `/api/agent/content/${page}/revisions`,
          { responseMode: "data" },
        );
        const publications = await api.get(
          "/api/agent/content/publication-jobs",
          { responseMode: "data" },
        );
        if (!active) return;
        setBody({ ...emptyBody(), ...item?.body });
        setVersion(item?.version || 0);
        setHistory(revisions.items);
        setJobs(publications.items);
        setDirty(false);
        setState({ loading: false, error: "", message: "" });
        heading.current?.focus();
      } catch (error) {
        if (active)
          setState({ loading: false, error: error.message, message: "" });
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [api, page]);
  const change = (key, value) => {
    setBody((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setPreview(null);
  };
  async function save(event) {
    event.preventDefault();
    setState({ loading: true, error: "", message: "Saving draft…" });
    try {
      const result = await api.post(`/api/agent/content/${page}/draft`, {
        responseMode: "data",
        json: { body, expectedVersion: version },
        headers: { "X-CSRF-Token": session.csrfToken },
      });
      setBody(result.body);
      setVersion(result.version);
      setDirty(false);
      const revisions = await api.get(`/api/agent/content/${page}/revisions`, {
        responseMode: "data",
      });
      setHistory(revisions.items);
      setState({
        loading: false,
        error: "",
        message: "Draft saved. The public website has not changed.",
      });
    } catch (error) {
      setState({ loading: false, error: error.message, message: "" });
    }
  }
  async function showPreview() {
    setState({ loading: true, error: "", message: "" });
    try {
      const item = await api.get(`/api/agent/content/${page}/preview`, {
        responseMode: "data",
      });
      setPreview(item.body);
      setState({
        loading: false,
        error: "",
        message: "Showing the saved draft, not the public website.",
      });
    } catch (error) {
      setState({ loading: false, error: error.message, message: "" });
    }
  }
  async function revert(id) {
    if (
      dirty &&
      !window.confirm(
        "Discard unsaved changes and restore this revision as a new draft?",
      )
    )
      return;
    setState({ loading: true, error: "", message: "" });
    try {
      const result = await api.post(`/api/agent/content/${page}/revert/${id}`, {
        responseMode: "data",
        json: { expectedVersion: version },
        headers: { "X-CSRF-Token": session.csrfToken },
      });
      setBody(result.body);
      setVersion(result.version);
      setDirty(false);
      setPreview(null);
      setHistory((current) => [
        {
          id: result.revisionId,
          version: result.version,
          created_at: new Date().toISOString(),
        },
        ...current,
      ]);
      setState({
        loading: false,
        error: "",
        message:
          "Revision restored as a new draft. Nothing has been published.",
      });
    } catch (error) {
      setState({ loading: false, error: error.message, message: "" });
    }
  }
  async function publication(action, id) {
    if (
      action !== "refresh" &&
      !window.confirm(
        action === "unpublish"
          ? "Request removal of this page from the next public build?"
          : "Request a website build using the saved content?",
      )
    )
      return;
    setState({ loading: true, error: "", message: "" });
    try {
      if (action !== "refresh")
        await api.post(
          id
            ? `/api/agent/content/publication-jobs/${id}/retry`
            : `/api/agent/content/${page}/${action}`,
          {
            responseMode: "data",
            ...(id ? {} : { json: { expectedVersion: version } }),
            headers: { "X-CSRF-Token": session.csrfToken },
          },
        );
      const result = await api.get("/api/agent/content/publication-jobs", {
        responseMode: "data",
      });
      setJobs(result.items);
      setState({
        loading: false,
        error: "",
        message:
          action === "refresh"
            ? "Publication status refreshed."
            : "Request queued. The site changes only after a successful deployment is verified.",
      });
    } catch (error) {
      setState({ loading: false, error: error.message, message: "" });
    }
  }

  return (
    <section
      className="content-editor website-workspace"
      aria-labelledby="content-heading"
    >
      <h2 id="content-heading" tabIndex={-1} ref={heading}>
        Website content
      </h2>
      <p className="workspace-caption">
        Prepare approved content, review saved drafts and track publication
        separately.
      </p>
      <div data-tour="content-pages">
        <SelectField
          label="Section"
          value={page}
          disabled={state.loading}
          onChange={(event) => {
            if (!dirty || window.confirm("Discard unsaved changes?"))
              setPage(event.target.value);
          }}
        >
          {pages.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </SelectField>
      </div>
      {state.error && (
        <InlineNotice
          tone="danger"
          title="Content request unsuccessful"
          message={state.error}
        />
      )}
      {state.loading ? (
        <AnimatedLoadingState
          compact
          title="Loading website content"
          message={
            state.message || "Preparing saved content and publication status."
          }
        />
      ) : (
        <p role="status">
          {state.message ||
            (dirty ? "Unsaved changes" : `Draft version ${version}`)}
        </p>
      )}
      {reviewDrafts[page] && (
        <section className="workspace-panel">
          <h3>Starter copy for review</h3>
          <p>
            Load the company-based draft to edit it here. Policy drafts contain
            review requirements; resolve them before requesting publication.
          </p>
          <Button
            type="button"
            disabled={state.loading}
            onClick={() => {
              if (
                dirty &&
                !window.confirm("Replace unsaved edits with the review draft?")
              )
                return;
              setBody(structuredClone(reviewDrafts[page]));
              setDirty(true);
              setPreview(null);
            }}
          >
            Load review draft
          </Button>
        </section>
      )}
      <form data-tour="content-draft" onSubmit={save}>
        <fieldset disabled={state.loading}>
          <legend>Selected website fields</legend>
          <TextField
            label="Heading"
            value={body.heading}
            maxLength={120}
            required
            onChange={(e) => change("heading", e.target.value)}
          />
          <TextareaField
            label="Body text"
            value={body.body}
            maxLength={6000}
            rows={6}
            onChange={(e) => change("body", e.target.value)}
          />
          {page === "home" && (
            <>
              <TextField
                label="CTA text"
                value={body.ctaLabel}
                maxLength={60}
                onChange={(e) => change("ctaLabel", e.target.value)}
              />
              <SelectField
                label="CTA destination"
                value={body.ctaPath}
                onChange={(e) => change("ctaPath", e.target.value)}
              >
                <option value="/#plan">Plan a trip</option>
                <option value="/about">About</option>
                <option value="/services">Services</option>
                <option value="/destinations">Destinations</option>
              </SelectField>
            </>
          )}
          {page === "contact" && (
            <>
              <TextField
                label="Official email"
                type="email"
                value={body.contactEmail}
                onChange={(e) => change("contactEmail", e.target.value)}
              />
              <TextField
                label="Official phone"
                type="tel"
                value={body.contactPhone}
                maxLength={40}
                onChange={(e) => change("contactPhone", e.target.value)}
              />
            </>
          )}
          {page === "journal" && (
            <section aria-label="Journal articles">
              <h3>Journal articles</h3>
              <p>
                All articles in this saved collection are included when the
                Owner requests publication. Remove an article and publish to
                withdraw it.
              </p>
              {(body.articles || []).map((article, index) => (
                <fieldset key={index}>
                  <legend>Article {index + 1}</legend>
                  {[
                    ["title", "Title", 120],
                    [
                      "slug",
                      "URL name (lowercase words separated by hyphens)",
                      80,
                    ],
                    ["excerpt", "Short introduction", 240],
                    ["body", "Article text", 6000],
                  ].map(([key, label, max]) => (
                    <TextareaField
                      key={key}
                      label={label}
                      required
                      maxLength={max}
                      value={article[key]}
                      onChange={(event) =>
                        change(
                          "articles",
                          body.articles.map((item, i) =>
                            i === index
                              ? { ...item, [key]: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  ))}
                  <DateField
                    label="Article date"
                    required
                    value={article.date}
                    onChange={(event) =>
                      change(
                        "articles",
                        body.articles.map((item, i) =>
                          i === index
                            ? { ...item, date: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    onClick={() =>
                      change(
                        "articles",
                        body.articles.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove article {index + 1}
                  </Button>
                </fieldset>
              ))}
              <Button
                type="button"
                disabled={(body.articles || []).length >= 20}
                onClick={() =>
                  change("articles", [
                    ...(body.articles || []),
                    { title: "", slug: "", excerpt: "", body: "", date: "" },
                  ])
                }
              >
                Add article
              </Button>
            </section>
          )}
          {page === "travel-footprint" && (
            <section aria-label="Verified travel footprint">
              <h3>Verified country totals</h3>
              <p>
                Enter one verified total per country: completed plus confirmed
                upcoming activity. Use Tanzania for Zanzibar. Only approved
                totals belong here.
              </p>
              {(body.footprint || []).map((row, index) => (
                <fieldset key={index}>
                  <legend>Country {index + 1}</legend>
                  <SelectField
                    label="Country"
                    required
                    value={row.countryCode}
                    onChange={(event) =>
                      change(
                        "footprint",
                        body.footprint.map((item, i) =>
                          i === index
                            ? { ...item, countryCode: event.target.value }
                            : item,
                        ),
                      )
                    }
                  >
                    <option value="">Choose country</option>
                    {countries.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    label="Combined verified total"
                    type="number"
                    min="0"
                    max="1000000"
                    step="1"
                    required
                    value={row.total}
                    onChange={(event) =>
                      change(
                        "footprint",
                        body.footprint.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                total:
                                  event.target.value === ""
                                    ? ""
                                    : Number(event.target.value),
                              }
                            : item,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    onClick={() =>
                      change(
                        "footprint",
                        body.footprint.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove country {index + 1}
                  </Button>
                </fieldset>
              ))}
              <Button
                type="button"
                disabled={(body.footprint || []).length >= countries.length}
                onClick={() =>
                  change("footprint", [
                    ...(body.footprint || []),
                    { countryCode: "", total: 0, status: "verified" },
                  ])
                }
              >
                Add country
              </Button>
            </section>
          )}
          {!["journal", "travel-footprint"].includes(page) && (
            <>
              {body.entries.map((entry, index) => (
                <fieldset key={index}>
                  <legend>Entry {index + 1}</legend>
                  {[
                    ["heading", "Title / question", 160],
                    ["text", "Text / answer", 2000],
                    ["attribution", "Attribution (where applicable)", 160],
                  ].map(([key, label, max]) => (
                    <TextareaField
                      key={key}
                      label={label}
                      value={entry[key]}
                      maxLength={max}
                      required={key !== "attribution"}
                      onChange={(event) =>
                        change(
                          "entries",
                          body.entries.map((value, i) =>
                            i === index
                              ? { ...value, [key]: event.target.value }
                              : value,
                          ),
                        )
                      }
                    />
                  ))}
                  <Button
                    type="button"
                    onClick={() =>
                      change(
                        "entries",
                        body.entries.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove entry {index + 1}
                  </Button>
                </fieldset>
              ))}
              <Button
                type="button"
                disabled={body.entries.length >= 30}
                onClick={() =>
                  change("entries", [
                    ...body.entries,
                    { heading: "", text: "", attribution: "" },
                  ])
                }
              >
                Add entry
              </Button>
            </>
          )}
          <p>
            Use approved facts, client permissions and licensed imagery only. Do
            not add unverified testimonials.
          </p>
          <TextField
            label="SEO title"
            value={body.seoTitle}
            maxLength={70}
            required
            onChange={(e) => change("seoTitle", e.target.value)}
          />
          <TextareaField
            label="SEO description"
            value={body.seoDescription}
            maxLength={180}
            required
            onChange={(e) => change("seoDescription", e.target.value)}
          />
          <div className="editor-actions">
            <Button icon="save" variant="primary" type="submit">
              Save draft
            </Button>
            <Button
              type="button"
              disabled={!version || dirty}
              onClick={showPreview}
            >
              Preview saved content
            </Button>
          </div>
        </fieldset>
      </form>
      <p>
        {body.imageId
          ? `Selected image: ${body.imageId}`
          : "No image selected."}{" "}
        Image selection is saved with the draft.
      </p>
      <Button
        type="button"
        disabled={state.loading}
        onClick={() => setChooseImage((current) => !current)}
      >
        {chooseImage ? "Close image library" : "Choose image"}
      </Button>
      {body.imageId && (
        <Button
          type="button"
          disabled={state.loading}
          onClick={() => change("imageId", null)}
        >
          Remove image from draft
        </Button>
      )}
      {chooseImage && (
        <MediaLibrary
          api={api}
          session={session}
          onSelect={(item) => {
            change("imageId", item.id);
            setChooseImage(false);
            heading.current?.focus();
          }}
        />
      )}
      <section className="workspace-panel" data-tour="content-publication">
        <h3>Publication</h3>
        <p>
          Builds use saved revisions and require Baaba's reviewed deployment
          workflow. A pending or building request is not live.
        </p>
        {!canPublish && (
          <p>Only an Owner can request publication, unpublishing or retries.</p>
        )}
        <div className="editor-actions">
          <Button
            type="button"
            disabled={!canPublish || state.loading || dirty || !version}
            onClick={() => publication("publish")}
          >
            Request publication
          </Button>
          <Button
            type="button"
            disabled={!canPublish || state.loading || dirty || !version}
            onClick={() => publication("unpublish")}
          >
            Request unpublish
          </Button>
          <Button
            type="button"
            disabled={state.loading}
            onClick={() => publication("refresh")}
          >
            Refresh publication status
          </Button>
        </div>
        <ul>
          {jobs.map((job, index) => (
            <li key={job.id}>
              {job.status} —{" "}
              {new Date(job.created_at).toLocaleString("en-GH", {
                timeZone: "Africa/Accra",
              })}
              {job.status === "failed" && index === 0 && (
                <Button
                  type="button"
                  disabled={!canPublish || state.loading}
                  onClick={() => publication("retry", job.id)}
                >
                  Retry failed publication
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
      {preview && (
        <section aria-label="Saved content preview">
          <h3>{preview.heading}</h3>
          <p className="preserve-lines">{preview.body}</p>
          {preview.entries.map((entry, index) => (
            <div key={index}>
              <h4>{entry.heading}</h4>
              <p>{entry.text}</p>
              {entry.attribution && <p>{entry.attribution}</p>}
            </div>
          ))}
          {(preview.articles || []).map((article) => (
            <article key={article.slug}>
              <h4>{article.title}</h4>
              <p>
                {article.date} · /journal/{article.slug}
              </p>
              <p>{article.excerpt}</p>
              <p className="preserve-lines">{article.body}</p>
            </article>
          ))}
          {(preview.footprint || []).length > 0 && (
            <ul>
              {preview.footprint.map((row) => (
                <li key={row.countryCode}>
                  {
                    countries.find(
                      (country) => country.code === row.countryCode,
                    )?.name
                  }
                  : {row.total} verified combined trips
                </li>
              ))}
            </ul>
          )}
          <p>This content preview does not reproduce the final page layout.</p>
        </section>
      )}
      <section className="workspace-panel">
        <h3>Revision history</h3>
        {history.length ? (
          <ol>
            {history.map((revision) => (
              <li key={revision.id}>
                Version {revision.version} —{" "}
                {new Date(revision.created_at).toLocaleString("en-GH", {
                  timeZone: "Africa/Accra",
                })}{" "}
                <Button
                  type="button"
                  disabled={state.loading}
                  onClick={() => revert(revision.id)}
                >
                  Restore version {revision.version}
                </Button>
              </li>
            ))}
          </ol>
        ) : (
          <p>No saved revisions.</p>
        )}
      </section>
    </section>
  );
}
