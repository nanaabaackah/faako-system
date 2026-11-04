import { useEffect, useState } from "react";
import { SelectField, TextField, InlineNotice } from "@faako/ui";
import { placementSlots } from "../../travel-with-ease-api/src/content/placement-catalogue.js";
import Button from "./ActionButton.jsx";
import MediaLibrary from "./MediaLibrary.jsx";
import "./image-placements.css";
const defaults = {
  imageId: null,
  mobileImageId: null,
  focalX: 50,
  focalY: 50,
  mobileFocalX: 50,
  mobileFocalY: 50,
  layout: "default",
  alt: "",
};
export default function ImagePlacements({ page, body, change, api, session }) {
  const [selection, setSelection] = useState(""),
    [picker, setPicker] = useState(null),
    [warning, setWarning] = useState(""),
    [chosen, setChosen] = useState({});
  useEffect(() => {
    let active = true;
    void api
      .get("/api/agent/media", { responseMode: "data" })
      .then((result) => {
        if (active)
          setChosen(
            Object.fromEntries(result.items.map((item) => [item.id, item])),
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [api]);
  const targets = placementSlots(page).map((slot) => ({
    ...slot,
    key: `slot:${slot.id}`,
    value: body.imagePlacements?.[slot.id],
    update: (value) => {
      const next = { ...body.imagePlacements };
      if (value) next[slot.id] = value;
      else delete next[slot.id];
      change("imagePlacements", next);
    },
  }));
  const collections =
    page === "services"
      ? ["entries"]
      : ["packages", "articles", "tips"].filter((key) => body[key]?.length);
  for (const collection of collections)
    for (const [index, record] of (body[collection] || []).entries())
      targets.push({
        key: `${collection}:${record.id || record.slug || index}`,
        label: record.title || record.heading || `Image ${index + 1}`,
        shape: "Cover photograph",
        minWidth: 1280,
        value: record.imagePlacement,
        update: (value) =>
          change(
            collection,
            body[collection].map((item, i) =>
              i === index
                ? {
                    ...item,
                    ...(collection === "entries" && !item.id
                      ? { id: crypto.randomUUID() }
                      : {}),
                    ...(!value && collection !== "entries"
                      ? { imageId: null }
                      : {}),
                    imagePlacement: value || undefined,
                  }
                : item,
            ),
          ),
      });
  const target = targets.find((item) => item.key === selection) || targets[0],
    value = { ...defaults, ...target?.value };
  const update = (key, next) => target.update({ ...value, [key]: next });
  return (
    <section
      className="workspace-panel image-placements"
      aria-label="Images and layout"
    >
      <h3>
        {page === "site-appearance"
          ? "Shared website imagery"
          : "Images & layout"}
      </h3>
      <p>
        Choose a position and preview the saved draft. Nothing is published
        automatically.
      </p>
      <SelectField
        label="Image placement"
        value={target?.key || ""}
        onChange={(event) => {
          setSelection(event.target.value);
          setPicker(null);
          setWarning("");
        }}
        options={targets.map((item) => ({
          value: item.key,
          label: item.label,
        }))}
      />
      {target && (
        <>
          <p>
            {target.shape}. Recommended width: {target.minWidth}px.{" "}
            {page === "site-appearance"
              ? "Appears throughout the website."
              : `Used in ${page}${["services", "how-it-works"].includes(page) ? " and its homepage section" : ""}.`}
          </p>
          <div className="image-placement-preview">
            {value.imageId && !session.demo ? (
              <img
                src={`/api/agent/media/${value.imageId}/preview`}
                alt={value.alt || "Selected draft image"}
                loading="lazy"
              />
            ) : (
              <p>
                {value.imageId
                  ? "Synthetic media selected for this demo."
                  : "Using the approved default image."}
              </p>
            )}
            {chosen[value.imageId] && (
              <p>
                {chosen[value.imageId].width} × {chosen[value.imageId].height}px
              </p>
            )}
          </div>
          <div className="editor-actions">
            <Button icon="media" onClick={() => setPicker("desktop")}>
              {value.imageId ? "Replace desktop image" : "Choose desktop image"}
            </Button>
            <Button icon="media" onClick={() => setPicker("mobile")}>
              {value.mobileImageId
                ? "Replace mobile image"
                : "Choose mobile image"}
            </Button>
            <Button
              icon="refresh"
              onClick={() => {
                target.update(null);
                setPicker(null);
                setWarning("");
              }}
            >
              Reset to approved image
            </Button>
          </div>
          <p>
            {value.mobileImageId
              ? "A separate mobile image is selected."
              : "Mobile uses the selected desktop image, or the approved responsive default."}
          </p>
          {value.mobileImageId && (
            <div className="image-placement-preview">
              {!session.demo && (
                <img
                  src={`/api/agent/media/${value.mobileImageId}/preview`}
                  alt="Selected mobile draft image"
                  loading="lazy"
                />
              )}
              {chosen[value.mobileImageId] && (
                <p>
                  Mobile: {chosen[value.mobileImageId].width} ×{" "}
                  {chosen[value.mobileImageId].height}px
                </p>
              )}
            </div>
          )}
          {warning && (
            <InlineNotice title="Image resolution" message={warning} />
          )}
          {target.split && (
            <SelectField
              label="Image position"
              value={value.layout}
              onChange={(event) => update("layout", event.target.value)}
              options={[
                { value: "default", label: "Approved layout" },
                { value: "left", label: "Image left" },
                { value: "right", label: "Image right" },
              ]}
            />
          )}
          {!target.id?.startsWith("cta-") && (
            <div className="image-placement-focus">
              {[
                ["focalX", "Desktop horizontal focus"],
                ["focalY", "Desktop vertical focus"],
                ["mobileFocalX", "Mobile horizontal focus"],
                ["mobileFocalY", "Mobile vertical focus"],
              ].map(([key, label]) => (
                <TextField
                  key={key}
                  label={label}
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={value[key]}
                  onChange={(event) => {
                    const n = Number(event.target.value);
                    if (Number.isFinite(n) && n >= 0 && n <= 100)
                      update(key, n);
                  }}
                  hint="0–100%; centre is 50%."
                />
              ))}
            </div>
          )}
          {!target.id?.startsWith("cta-") &&
            target.id !== "footer-background" && (
              <TextField
                label="Placement alternative text"
                maxLength={500}
                value={value.alt}
                onChange={(event) => update("alt", event.target.value)}
                hint="Optional accessibility override, not a visible caption."
              />
            )}
          {picker && (
            <div>
              <h4>
                {picker === "mobile" ? "Mobile" : "Desktop"} image library
              </h4>
              <p>
                Choose existing media or import TWE photographs from Drive
                below.
              </p>
              <Button icon="close" onClick={() => setPicker(null)}>
                Close image library
              </Button>
              <MediaLibrary
                api={api}
                session={session}
                onSelect={(item) => {
                  setChosen((current) => ({ ...current, [item.id]: item }));
                  setWarning(
                    item.width < target.minWidth
                      ? `This image is ${item.width}px wide; ${target.minWidth}px is recommended. It will not be enlarged during processing.`
                      : "",
                  );
                  update(
                    picker === "mobile" ? "mobileImageId" : "imageId",
                    item.id,
                  );
                  setPicker(null);
                }}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
