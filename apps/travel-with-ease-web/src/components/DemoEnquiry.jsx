import { useEffect, useMemo, useState } from "react";
import { createBrowserApiClient } from "@faako/api-client/browser";
import {
  // eslint-disable-next-line no-unused-vars -- JSX component
  Button,
  // eslint-disable-next-line no-unused-vars -- JSX component
  SelectField,
  // eslint-disable-next-line no-unused-vars -- JSX component
  UiSystemProvider,
  useToast,
  // eslint-disable-next-line no-unused-vars -- JSX component
  IconsaxIcon,
  // eslint-disable-next-line no-unused-vars -- JSX component
  AnimatedLoadingState,
} from "@faako/ui";
import "@faako/ui/twe-feedback.css";
import "../styles/components/demo-enquiry.css";
import appSystem from "../../appSystem.js";

// eslint-disable-next-line no-unused-vars -- JSX component
function EnquiryFields({ live = false, apiOrigin = "" }) {
  const { pushToast } = useToast();
  const api = useMemo(
    () =>
      live && apiOrigin ? createBrowserApiClient({ baseUrl: apiOrigin }) : null,
    [live, apiOrigin],
  );
  const [kind, setKind] = useState("personalised");
  const [destination, setDestination] = useState("Kenya");
  const [style, setStyle] = useState("A slower pace");
  const [travellers, setTravellers] = useState("2");
  const [contact, setContact] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
    consent: false,
    website: "",
  });
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(
    live
      ? "Your enquiry will be saved as a staging demo test, not a booking."
      : "Local preview only. Nothing will be submitted.",
  );
  useEffect(() => {
    setReady(true);
    const choose = (event) => {
      const link = event.target.closest?.("[data-demo-destination]");
      if (link) {
        setDestination(link.dataset.demoDestination);
        setKind("package");
      }
      if (event.target.closest?.("[data-demo-personalised]"))
        setKind("personalised");
    };
    document.addEventListener("click", choose);
    return () => document.removeEventListener("click", choose);
  }, []);

  const update = (event) => {
    const { name, type, checked, value } = event.target;
    setContact((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };
  const options = (values) => values.map((value) => ({ value, label: value }));
  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    if (!live) {
      pushToast({
        id: "demo-enquiry",
        tone: "success",
        title: "Demo preview ready",
        message: "Nothing was sent, saved or booked.",
      });
      setResult(
        `Demo ${kind} preview: ${destination}, ${style.toLowerCase()}, ${travellers} traveller(s). Nothing was sent or saved.`,
      );
      return;
    }
    if (!api) {
      setResult(
        "Staging enquiries are not configured. Please notify the website administrator.",
      );
      pushToast({
        id: "demo-enquiry",
        tone: "error",
        title: "Test enquiry unavailable",
        message: "Staging API is not configured.",
      });
      return;
    }
    setSubmitting(true);
    setResult("Saving your test enquiry to the staging inbox…");
    try {
      const data = await api.post("/api/public/demo-inquiries", {
        json: { kind, destination, travelStyle: style, travellers, ...contact },
        responseMode: "data",
        fallbackMessage: "The test enquiry could not be saved.",
      });
      if (
        !data?.demo ||
        data?.status !== "received" ||
        typeof data.inquiryId !== "string"
      ) {
        throw new Error(
          "The staging API did not confirm that your enquiry was saved.",
        );
      }
      setResult(
        `Staging test enquiry received. Reference: ${data.inquiryId.slice(0, 8).toUpperCase()}. It is visible to authorised staff in the staging Traveller inbox; it is not a booking.`,
      );
      pushToast({
        id: "demo-enquiry",
        tone: "success",
        title: "Test enquiry received",
        message:
          "Saved to the staging Traveller inbox. No booking or payment was made.",
      });
      setContact({
        name: "",
        email: "",
        phone: "",
        notes: "",
        consent: false,
        website: "",
      });
    } catch (error) {
      setResult(
        error?.message ||
          "The test enquiry could not be saved. Please try again.",
      );
      pushToast({
        id: "demo-enquiry",
        tone: "error",
        title: "Enquiry not saved",
        message: "Check the form and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="demo-enquiry-form" onSubmit={submit}>
      <h3>
        {kind === "package"
          ? "Sample package enquiry"
          : "Sample personalised enquiry"}
      </h3>
      {(!ready || submitting) && (
        <AnimatedLoadingState
          compact
          title={submitting ? "Saving test enquiry" : "Preparing enquiry form"}
          message={
            submitting
              ? "Waiting for staging confirmation. No booking or email is created."
              : "Loading the interactive controls."
          }
        />
      )}
      <SelectField
        label="Enquiry journey"
        value={kind}
        onChangeValue={setKind}
        options={[
          { value: "personalised", label: "Personalised trip" },
          { value: "package", label: "Package enquiry" },
        ]}
      />
      <SelectField
        label="Sample destination"
        value={destination}
        onChangeValue={setDestination}
        options={options(["Kenya", "Zanzibar", "Help me choose"])}
      />
      <SelectField
        label="Travel style"
        value={style}
        onChangeValue={setStyle}
        options={options([
          "A slower pace",
          "Discovery and culture",
          "A little of both",
        ])}
      />
      <SelectField
        label="Number of travellers"
        value={travellers}
        onChangeValue={setTravellers}
        options={options(["1", "2", "3–5", "6 or more"])}
      />
      {live && (
        <>
          <p className="demo-form-note">
            This is a working test enquiry, not a booking. Your contact details
            and question will be stored in the staging workspace and visible to
            authorised Travel With Ease staff. No confirmation email, quote or
            payment will be generated.
          </p>
          <label>
            Full name
            <input
              name="name"
              value={contact.name}
              onChange={update}
              autoComplete="name"
              minLength={2}
              maxLength={160}
              required
            />
          </label>
          <label>
            Email
            <input
              name="email"
              type="email"
              value={contact.email}
              onChange={update}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Phone / WhatsApp
            <input
              name="phone"
              type="tel"
              value={contact.phone}
              onChange={update}
              autoComplete="tel"
              required
            />
          </label>
          <label>
            Question or travel preferences
            <textarea
              name="notes"
              value={contact.notes}
              onChange={update}
              maxLength={1500}
              rows={4}
              placeholder="What would you like the team to know?"
            />
          </label>
          <label className="honeypot" aria-hidden="true">
            Website
            <input
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={contact.website}
              onChange={update}
            />
          </label>
          <label className="demo-consent">
            <input
              name="consent"
              type="checkbox"
              checked={contact.consent}
              onChange={update}
              required
            />
            <span>
              I agree to have these details stored in the staging test workspace
              so the team can review this enquiry.
            </span>
          </label>
        </>
      )}
      <Button variant="primary" type="submit" disabled={!ready || submitting}>
        {submitting
          ? "Sending test enquiry…"
          : live
            ? "Submit test enquiry"
            : "Preview enquiry"}{" "}
        <IconsaxIcon name="ArrowRight4" />
      </Button>
      <p id="demo-result" role="status" aria-live="polite">
        {result}
      </p>
      <noscript>
        This preview requires JavaScript. No enquiry has been submitted.
      </noscript>
    </form>
  );
}

export default function DemoEnquiry({ live = false, apiOrigin = "" }) {
  return (
    <UiSystemProvider appSystem={appSystem} toastPresentation="twe">
      <EnquiryFields live={live} apiOrigin={apiOrigin} />
    </UiSystemProvider>
  );
}
