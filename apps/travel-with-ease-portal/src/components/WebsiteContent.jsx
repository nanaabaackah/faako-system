import Button from "./ActionButton.jsx";
import { useEffect, useRef, useState } from "react";
import {
  SelectField,
  TextField,
  TextareaField,
  DateField,
  InlineNotice,
  AnimatedLoadingState,
  ERPConfirmDialog,
  ERPModal,
  useToast,
} from "@faako/ui";
import MediaLibrary from "./MediaLibrary.jsx";
import BrandAppearance from "./BrandAppearance.jsx";
import PackageEditor from "./PackageEditor.jsx";
import ExperienceEditor from "./ExperienceEditor.jsx";
import reviewDrafts from "../../../../docs/apps/travel-with-ease/content-review-drafts.json";
import { createDraftAutosave } from "../lib/draft-autosave.js";
import VisualPreview from "./VisualPreview.jsx";
import ImagePlacements from './ImagePlacements.jsx';
import { ActivityList } from './ActivityView.jsx';
import GalleryOrder from './GalleryOrder.jsx';
import approvedRelease from "../../../travel-with-ease-web/content/approved-public-release.json";
import { approvedEditorCopy } from "../lib/approved-copy.js";
import { serviceSlug } from "../../../travel-with-ease-api/src/content/catalogue-constants.js";
import { withUpdatedPackageFlow } from "../../../travel-with-ease-api/src/content/process-flow.js";
import EditorialFields from "./EditorialFields.jsx";
import { editorialFields } from "../../../travel-with-ease-api/src/content/editorial-fields.js";

import countryOptions from "../../../travel-with-ease-web/src/lib/footprint-countries.json";
const countries = [...countryOptions].sort((a, b) =>
  a.name.localeCompare(b.name),
);
const pages = [
  "home",
  "about",
  "services",
  "how-it-works",
  "faqs",
  "contact",
  "journal",
  "travel-tips",
  "packages",
  "travel-footprint",
  "privacy",
  "terms",
  "cookies",
  'site-appearance',
  'footer',
];
const sentenceCase = (value = "") => {
  const words = value.replaceAll("_", " ").replaceAll("-", " ");
  return words ? words[0].toUpperCase() + words.slice(1) : words;
};
const sectionLabel = (name) =>
  name === "site-appearance" ? "Brand & appearance" : sentenceCase(name);
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
  footerLinks: [],
  articles: [],
  tips: [],
  packages: [],
  footprint: [],
  experienceCountries: [],
  imagePlacements:{},
  editorialCopy: {},
});

export default function WebsiteContent({ api, session, onDirtyChange, initialPage = "home" }) {
  const { pushToast } = useToast();
  const canPublish =
    session.user.permissions?.includes("content.publish") === true;
  // Testimonials are edited as the homepage review section. Travel Tips retain
  // their own collection and must not be silently redirected to Journal.
  const [page, setPage] = useState(initialPage === "testimonials" ? "home" : initialPage);
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
  const [publicationBusy, setPublicationBusy] = useState(false);
  const [publicationProgressOpen, setPublicationProgressOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const lastPublicationState = useRef("");
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
  const activePublication = jobs.find(job => ["pending", "building", "deploying", "verifying"].includes(job.status));
  useEffect(() => {
    const latest = jobs[0];
    if (!latest || latest.status === lastPublicationState.current) return;
    const previous = lastPublicationState.current;
    lastPublicationState.current = latest.status;
    if (!previous) return;
    if (latest.status === "live") pushToast({ id: `publication-${latest.id}`, tone: "success", title: "Website published", message: "The deployment was verified successfully." });
    if (latest.status === "failed") pushToast({ id: `publication-${latest.id}`, tone: "error", title: "Publication failed", message: "Open publication history for the failure details and permitted retry action." });
  }, [jobs, pushToast]);
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
        let inheritedFooter = null;
        if (page === "footer" && !item) {
          const [legacyAppearance, legacyContact] = await Promise.all([
            api.get("/api/agent/content/site-appearance", { responseMode: "data" }).catch(() => null),
            api.get("/api/agent/content/contact", { responseMode: "data" }).catch(() => null),
          ]);
          const footerKeys = new Set((editorialFields.footer || []).map(([key]) => key));
          inheritedFooter = {
            heading: "Travel With Ease",
            body: "",
            seoTitle: "Website footer",
            seoDescription: "Footer contact, navigation and business information.",
            contactEmail: legacyContact?.body?.contactEmail || "",
            contactPhone: legacyContact?.body?.contactPhone || "",
            branding: { footerLogoId: legacyAppearance?.body?.branding?.footerLogoId || null },
            imagePlacements: legacyAppearance?.body?.imagePlacements?.["footer-background"] ? { "footer-background": legacyAppearance.body.imagePlacements["footer-background"] } : {},
            editorialCopy: Object.fromEntries(Object.entries(legacyAppearance?.body?.editorialCopy || {}).filter(([key]) => footerKeys.has(key))),
          };
        }
        const draft = { ...emptyBody(), ...(!item && inheritedFooter ? inheritedFooter : !item && approvedRelease.pages[page] ? approvedEditorCopy(approvedRelease.pages[page]) : item?.body) };
        if (page === "how-it-works" && draft.processFlows) draft.processFlows = withUpdatedPackageFlow(draft.processFlows);
        draft.entries=draft.entries.map(entry=>({...entry,id:entry.id||crypto.randomUUID(),...(page==="services" && !entry.serviceSlug && serviceSlug(entry.heading) ? {serviceSlug:serviceSlug(entry.heading)} : {})}));
        if(page==="home"&&!draft.ctaLabel)draft.ctaLabel="Plan your trip";
        if(page==='site-appearance'&&!item){draft.heading='Shared website imagery';draft.seoTitle='Website appearance';draft.seoDescription='Internal shared imagery settings.';}
        if(page==='footer'&&!item){draft.heading='Travel With Ease';draft.body='';draft.seoTitle='Website footer';draft.seoDescription='Footer contact, navigation and business information.';}
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
    if(key==='entries')value=value.map(entry=>({...entry,id:entry.id||crypto.randomUUID(),...(page==="services" && !entry.serviceSlug && serviceSlug(entry.heading) && entry.text.trim() ? {serviceSlug:serviceSlug(entry.heading)} : {})}));
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
    const saved = await writer.current?.flush();
    if (saved) pushToast({ tone: "success", title: "Draft saved", message: `Version ${version + (dirty ? 1 : 0)} is saved.` });
  }
  async function showPreview() {
    setState({ loading: true, error: "", message: "" });
    try {
      const item = await api.get(`/api/agent/content/${page}/preview`, {
        responseMode: "data",
      });
      setPreview(item.body);
      setVisualPreview(await api.post(`/api/agent/content/${page}/visual-preview`, {
        responseMode: "data", json: { expectedVersion: version },
        headers: { "X-CSRF-Token": session.csrfToken },
      }));
      setEditorView("preview");
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
    setPublicationBusy(true);
    setState(current => ({ ...current, error: "", message: "" }));
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
      if (action !== "refresh") setPublicationProgressOpen(true);
      setState({
        loading: false,
        error: "",
        message:
          action === "refresh"
            ? "Publication status refreshed."
            : "Request queued. The site changes only after a successful deployment is verified.",
      });
      if (action === "refresh") pushToast({ tone: "success", title: "Publication status refreshed", message: "The latest worker status is now shown." });
    } catch (error) {
      setState(current => ({ ...current, error: error.message, message: "" }));
    } finally {
      setPublicationBusy(false);
    }
  }

  async function cancelStalePublication(job) {
    setPublicationBusy(true);
    setState(current => ({ ...current, error: "", message: "" }));
    try {
      await api.post(`/api/agent/content/publication-jobs/${job.id}/cancel`, {
        responseMode: "data",
        headers: { "X-CSRF-Token": session.csrfToken },
      });
      const result = await api.get("/api/agent/content/publication-jobs", { responseMode: "data" });
      setJobs(result.items);
      setState(current => ({ ...current, error: "", message: "Pending publication cancelled. Your saved drafts are unchanged." }));
      pushToast({ tone: "success", title: "Publication cancelled", message: "Your saved drafts are unchanged." });
    } catch (error) {
      setState(current => ({ ...current, error: error.message, message: "" }));
    } finally {
      setPublicationBusy(false);
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
            const nextPage = event.target.value;
            // Reselecting the active section is a no-op. Otherwise we'd mark
            // the editor loading without a page change to trigger a fresh load.
            if (nextPage === page) return;
            if (!dirty) {
              // Close the gap between changing the section and its load effect.
              // Otherwise stale fields remain editable for one render, and an
              // approved-copy click can send the new section into the old writer.
              setState({ loading: true, error: "", message: "" });
              setPage(nextPage);
            } else {
              setConfirmAction({ kind: "discard", title: "Discard unsaved changes?", message: `Switch to ${sectionLabel(nextPage)} and discard the edits currently in this form?`, label: "Discard and switch", run: () => { setState({ loading: true, error: "", message: "" }); setPage(nextPage); } });
            }
          }}
        >
          {pages.map((name) => (
            <option key={name} value={name}>
              {sectionLabel(name)}
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
        state.message && <p role="status">{state.message}</p>
      )}
      {(approvedRelease.pages[page] || reviewDrafts[page]) && (
        <section className="workspace-panel">
          <h3>{approvedRelease.pages[page] ? "Approved company copy" : "Starter copy for review"}</h3>
          <p>
            {approvedRelease.pages[page] ? "Replace this draft with the approved website copy." : "Load the review draft into the editor."}
          </p>
          <Button
            type="button"
            disabled={state.loading}
            onClick={() => {
              const replace = () => {
                const draft = { ...emptyBody(), ...(approvedRelease.pages[page] ? approvedEditorCopy(approvedRelease.pages[page]) : structuredClone(reviewDrafts[page])) };
                bodyRef.current = draft;
                setBody(draft);
                writer.current?.edit(draft);
                setPreview(null);
              };
              if (dirty) setConfirmAction({ kind: "replace", title: "Replace unsaved edits?", message: "The current unsaved fields will be replaced by the approved review copy.", label: "Replace edits", run: replace });
              else replace();
            }}
          >
            {approvedRelease.pages[page] ? (page === "how-it-works" ? "Load updated client-approved flow" : "Load approved copy") : "Load review draft"}
          </Button>
        </section>
      )}
      {!state.loading && page==='site-appearance' && <BrandAppearance branding={body.branding} change={change} api={api} session={session}
        disabled={!session.user.permissions?.includes("content.write") || state.loading}/>}
      {!state.loading && page==='footer' && <BrandAppearance branding={body.branding} change={change} api={api} session={session}
        assetKeys={['footerLogoId']} showFonts={false} disabled={!session.user.permissions?.includes("content.write") || state.loading}/>}
      {!state.loading&&<ImagePlacements key={page} page={page} body={body} change={change} api={api} session={session}/>}
      {page==='site-appearance'&&<form onSubmit={save}><fieldset disabled={state.loading || !session.user.permissions?.includes("content.write")}><EditorialFields page={page} body={body} change={change}/><div className="editor-actions"><Button icon="save" type="submit">Save draft</Button><Button icon="preview" type="button" disabled={!version||dirty} onClick={showPreview}>Preview saved content</Button></div></fieldset></form>}
      {page!=='site-appearance'&&<form data-tour="content-draft" onSubmit={save}>
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
          {page !== "site-appearance" && <EditorialFields page={page} body={body} change={change} />}
          {page === "home" && (
            <>
              <TextField
                label="Hero · primary button"
                value={body.ctaLabel}
                maxLength={60}
                onChange={(e) => change("ctaLabel", e.target.value)}
              />
              <SelectField
                label="Hero · primary destination"
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
          {page === "footer" && (
            <>
              <h3>Contact information</h3>
              <TextField label="Business email address" type="email" value={body.contactEmail} onChange={(e) => change("contactEmail", e.target.value)} />
              <TextField label="Business phone number" type="tel" value={body.contactPhone} maxLength={40} onChange={(e) => change("contactPhone", e.target.value)} />
              <h3>Navigation, social media and legal links</h3>
              {[...(body.footerLinks || [])].sort((a,b)=>a.order-b.order).map((link, index) => <fieldset key={link.id}>
                <legend>Footer link {index + 1}</legend>
                <SelectField label="Group" value={link.group} onChange={event => change("footerLinks", body.footerLinks.map(item => item.id === link.id ? {...item, group:event.target.value} : item))}>
                  <option value="explore">Explore</option><option value="social">Social media</option><option value="contact">Contact</option><option value="legal">Legal information</option>
                </SelectField>
                <TextField label="Link label" value={link.label} maxLength={120} onChange={event => change("footerLinks", body.footerLinks.map(item => item.id === link.id ? {...item, label:event.target.value} : item))}/>
                <TextField label="Link destination" value={link.href} maxLength={500} onChange={event => change("footerLinks", body.footerLinks.map(item => item.id === link.id ? {...item, href:event.target.value} : item))}/>
                <label><input type="checkbox" checked={link.visible} onChange={event => change("footerLinks", body.footerLinks.map(item => item.id === link.id ? {...item, visible:event.target.checked} : item))}/> Show this link</label>
                <Button type="button" disabled={index === 0} onClick={() => { const items=[...body.footerLinks].sort((a,b)=>a.order-b.order); [items[index-1],items[index]]=[items[index],items[index-1]]; change("footerLinks", items.map((item,order)=>({...item,order}))); }}>Move up</Button>
                <Button type="button" disabled={index === body.footerLinks.length - 1} onClick={() => { const items=[...body.footerLinks].sort((a,b)=>a.order-b.order); [items[index],items[index+1]]=[items[index+1],items[index]]; change("footerLinks", items.map((item,order)=>({...item,order}))); }}>Move down</Button>
                <Button type="button" onClick={() => change("footerLinks", body.footerLinks.filter(item => item.id !== link.id))}>Remove link</Button>
              </fieldset>)}
              <Button type="button" onClick={() => change("footerLinks", [...body.footerLinks, {id:crypto.randomUUID(), group:"explore", label:"", href:"/", visible:true, order:body.footerLinks.length}])}>Add footer link</Button>
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
                Edit each article, assign its series and choose where it appears.
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
                  <SelectField
                    label="Travel tip series"
                    value={article.series || ""}
                    onChange={(event) => change("articles", body.articles.map((item, i) =>
                      i === index ? { ...item, series: event.target.value } : item
                    ))}
                  >
                    <option value="">No series (Trip story)</option>
                    <option value="Before you fly">Before you fly</option>
                    <option value="Visas and entry">Visas and entry</option>
                    <option value="Destinations">Destinations</option>
                  </SelectField>
                  <SelectField
                    label="Featured story on the Journal page"
                    value={article.featuredOnJournal ? "yes" : "no"}
                    onChange={(event) => change("articles", body.articles.map((item, i) =>
                      i === index ? { ...item, featuredOnJournal: event.target.value === "yes" } :
                        event.target.value === "yes" ? { ...item, featuredOnJournal: false } : item
                    ))}
                    options={[
                      { value: "no", label: "Standard story" },
                      { value: "yes", label: "Featured lead story" },
                    ]}
                  />
                  <SelectField
                    label="Homepage Before you go placement"
                    value={String(article.homeTipOrder || 0)}
                    onChange={(event) => change("articles", body.articles.map((item, i) =>
                      i === index ? { ...item, homeTipOrder: event.target.value === "0" ? undefined : Number(event.target.value) } : item
                    ))}
                  >
                    <option value="0">Not on homepage</option>
                    <option value="1">First card</option>
                    <option value="2">Second card</option>
                    <option value="3">Third card</option>
                  </SelectField>
                  <TextField
                    label="Website CTA button text (optional)"
                    value={article.ctaLabel || ""}
                    maxLength={60}
                    onChange={(event) => change("articles", body.articles.map((item, i) =>
                      i === index ? { ...item, ctaLabel: event.target.value } : item
                    ))}
                  />
                  <SelectField
                    label="Website CTA destination"
                    value={article.ctaPath || ""}
                    onChange={(event) => change("articles", body.articles.map((item, i) =>
                      i === index ? { ...item, ctaPath: event.target.value } : item
                    ))}
                  >
                    <option value="">No CTA</option>
                    <option value="/#plan">Trip enquiry form</option>
                    <option value="/services/travel-readiness-session">Travel Readiness Session</option>
                    <option value="/packages/nairobi">Nairobi package</option>
                    <option value="/packages">Explore packages</option>
                  </SelectField>
                  <TextareaField
                    label="Related Journal article URL names (one per line)"
                    value={(article.relatedArticleSlugs || []).join("\n")}
                    onChange={(event) => change("articles", body.articles.map((item, i) =>
                      i === index ? {
                        ...item,
                        relatedArticleSlugs: event.target.value.trim() ? event.target.value.split("\n").map(s => s.trim()).filter(Boolean) : []
                      } : item
                    ))}
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
                  <GalleryOrder ids={article.galleryImageIds} onChange={ids=>change("articles",body.articles.map((item,i)=>i===index?{...item,galleryImageIds:ids,retainApprovedGallery:false}:item))}/>
                  <Button
                    type="button"
                    onClick={() =>
                      change(
                        "articles",
                        body.articles.map((item, i) =>
                          i === index
                            ? { ...item, imageId: null, galleryImageIds: [], retainApprovedGallery: false, retainApprovedImage: false, imagePlacement: undefined }
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
                      category: "Travel tip",
                      series: "Before you fly",
                      homeTipOrder: undefined,
                      featuredOnJournal: false,
                      ctaLabel: "",
                      ctaPath: "",
                      relatedArticleSlugs: [],
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
                      <option key={category} value={category}>{category}</option>
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
                Enter confirmed trips by country. Count Zanzibar under Tanzania.
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
          {page === "how-it-works" && (
            <section className="workspace-panel" aria-label="How It Works booking paths">
              <h3>Booking a package / Planning a trip with us</h3>
              <p>Edit five package-booking steps or four planning steps. Each path also has a separate four-stage example.</p>
              {(["package", "planning"]).map((flowKey) => {
                const flows = withUpdatedPackageFlow(body.processFlows || approvedRelease.pages["how-it-works"].processFlows);
                const flow = flows[flowKey];
                return <fieldset key={flowKey}>
                  <legend>{flowKey === "package" ? "Booking a package" : "Planning a trip with us"}</legend>
                  {flow.steps.map((step, index) => (
                    <fieldset key={index}>
                      <legend>Step {index + 1}</legend>
                      <TextField
                        label="Step heading"
                        value={step.heading}
                        maxLength={160}
                        required
                        onChange={(event) => change("processFlows", {
                          ...flows,
                          [flowKey]: { ...flow, steps: flow.steps.map((item, i) => i === index ? { ...item, heading: event.target.value } : item) },
                        })}
                      />
                      <TextareaField
                        label="Step instructions"
                        value={step.text}
                        maxLength={2000}
                        required
                        onChange={(event) => change("processFlows", {
                          ...flows,
                          [flowKey]: { ...flow, steps: flow.steps.map((item, i) => i === index ? { ...item, text: event.target.value } : item) },
                        })}
                      />
                    </fieldset>
                  ))}
                  <TextareaField
                    label="Example introduction"
                    value={flow.example}
                    maxLength={2500}
                    required
                    onChange={(event) => change("processFlows", {
                      ...flows,
                      [flowKey]: { ...flow, example: event.target.value },
                    })}
                  />
                  <fieldset>
                    <legend>Worked example — four stages</legend>
                    {(flow.exampleSteps || approvedRelease.pages["how-it-works"].processFlows[flowKey].exampleSteps).map((step, index) => (
                      <fieldset key={index}>
                        <legend>Example stage {index + 1}</legend>
                        <TextField
                          label="Stage heading"
                          value={step.heading}
                          maxLength={160}
                          required
                          onChange={(event) => change("processFlows", {
                            ...flows,
                            [flowKey]: {
                              ...flow,
                              exampleSteps: (flow.exampleSteps || approvedRelease.pages["how-it-works"].processFlows[flowKey].exampleSteps)
                                .map((item, i) => i === index ? { ...item, heading: event.target.value } : item),
                            },
                          })}
                        />
                        <TextareaField
                          label="Stage description"
                          value={step.text}
                          maxLength={2000}
                          required
                          onChange={(event) => change("processFlows", {
                            ...flows,
                            [flowKey]: {
                              ...flow,
                              exampleSteps: (flow.exampleSteps || approvedRelease.pages["how-it-works"].processFlows[flowKey].exampleSteps)
                                .map((item, i) => i === index ? { ...item, text: event.target.value } : item),
                            },
                          })}
                        />
                      </fieldset>
                    ))}
                  </fieldset>
                  <p>{flowKey === "package" ? "Terms: Section B · Package bookings" : "Terms: Section A · Planning services"}</p>
                </fieldset>;
              })}
            </section>
          )}
          {!["packages", "journal", "travel-tips", "how-it-works"].includes(
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
      </form>}
      <p>
        {body.imageId ? "Image selected" : "No image selected"}
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
                              retainApprovedGallery: false,
                              galleryImageIds: [
                                ...new Set([
                                  ...(record.galleryImageIds || []),
                                  item.id,
                                ]),
                              ],
                            }
                          : { imageId: item.id, retainApprovedImage: false }),
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
          Your update is live only after deployment succeeds.
        </p>
        {["packages", "journal", "travel-tips"].includes(page) && <SelectField
          label="Publication scope" value={recordSlug} disabled={state.loading || dirty}
          onChange={event => setRecordSlug(event.target.value)}>
          <option value="">Whole collection (all saved records)</option>
          {(page === "packages" ? body.packages : page === "journal" ? body.articles : body.tips).map(record => <option key={record.slug} value={record.slug}>{record.title} only</option>)}
        </SelectField>}
        <div className="editor-actions">
          <Button
            type="button"
            loading={publicationBusy}
            loadingLabel="Requesting publication…"
            disabled={!canPublish || state.loading || publicationBusy || Boolean(activePublication) || dirty || !version}
            onClick={() => setConfirmAction({ kind: "publish", title: "Publish saved changes?", message: "This requests a website build using the saved content and currently approved code. The site changes only after deployment is verified.", label: import.meta.env.MODE === "staging" ? "Publish to staging" : "Publish saved changes", run: () => publication("publish") })}
          >
            {import.meta.env.MODE === "staging" ? "Publish to staging" : "Publish saved changes"}
          </Button>
          <Button
            type="button"
            disabled={!canPublish || state.loading || publicationBusy || Boolean(activePublication) || dirty || !version}
            onClick={() => setConfirmAction({ kind: "unpublish", title: "Request unpublish?", message: "This requests removal of the selected page or record in the next verified public build.", label: "Request unpublish", run: () => publication("unpublish") })}
          >
            Request unpublish
          </Button>
          <Button
            type="button"
            loading={publicationBusy}
            loadingLabel="Refreshing…"
            disabled={state.loading || publicationBusy}
            onClick={() => publication("refresh")}
          >
            Refresh publication status
          </Button>
        </div>
        <ActivityList title="Publication history" items={jobs.map(job=>({...job,action:`${job.status === 'failed' && job.last_error === 'cancelled_by_operator' ? 'cancelled' : job.status} · ${job.target?.page||'website'}`,record_id:job.deployment_id||job.id}))}
          renderAction={job=><>
            {job.environment&&<p>Environment: {job.environment}</p>}
            {job.trigger_type&&<p>Release trigger: {sentenceCase(job.trigger_type)}</p>}
            {['superadmin','platform_admin'].includes(session.user.role) && job.source_sha && <p>Code revision: <code>{job.source_sha.slice(0,12)}</code></p>}
            {job.deployment_id&&<p>Deployment verified: {job.status === 'live' ? 'Yes' : 'No'}</p>}
            {job.target&&<p>Saved version: {job.target.version}{job.target.recordSlug&&` · ${job.target.recordSlug}`}</p>}
            {job.status==='pending' && job.can_cancel === true && canPublish && <Button type="button" disabled={state.loading || publicationBusy} onClick={()=>setConfirmAction({ kind: "cancel", title: "Cancel pending publication?", message: "It will not deploy. Saved drafts and publication history will be preserved.", label: "Cancel publication", run: () => cancelStalePublication(job) })}>Cancel stale publication</Button>}
            {job.status==='failed'&&job.last_error!=='cancelled_by_operator'&&job.id===jobs[0]?.id&&<Button type="button" disabled={!canPublish||state.loading||publicationBusy} onClick={()=>setConfirmAction({ kind: "retry", title: "Retry failed publication?", message: "This retries the existing failed job without creating a duplicate publication request.", label: "Retry publication", run: () => publication('retry',job.id) })}>Retry failed publication</Button>}
          </>}/>
      </section>
      <ERPConfirmDialog open={Boolean(confirmAction)} title={confirmAction?.title} message={confirmAction?.message} confirmLabel={confirmAction?.label || "Confirm"} confirmTone={confirmAction?.kind === "cancel" || confirmAction?.kind === "unpublish" ? "danger" : "primary"} loading={publicationBusy} onCancel={() => setConfirmAction(null)} onConfirm={async () => { const action = confirmAction; setConfirmAction(null); await action?.run(); }} />
      <ERPModal open={publicationProgressOpen} title="Publication progress" description="You can close this window while publishing continues." onClose={() => setPublicationProgressOpen(false)} size="sm" footer={<Button type="button" onClick={() => setPublicationProgressOpen(false)}>Continue working</Button>}>
        <div className="publication-progress" role="status" aria-live="polite">
          <p><strong>{activePublication ? sentenceCase(activePublication.status) : jobs[0]?.status ? sentenceCase(jobs[0].status) : "Request accepted"}</strong></p>
          <progress value={activePublication ? ["pending", "building", "deploying", "verifying"].indexOf(activePublication.status) + 1 : jobs[0]?.status === "live" ? 4 : 0} max="4" />
          <p>{activePublication ? "The publication worker is processing the saved version." : jobs[0]?.status === "live" ? "Deployment verified successfully." : jobs[0]?.status === "failed" ? "Publication failed. Review the history before retrying." : "Waiting for the publication worker."}</p>
        </div>
      </ERPModal>
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
          <p>Text preview</p>
        </section>
      )}
      <section className="workspace-panel">
        <h3>Revision history</h3>
        <ActivityList title="Content revision history" items={history.map(revision=>({...revision,action:`Saved revision ${revision.version}`,actor_id:revision.editor_id,record_id:revision.id}))}
          renderAction={revision=><Button type="button" disabled={state.loading} onClick={()=>setConfirmAction({ kind: "restore", title: `Restore version ${revision.version}?`, message: "This creates a new draft from the selected revision. Nothing is published automatically.", label: "Restore version", run: () => revert(revision.id) })}>Restore version {revision.version}</Button>}/>
      </section>
      </div>
      {visualPreview && preview && <VisualPreview key={visualPreview.id} job={visualPreview} api={api} body={preview} />}
      </div>
    </section>
  );
}
