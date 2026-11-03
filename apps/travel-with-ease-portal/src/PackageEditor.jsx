import Button from "./ActionButton.jsx";
import { TextField, TextareaField, SelectField } from "@faako/ui";
import { packageOccasions } from "../../travel-with-ease-api/src/content/catalogue-constants.js";

export default function PackageEditor({ items, onChange, onChooseImage }) {
  const update = (index, key, value) =>
    onChange(
      items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  const lines = (value) => (value === "" ? [] : value.split("\n"));
  return (
    <section aria-label="Packages">
      <h3>Packages</h3>
      <p>
        Use approved offers only. Save and preview before requesting
        publication. This collection publishes together; an enquiry is not a
        booking.
      </p>
      {items.map((item, index) => (
        <fieldset key={item.id}>
          <legend>Package {index + 1}</legend>
          {[
            ["title", "Package title", 120],
            ["slug", "Package URL name", 80],
            ["destination", "Destination", 100],
            ["category", "Package category", 60],
            ["duration", "Duration", 60],
            ["dates", "Approved travel dates", 160],
            ["overview", "Package overview", 6000],
            ["tagline", "Package tagline", 200],
            ["transport", "Flight and transport information", 2000],
            ["accommodation", "Accommodation", 2000],
            ["important", "Important travel information", 2000],
          ].map(([key, label, max]) => (
            <TextareaField
              key={key}
              label={label}
              maxLength={max}
              required={["title", "slug", "destination", "overview"].includes(
                key,
              )}
              value={item[key] || ""}
              onChange={(event) => update(index, key, event.target.value)}
            />
          ))}
          <SelectField
            label="Pricing status"
            value={item.pricingStatus || "coming_soon"}
            onChange={(event) => {
              const pricingStatus = event.target.value;
              onChange(items.map((value, i) => i === index ? {
                ...value,
                pricingStatus,
                tiers: (value.tiers || []).map(tier => ({
                  ...tier,
                  amountMinor: pricingStatus === "coming_soon" ? null : tier.amountMinor,
                })),
              } : value));
            }}
          >
            <option value="coming_soon">Price coming soon</option>
            <option value="indicative">Indicative from prices</option>
          </SelectField>
          {item.pricingStatus === "indicative" && (
            <>
              <TextField
                label="Reference month (YYYY-MM)"
                pattern="[0-9]{4}-(0[1-9]|1[0-2])"
                placeholder="2027-06"
                required
                value={item.referenceMonth || ""}
                onChange={(event) => update(index, "referenceMonth", event.target.value)}
              />
              <TextareaField
                label="Approved price disclaimer"
                maxLength={2000}
                required
                value={item.priceDisclaimer || ""}
                onChange={(event) => update(index, "priceDisclaimer", event.target.value)}
              />
            </>
          )}
          <h4>Accommodation tiers</h4>
          <p>Prices are GHS per person sharing, including return flights from Accra.</p>
          {(item.tiers || []).map((tier, tierIndex) => {
            const updateTier = (key, value) => update(index, "tiers",
              item.tiers.map((entry, i) => i === tierIndex ? { ...entry, [key]: value } : entry));
            return (
              <fieldset key={tierIndex}>
                <legend>Tier {tierIndex + 1}</legend>
                <TextField label="Tier ID" required maxLength={80}
                  value={tier.id} onChange={(event) => updateTier("id", event.target.value)} />
                <TextField label="Tier name" required maxLength={80}
                  value={tier.label} onChange={(event) => updateTier("label", event.target.value)} />
                <TextareaField label="Tier description" maxLength={500}
                  value={tier.description || ""} onChange={(event) => updateTier("description", event.target.value)} />
                {item.pricingStatus === "indicative" && (
                  <TextField label="From price (GHS)" type="number" min="0.01" max="1000000000"
                    step="0.01" required
                    value={tier.amountMinor === null ? "" : tier.amountMinor / 100}
                    onChange={(event) => updateTier("amountMinor",
                      event.target.value === "" ? null : Math.round(Number(event.target.value) * 100))} />
                )}
                <Button type="button" onClick={() => update(index, "tiers",
                  item.tiers.filter((_, i) => i !== tierIndex))}>Remove tier {tierIndex + 1}</Button>
              </fieldset>
            );
          })}
          <Button type="button" disabled={(item.tiers || []).length >= 8}
            onClick={() => update(index, "tiers", [...(item.tiers || []), {
              id: "", label: "", description: "", amountMinor: null, currency: "GHS",
            }])}>Add tier</Button>
          <fieldset>
            <legend>Occasions</legend>
            <p>Choose only approved assignments. Group-friendly is a separate attribute.</p>
            {packageOccasions.map((occasion) => (
              <label key={occasion.value}>
                <input type="checkbox" checked={(item.occasions || []).includes(occasion.value)}
                  onChange={(event) => update(index, "occasions", event.target.checked
                    ? [...(item.occasions || []), occasion.value]
                    : (item.occasions || []).filter(value => value !== occasion.value))} />
                {occasion.label}
              </label>
            ))}
            <label>
              <input type="checkbox" checked={item.groupFriendly === true}
                onChange={(event) => update(index, "groupFriendly", event.target.checked)} />
              Group-friendly
            </label>
          </fieldset>
          <SelectField
            label="Package availability"
            value={item.availability}
            onChange={(event) =>
              update(index, "availability", event.target.value)
            }
          >
            <option value="enquiry">Enquire for details</option>
            <option value="available">Available (approved)</option>
            <option value="sold_out">Sold out</option>
            <option value="closed">Closed</option>
          </SelectField>
          {[
            ["highlights", "Highlights — one per line"],
            ["inclusions", "Included — one per line"],
            ["exclusions", "Not included — one per line"],
            ["relatedArticles", "Related Journal URL names — one per line"],
            ["relatedPackageSlugs", "Related package URL names — one per line"],
          ].map(([key, label]) => (
            <TextareaField
              key={key}
              label={label}
              value={(item[key] || []).join("\n")}
              onChange={(event) =>
                update(index, key, lines(event.target.value))
              }
            />
          ))}
          <p>
            {item.imageId
              ? "Hero image selected from the approved library."
              : "No hero image selected."}
          </p>
          <Button type="button" onClick={() => onChooseImage(index, false)}>
            Choose package image
          </Button>
          <Button type="button" onClick={() => update(index, "imageId", null)}>
            Remove package image
          </Button>
          <p>{(item.galleryImageIds || []).length} gallery images selected.</p>
          <Button
            type="button"
            disabled={(item.galleryImageIds || []).length >= 12}
            onClick={() => onChooseImage(index, true)}
          >
            Add gallery image
          </Button>
          <Button
            type="button"
            onClick={() => update(index, "galleryImageIds", [])}
          >
            Clear gallery
          </Button>
          <h4>Day-by-day itinerary</h4>
          {(item.itinerary || []).map((day, dayIndex) => (
            <fieldset key={dayIndex}>
              <legend>Itinerary entry {dayIndex + 1}</legend>
              <TextField
                label="Day number"
                type="number"
                min="1"
                max="100"
                required
                value={day.day}
                onChange={(event) =>
                  update(
                    index,
                    "itinerary",
                    item.itinerary.map((value, i) =>
                      i === dayIndex
                        ? {
                            ...value,
                            day:
                              event.target.value === ""
                                ? ""
                                : Number(event.target.value),
                          }
                        : value,
                    ),
                  )
                }
              />
              <TextField
                label="Day title"
                maxLength={120}
                required
                value={day.title}
                onChange={(event) =>
                  update(
                    index,
                    "itinerary",
                    item.itinerary.map((value, i) =>
                      i === dayIndex
                        ? { ...value, title: event.target.value }
                        : value,
                    ),
                  )
                }
              />
              <TextareaField
                label="Day details"
                maxLength={2000}
                required
                value={day.text}
                onChange={(event) =>
                  update(
                    index,
                    "itinerary",
                    item.itinerary.map((value, i) =>
                      i === dayIndex
                        ? { ...value, text: event.target.value }
                        : value,
                    ),
                  )
                }
              />
              <Button
                type="button"
                onClick={() =>
                  update(
                    index,
                    "itinerary",
                    item.itinerary.filter((_, i) => i !== dayIndex),
                  )
                }
              >
                Remove day {day.day}
              </Button>
            </fieldset>
          ))}
          <Button
            type="button"
            disabled={(item.itinerary || []).length >= 40}
            onClick={() =>
              update(index, "itinerary", [
                ...(item.itinerary || []),
                {
                  day:
                    Math.max(
                      0,
                      ...(item.itinerary || []).map((day) => Number(day.day)),
                    ) + 1,
                  title: "",
                  text: "",
                },
              ])
            }
          >
            Add itinerary day
          </Button>
          <Button
            type="button"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            Remove package {index + 1}
          </Button>
        </fieldset>
      ))}
      <Button
        type="button"
        disabled={items.length >= 30}
        onClick={() =>
          onChange([
            ...items,
            {
              id: crypto.randomUUID(),
              slug: "",
              title: "",
              destination: "",
              category: "",
              duration: "",
              dates: "",
              overview: "",
              priceFrom: "",
              priceDisclosure: "",
              availability: "enquiry",
              imageId: null,
              galleryImageIds: [],
              highlights: [],
              inclusions: [],
              exclusions: [],
              transport: "",
              accommodation: "",
              important: "",
              itinerary: [],
              relatedArticles: [],
              relatedPackageSlugs: [],
            },
          ])
        }
      >
        Add package
      </Button>
    </section>
  );
}
