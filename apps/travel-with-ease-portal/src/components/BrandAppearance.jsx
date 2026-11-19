import { useState } from "react";
import { SelectField } from "@faako/ui";
import Button from "./ActionButton.jsx";
import "../styles/brand-appearance.css";
import MediaLibrary from "./MediaLibrary.jsx";

const slots = [
  ["headerLogoId", "Header logo", "Appears at the top of the page"],
  ["scrolledLogoId", "Scrolled header mark", "Appears in the compact navigation"],
  ["footerLogoId", "Footer logo", "Appears on the navy footer"],
  ["faviconId", "Browser icon", "Small browser tab icon; a square image works best"],
  ["socialImageId", "Default social image", "Used for link previews when an article has no own image"],
];
const defaults = {
  headingFont: "poiret-one",
  bodyFont: "quicksand",
  headerLogoId: null,
  scrolledLogoId: null,
  footerLogoId: null,
  faviconId: null,
  socialImageId: null,
};
export default function BrandAppearance({ branding, change, api, session, disabled = false }) {
  const [picker, setPicker] = useState("");
  const value = { ...defaults, ...branding };
  const update = (key, next) => change("branding", { ...value, [key]: next });
  return (
    <section className="workspace-panel brand-appearance" aria-label="Brand and appearance">
      <h3>Brand and appearance</h3>
      <p>Choose a logo for each placement and select approved website fonts.</p>
      <div className="brand-appearance__fonts">
        <SelectField label="Heading font" value={value.headingFont}
          disabled={disabled}
          onChange={event => update("headingFont", event.target.value)}
          options={[
            { value: "poiret-one", label: "Poiret One — approved TWE heading" },
            { value: "quicksand", label: "Quicksand" },
            { value: "inter", label: "Inter" },
            { value: "outfit", label: "Outfit" },
          ]}/>
        <SelectField label="Body font" value={value.bodyFont}
          disabled={disabled}
          onChange={event => update("bodyFont", event.target.value)}
          options={[
            { value: "quicksand", label: "Quicksand — approved TWE body" },
            { value: "inter", label: "Inter" },
            { value: "outfit", label: "Outfit" },
          ]}/>
      </div>
      <div className="brand-appearance__assets">
        {slots.map(([key, label, hint]) => (
          <div className="brand-appearance__asset" key={key}>
            <div>
              <strong>{label}</strong>
              <p>{hint}</p>
              <span>{value[key] ? "Custom asset selected" : "Approved default logo"}</span>
            </div>
            <div className="editor-actions">
              <Button type="button" icon="media" disabled={disabled} onClick={() => setPicker(key)}>
                {value[key] ? "Change logo" : "Choose logo"}
              </Button>
              {value[key] && <Button type="button" icon="refresh" disabled={disabled}
                onClick={() => update(key, null)}>Use default</Button>}
            </div>
          </div>
        ))}
      </div>
      <Button type="button" icon="media" disabled={disabled} onClick={() => setPicker("library")}>
        Open asset library
      </Button>
      {picker && <div className="brand-appearance__picker">
        <div className="editor-actions">
          <h4>{picker === "library" ? "Asset library" : "Choose " + slots.find(slot => slot[0] === picker)?.[1]}</h4>
          <Button type="button" icon="close" onClick={() => setPicker("")}>Close</Button>
        </div>
        <MediaLibrary api={api} session={session} onSelect={picker === "library" ? undefined : item => {
          update(picker, item.id);
          setPicker("");
        }}/>
      </div>}
    </section>
  );
}
