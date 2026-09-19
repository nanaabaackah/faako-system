import React from "react";
import { GHANA_REGIONS } from "../crmShared";

export default function CustomerFormFields({ form, onChange, idPrefix = "customer", showInternalNotes = false }) {
  const isOrganization = form.customerType === "organization";
  const fieldId = (name) => `${idPrefix}-${name}`;

  return (
    <div className="crm-form-sections">
      <fieldset className="crm-form-section">
        <legend>Customer identity</legend>
        <div className="crm-type-options" role="radiogroup" aria-label="Customer type">
          <label>
            <input
              type="radio"
              name={`${idPrefix}-customer-type`}
              value="individual"
              checked={!isOrganization}
              onChange={() => onChange("customerType", "individual")}
            />
            Individual
          </label>
          <label>
            <input
              type="radio"
              name={`${idPrefix}-customer-type`}
              value="organization"
              checked={isOrganization}
              onChange={() => onChange("customerType", "organization")}
            />
            Organization
          </label>
        </div>

        <div className="crm-field-grid">
          {isOrganization ? (
            <>
              <label className="crm-field crm-field-full" htmlFor={fieldId("organizationName")}>
                <span>Organization name</span>
                <input
                  id={fieldId("organizationName")}
                  type="text"
                  value={form.organizationName}
                  onChange={(event) => onChange("organizationName", event.target.value)}
                  autoComplete="organization"
                  required
                />
              </label>
              <label className="crm-field crm-field-full" htmlFor={fieldId("contactPersonName")}>
                <span>Primary contact person</span>
                <input
                  id={fieldId("contactPersonName")}
                  type="text"
                  value={form.contactPersonName}
                  onChange={(event) => onChange("contactPersonName", event.target.value)}
                  autoComplete="name"
                  placeholder="Optional"
                />
              </label>
            </>
          ) : (
            <label className="crm-field crm-field-full" htmlFor={fieldId("name")}>
              <span>Full name</span>
              <input
                id={fieldId("name")}
                type="text"
                value={form.name}
                onChange={(event) => onChange("name", event.target.value)}
                autoComplete="name"
                required
              />
            </label>
          )}
        </div>
      </fieldset>

      <fieldset className="crm-form-section">
        <legend>Contact</legend>
        <div className="crm-field-grid">
          <label className="crm-field" htmlFor={fieldId("phone")}>
            <span>Primary phone</span>
            <input
              id={fieldId("phone")}
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(event) => onChange("phone", event.target.value)}
              autoComplete="tel"
              placeholder="024 412 3456"
            />
          </label>
          <label className="crm-field" htmlFor={fieldId("secondaryPhone")}>
            <span>Other phone</span>
            <input
              id={fieldId("secondaryPhone")}
              type="tel"
              inputMode="tel"
              value={form.secondaryPhone}
              onChange={(event) => onChange("secondaryPhone", event.target.value)}
              autoComplete="tel"
              placeholder="Optional"
            />
          </label>
          <label className="crm-field" htmlFor={fieldId("email")}>
            <span>Email</span>
            <input
              id={fieldId("email")}
              type="email"
              value={form.email}
              onChange={(event) => onChange("email", event.target.value)}
              autoComplete="email"
              placeholder="Optional"
            />
          </label>
          <label className="crm-field" htmlFor={fieldId("preferredContactMethod")}>
            <span>Preferred contact</span>
            <select
              id={fieldId("preferredContactMethod")}
              value={form.preferredContactMethod}
              onChange={(event) => onChange("preferredContactMethod", event.target.value)}
            >
              <option value="">Not specified</option>
              <option value="phone">Phone call</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className="crm-form-section">
        <legend>Primary address</legend>
        <div className="crm-field-grid">
          <label className="crm-field crm-field-full" htmlFor={fieldId("addressLine1")}>
            <span>Street or landmark</span>
            <input
              id={fieldId("addressLine1")}
              type="text"
              value={form.addressLine1}
              onChange={(event) => onChange("addressLine1", event.target.value)}
              autoComplete="address-line1"
              placeholder="House, street, or nearest landmark"
            />
          </label>
          <label className="crm-field crm-field-full" htmlFor={fieldId("addressLine2")}>
            <span>Additional directions</span>
            <input
              id={fieldId("addressLine2")}
              type="text"
              value={form.addressLine2}
              onChange={(event) => onChange("addressLine2", event.target.value)}
              autoComplete="address-line2"
              placeholder="Optional"
            />
          </label>
          <label className="crm-field" htmlFor={fieldId("locality")}>
            <span>Town or area</span>
            <input
              id={fieldId("locality")}
              type="text"
              value={form.locality}
              onChange={(event) => onChange("locality", event.target.value)}
              autoComplete="address-level2"
            />
          </label>
          <label className="crm-field" htmlFor={fieldId("region")}>
            <span>Region</span>
            <select
              id={fieldId("region")}
              value={form.region}
              onChange={(event) => onChange("region", event.target.value)}
              autoComplete="address-level1"
            >
              <option value="">Select region</option>
              {GHANA_REGIONS.map((region) => <option value={region} key={region}>{region}</option>)}
            </select>
          </label>
          <label className="crm-field crm-field-full" htmlFor={fieldId("ghanaPostGps")}>
            <span>GhanaPost GPS</span>
            <input
              id={fieldId("ghanaPostGps")}
              type="text"
              value={form.ghanaPostGps}
              onChange={(event) => onChange("ghanaPostGps", event.target.value.toUpperCase())}
              autoCapitalize="characters"
              placeholder="GA-123-4567"
            />
          </label>
        </div>
      </fieldset>

      {showInternalNotes ? (
        <fieldset className="crm-form-section">
          <legend>Internal notes</legend>
          <label className="crm-field crm-field-full" htmlFor={fieldId("internalNotes")}>
            <span>Visible to authorized staff only</span>
            <textarea
              id={fieldId("internalNotes")}
              rows="4"
              value={form.internalNotes}
              onChange={(event) => onChange("internalNotes", event.target.value)}
              placeholder="Operational context only. Do not add unnecessary sensitive data."
            />
          </label>
        </fieldset>
      ) : null}
    </div>
  );
}
