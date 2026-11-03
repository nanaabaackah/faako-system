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
import PackageEditor from "./PackageEditor.jsx";
import ExperienceEditor from "./ExperienceEditor.jsx";
import reviewDrafts from "../../../docs/apps/travel-with-ease/content-review-drafts.json";
import { createDraftAutosave } from "./draft-autosave.js";
import VisualPreview from "./VisualPreview.jsx";
import approvedRelease from "../../travel-with-ease-web/content/approved-public-release.json";
import { approvedEditorCopy } from "./approved-copy.js";

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
  "packages",
  "travel-tips",
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
  tips: [],
  packages: [],
  footprint: [],
  experienceCountries: [],
});

export default function WebsiteContent({ api, session, onDirtyChange, initialPage = "home" }) {
  const canPublish =
    session.user.permissions?.includes("content.publish") === true;
  const [page, setPage] = useState(initialPage);
  const [recordSlug, setRecordSlug] = useState("");
  const [body, setBody] = useState(emptyBody);
  const [version, setVersion] = useState(0);
  const [history, setHistory] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(null);
  const [visualPreview, setVisualPreview] = useState(null);
  const [editorView, setEditorView] = useState("editor");
  const [chooseImage, setChooseImage] = useState(false);
  const [tipImage, setTipImage] = useState(null);
  const [collectionImage, setCollectionImage] = useState(null);
  const [state, setState] = useState({ loading: true, error: "", message: "" });
  const [saveState, setSaveState] = useState({ status: "saved", dirty: false, error: "" });
  const writer = useRef(null);
  const bodyRef = useRef(body);
  const heading = useRef(null);
  useEffect(() => {
    if (!jobs.some(job => ["pending", "building", "deploying", "verifying"].includes(job.status))) return;
    let active = true;
    const timer = setTimeout(() => {
      void api.get("/api/agent/content/publication-jobs", { responseMode: "data" })
        .then(result => { if (active) setJobs(result.items); })
        .catch(() => { if (active) setState(current => ({ ...current, error: "Publication status could not be refreshed. Use Refresh publication status; do not submit another request." })); });
    }, 3000);
    return () => { active = false; clearTimeout(timer); };
  }, [api, jobs]);
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
    const autosave = createDraftAutosave({
      save: (draft, expectedVersion) => api.post(`/api/agent/content/${page}/draft`, {
        responseMode: "data", silent: true, json: { body: draft, expectedVersion },
        headers: { "X-CSRF-Token": session.csrfToken },
      }),
      read: async () => {
        try { return await api.get(`/api/agent/content/${page}`, { responseMode: "data" }); }
        catch (error) { if (error.status === 404) return { body: emptyBody(), version: 0 }; throw error; }
      },
      onState: result => { if (active) { setSaveState(result); setDirty(result.dirty); } },
      onSaved: (result, replace) => {
        if (!active) return;
        if (replace) { bodyRef.current = result.body; setBody(result.body); }
        setVersion(result.version);
        // A history refresh failure must not turn an acknowledged save into a
        // failed mutation or cause the same draft to be written again.
        void api.get(`/api/agent/content/${page}/revisions`, { responseMode: "data" })
          .then(value => { if (active) setHistory(value.items); }).catch(() => {});
      },
    });
    writer.current = autosave;
    async function load() {
      setState({ loading: true, error: "", message: "" });
      setPreview(null);
      setVisualPreview(null);
      setRecordSlug("");
      setEditorView("editor");
      setChooseImage(false);
      setTipImage(null);
      setCollectionImage(null);
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
        const draft = { ...emptyBody(), ...item?.body };
        bodyRef.current = draft;
        setBody(draft);
        setVersion(item?.version || 0);
        autosave.reset(draft, item?.version || 0);
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
      autosave.dispose();
      if (writer.current === autosave) writer.current = null;
    };
  }, [api, page, session.csrfToken]);
  const change = (key, value) => {
    if (["packages", "articles"].includes(key)) {
      setChooseImage(false);
      setCollectionImage(null);
    }
    const next = { ...bodyRef.current, [key]: value };
    bodyRef.current = next;
    setBody(next);
    writer.current?.edit(next);
    setPreview(null);
    setVisualPreview(null);
    setEditorView("editor");
  };
  async function save(event) {
    event.preventDefault();
    await writer.current?.flush();
  }
  async function showPreview() {
    setState({ loading: true, error: "", message: "" });
    try {
      const item = await api.get(`/api/agent/content/${page}/preview`, {
        responseMode: "data",
      });
      setPreview(item.body);
      if (!session.demo) setVisualPreview(await api.post(`/api/agent/content/${page}/visual-preview`, {
        responseMode: "data", json: { expectedVersion: version },
        headers: { "X-CSRF-Token": session.csrfToken },
      }));
      if (!session.demo) setEditorView("preview");
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
      bodyRef.current = result.body;
      writer.current?.reset(result.body, result.version);
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
            ...(id ? {} : { json: { expectedVersion: version, ...(recordSlug ? { recordSlug } : {}) } }),
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
      {visualPreview && <div className="cms-editor-view-switch" aria-label="Editing view">
        <Button type="button" aria-pressed={editorView === "editor"} onClick={() => setEditorView("editor")}>Editor</Button>
        <Button type="button" aria-pressed={editorView === "preview"} onClick={() => setEditorView("preview")}>Website preview</Button>
      </div>}
      <div className={`cms-editing-layout${visualPreview ? " cms-editing-layout--with-preview" : ""}`} data-view={editorView}>
      <div className="cms-editing-layout__fields">
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
      {saveState.error && <InlineNotice tone="danger" title="Draft not saved" message={saveState.error} />}
      <p role="status" aria-live="polite" className="draft-save-status">
        {saveState.status === "saving" ? "Saving…" : saveState.status === "error" ? "Error — unsaved edits retained" : dirty ? "Unsaved" : `Saved · version ${version}`}
        {" · Drafts are never published automatically by autosave."}
      </p>
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
      {(approvedRelease.pages[page] || reviewDrafts[page]) && (
        <section className="workspace-panel">
          <h3>{approvedRelease.pages[page] ? "Approved company copy" : "Starter copy for review"}</h3>
          <p>
            {approvedRelease.pages[page] ? "Load the approved November 1 company content into this draft. This replaces selected text, not the public website. Re-select any managed R2 images before publication." : "Load the company-based draft to edit it here. Resolve its review requirements before publication."}
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
              const draft = { ...emptyBody(), ...(approvedRelease.pages[page] ? approvedEditorCopy(approvedRelease.pages[page]) : structuredClone(reviewDrafts[page])) };
              bodyRef.current = draft;
              setBody(draft);
              writer.current?.edit(draft);
              setPreview(null);
            }}
          >
            {approvedRelease.pages[page] ? "Load approved copy" : "Load review draft"}
          </Button>
        </section>
      )}
      <form data-tour="content-draft" onSubmit={save}>
        <fieldset disabled={state.loading || !session.user.permissions?.includes("content.write")}>
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
                <option value="/packages">Packages</option>
                <option value="/journal">Journal</option>
                <option value="/travel-tips">Travel tips</option>
                <option value="/contact">Contact</option>
                <option value="/how-it-works">How it works</option>
                <option value="/travel-footprint">Travel footprint</option>
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
          {page === "packages" && (
            <PackageEditor
              items={body.packages}
              onChange={(items) => {
                change("packages", items);
                setChooseImage(false);
              }}
              onChooseImage={(index, gallery) => {
                setTipImage(null);
                setCollectionImage({ collection: "packages", index, gallery });
                setChooseImage(true);
              }}
            />
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
                  <TextField
                    label="Article category"
                    value={article.category || ""}
                    maxLength={80}
                    onChange={(event) =>
                      change(
                        "articles",
                        body.articles.map((item, i) =>
                          i === index
                            ? { ...item, category: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <TextField
                    label="Approved author (optional)"
                    value={article.author || ""}
                    maxLength={120}
                    onChange={(event) =>
                      change(
                        "articles",
                        body.articles.map((item, i) =>
                          i === index
                            ? { ...item, author: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      setTipImage(null);
                      setCollectionImage({
                        collection: "articles",
                        index,
                        gallery: false,
                      });
                      setChooseImage(true);
                    }}
                  >
                    Choose article image
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setTipImage(null);
                      setCollectionImage({
                        collection: "articles",
                        index,
                        gallery: true,
                      });
                      setChooseImage(true);
                    }}
                  >
                    Add article gallery image
                  </Button>
                  <Button
                    type="button"
                    onClick={() =>
                      change(
                        "articles",
                        body.articles.map((item, i) =>
                          i === index
                            ? { ...item, imageId: null, galleryImageIds: [] }
                            : item,
                        ),
                      )
                    }
                  >
                    Clear article images
                  </Button>
                  <TextareaField
                    label="Related package URL names — one per line"
                    value={(article.relatedPackageSlugs || []).join("\n")}
                    onChange={(event) =>
                      change(
                        "articles",
                        body.articles.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                relatedPackageSlugs:
                                  event.target.value === ""
                                    ? []
                                    : event.target.value.split("\n"),
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
                    {
                      title: "",
                      slug: "",
                      excerpt: "",
                      body: "",
                      date: "",
                      category: "Travel stories",
                      author: "",
                      imageId: null,
                      galleryImageIds: [],
                      relatedPackageSlugs: [],
                    },
                  ])
                }
              >
                Add article
              </Button>
            </section>
          )}
          {page === "travel-tips" && (
            <section aria-label="Travel tips">
              <h3>Travel tips</h3>
              <p>
                Save and preview this collection before requesting publication.
                All tips in the saved collection are published together.
                Removing a tip and publishing withdraws it.
              </p>
              {body.tips.map((tip, index) => (
                <fieldset key={index}>
                  <legend>Tip {index + 1}</legend>
                  {[
                    ["title", "Tip title", 120],
                    ["slug", "Tip URL name", 80],
                    ["excerpt", "Tip summary", 240],
                    ["body", "Tip text", 6000],
                    [
                      "relatedArticle",
                      "Related published Journal URL name (optional)",
                      80,
                    ],
                  ].map(([key, label, max]) => (
                    <TextareaField
                      key={key}
                      label={label}
                      value={tip[key]}
                      maxLength={max}
                      required={key !== "relatedArticle"}
                      onChange={(event) =>
                        change(
                          "tips",
                          body.tips.map((item, i) =>
                            i === index
                              ? { ...item, [key]: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  ))}
                  <SelectField
                    label="Tip category"
                    value={tip.category}
                    onChange={(event) =>
                      change(
                        "tips",
                        body.tips.map((item, i) =>
                          i === index
                            ? { ...item, category: event.target.value }
                            : item,
                        ),
                      )
                    }
                  >
                    {[
                      "Before You Go",
                      "Packing Smart",
                      "Airport Guides",
                      "Travel Documents",
                      "Destination Preparation",
                      "Safety and Practical Advice",
                    ].map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </SelectField>
                  <SelectField
                    label="Homepage placement"
                    value={String(tip.featured)}
                    onChange={(event) =>
                      change(
                        "tips",
                        body.tips.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                featured: event.target.value === "true",
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    <option value="true">Featured candidate</option>
                    <option value="false">Supporting tip</option>
                  </SelectField>
                  <TextField
                    label="Tip display order"
                    type="number"
                    min="0"
                    max="999"
                    step="1"
                    required
                    value={tip.order}
                    onChange={(event) =>
                      change(
                        "tips",
                        body.tips.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                order:
                                  event.target.value === ""
                                    ? ""
                                    : Number(event.target.value),
                              }
                            : item,
                        ),
                      )
                    }
                  />
                  <p>
                    {tip.imageId
                      ? "Approved library image selected."
                      : "No image selected."}
                  </p>
                  <Button
                    type="button"
                    onClick={() => {
                      setTipImage(index);
                      setCollectionImage(null);
                      setChooseImage(true);
                    }}
                  >
                    Choose tip image
                  </Button>
                  <Button
                    type="button"
                    onClick={() =>
                      change(
                        "tips",
                        body.tips.map((item, i) =>
                          i === index ? { ...item, imageId: null } : item,
                        ),
                      )
                    }
                  >
                    Remove tip image
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setChooseImage(false);
                      setTipImage(null);
                      change(
                        "tips",
                        body.tips.filter((_, i) => i !== index),
                      );
                    }}
                  >
                    Remove tip {index + 1}
                  </Button>
                </fieldset>
              ))}
              <Button
                type="button"
                disabled={body.tips.length >= 30}
                onClick={() =>
                  change("tips", [
                    ...body.tips,
                    {
                      title: "",
                      slug: "",
                      excerpt: "",
                      body: "",
                      category: "Before You Go",
                      featured: false,
                      order: body.tips.length,
                      imageId: null,
                      relatedArticle: "",
                    },
                  ])
                }
              >
                Add tip
              </Button>
            </section>
          )}
          {page === "travel-footprint" && (
            <ExperienceEditor items={body.experienceCountries || []}
              onChange={items => change("experienceCountries", items)} />
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
          {!["packages", "journal", "travel-tips", "travel-footprint"].includes(
            page,
          ) && (
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
        onClick={() => {
          setTipImage(null);
          setCollectionImage(null);
          setChooseImage((current) => !current);
        }}
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
            if (collectionImage) {
              const { collection, index, gallery } = collectionImage;
              change(
                collection,
                body[collection].map((record, i) =>
                  i === index
                    ? {
                        ...record,
                        ...(gallery
                          ? {
                              galleryImageIds: [
                                ...new Set([
                                  ...(record.galleryImageIds || []),
                                  item.id,
                                ]),
                              ],
                            }
                          : { imageId: item.id }),
                      }
                    : record,
                ),
              );
            } else if (tipImage === null) change("imageId", item.id);
            else
              change(
                "tips",
                body.tips.map((tip, i) =>
                  i === tipImage ? { ...tip, imageId: item.id } : tip,
                ),
              );
            setTipImage(null);
            setCollectionImage(null);
            setChooseImage(false);
            heading.current?.focus();
          }}
        />
      )}
      <section className="workspace-panel" data-tour="content-publication">
        <h3>Publication</h3>
        <p>
          Publishing uses saved revisions and the environment's reviewed source.
          Pending, building, deploying and verifying requests are not live.
        </p>
        {!canPublish && (
          <p>Only an Owner or Superadmin can publish, unpublish or retry.</p>
        )}
        {["packages", "journal", "travel-tips"].includes(page) && <SelectField
          label="Publication scope" value={recordSlug} disabled={state.loading || dirty}
          onChange={event => setRecordSlug(event.target.value)}>
          <option value="">Whole collection (all saved records)</option>
          {(page === "packages" ? body.packages : page === "journal" ? body.articles : body.tips).map(record => <option key={record.slug} value={record.slug}>{record.title} only</option>)}
        </SelectField>}
        <div className="editor-actions">
          <Button
            type="button"
            disabled={!canPublish || state.loading || dirty || !version}
            onClick={() => publication("publish")}
          >
            {import.meta.env.MODE === "staging" ? "Publish to staging" : "Publish saved changes"}
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
              {job.environment && `${job.environment} · `}
              {job.target && `${job.target.page}${job.target.recordSlug ? "/" + job.target.recordSlug : ""} · version ${job.target.version} · `}
              {new Date(job.created_at).toLocaleString("en-GH", {
                timeZone: "Africa/Accra",
              })}
              {job.deployment_id && <span> · Deployment {job.deployment_id}</span>}
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
      {preview && !visualPreview && (
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
          {(preview.packages || []).map((item) => (
            <article key={item.id}>
              <h4>{item.title}</h4>
              <p>
                {item.destination} · /packages/{item.slug}
              </p>
              <p>{item.overview}</p>
            </article>
          ))}
          {(preview.tips || []).map((tip) => (
            <article key={tip.slug}>
              <h4>{tip.title}</h4>
              <p>
                {tip.category} · /travel-tips/{tip.slug}
              </p>
              <p>{tip.excerpt}</p>
              <p className="preserve-lines">{tip.body}</p>
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
      </div>
      {visualPreview && preview && <VisualPreview key={visualPreview.id} job={visualPreview} api={api} body={preview} />}
      </div>
    </section>
  );
}
