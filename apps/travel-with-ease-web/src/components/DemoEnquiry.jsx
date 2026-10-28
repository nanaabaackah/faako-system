import { useEffect, useState } from "react";
// This app's core ESLint rule does not count JSX component references as usage.
// eslint-disable-next-line no-unused-vars
import { Button, SelectField, UiSystemProvider, useToast, IconsaxIcon } from "@faako/ui";
import "@faako/ui/twe-feedback.css";
import appSystem from "../../appSystem.js";

// eslint-disable-next-line no-unused-vars -- rendered as JSX below
function EnquiryFields() {
  const { pushToast } = useToast();
  const [kind, setKind] = useState("personalised");
  const [destination, setDestination] = useState("Kenya");
  const [style, setStyle] = useState("A slower pace");
  const [travellers, setTravellers] = useState("2");
  const [ready, setReady] = useState(false);
  const [result, setResult] = useState("Demo only. Nothing will be submitted.");
  useEffect(() => {
    setReady(true);
    const choose = event => {
      const link = event.target.closest?.("[data-demo-destination]");
      if (link) { setDestination(link.dataset.demoDestination); setKind("package"); }
      if (event.target.closest?.("[data-demo-personalised]")) setKind("personalised");
    };
    document.addEventListener("click", choose);
    return () => document.removeEventListener("click", choose);
  }, []);
  const options = values => values.map(value => ({ value, label: value }));
  return <form className="demo-enquiry-form" onSubmit={event => {
    event.preventDefault();
    pushToast({ id: "demo-enquiry", tone: "success", title: "Demo preview ready", message: "Nothing was sent, saved or booked." });
    setResult(`Demo ${kind} preview: ${destination}, ${style.toLowerCase()}, ${travellers} traveller(s). Nothing was sent or saved.`);
  }}>
    <h3>{kind === "package" ? "Sample package enquiry" : "Sample personalised enquiry"}</h3>
    <SelectField label="Enquiry journey" value={kind} onChangeValue={setKind} options={[{value:"personalised",label:"Personalised trip"},{value:"package",label:"Package enquiry"}]} />
    <SelectField label="Sample destination" value={destination} onChangeValue={setDestination} options={options(["Kenya", "Zanzibar", "Help me choose"])} />
    <SelectField label="Travel style" value={style} onChangeValue={setStyle} options={options(["A slower pace", "Discovery and culture", "A little of both"])} />
    <SelectField label="Number of travellers" value={travellers} onChangeValue={setTravellers} options={options(["1", "2", "3–5", "6 or more"])} />
    <Button variant="primary" type="submit" disabled={!ready}>Preview enquiry <IconsaxIcon name="ArrowRight4" /></Button>
    <p id="demo-result" role="status">{result}</p>
    <noscript>This preview requires JavaScript. Nothing will be submitted.</noscript>
  </form>;
}

export default function DemoEnquiry() {
  return <UiSystemProvider appSystem={appSystem} toastPresentation="twe"><EnquiryFields /></UiSystemProvider>;
}
