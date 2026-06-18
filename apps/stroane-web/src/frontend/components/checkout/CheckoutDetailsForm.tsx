import React, { type FormEvent } from "react";
import { HiArrowRight } from "react-icons/hi";
import { DateField, SelectField, TextareaField, TextField, TimeField } from "@faako/ui";
import type { CheckoutFulfillmentMethod, DeliveryLocation } from "../../../api/orders";
import { PHONE_INPUT_PATTERN } from "../../../utils/contactValidation";

type PreferredContactMethod = "email" | "phone" | "whatsapp";

interface PickupSpot {
  id: string;
  name: string;
  address: string;
  detail: string;
}

interface CheckoutDetailsFormProps {
  name: string;
  email: string;
  phone: string;
  businessName: string;
  address: string;
  deliveryLocation: DeliveryLocation | null;
  deliveryLocationResults: DeliveryLocation[];
  deliveryLocationLoading: boolean;
  deliveryLocationError: string;
  deliveryNotes: string;
  fulfillmentMethod: CheckoutFulfillmentMethod;
  pickupSpots: PickupSpot[];
  pickupSpotId: string;
  pickupDate: string;
  pickupTime: string;
  minimumPickupDate: string;
  website: string;
  preferredContactMethod: PreferredContactMethod;
  notice: string;
  error: string;
  reviewing: boolean;
  submitting: boolean;
  hasLines: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: () => void;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onBusinessNameChange: (value: string) => void;
  onFulfillmentMethodChange: (value: CheckoutFulfillmentMethod) => void;
  onAddressChange: (value: string) => void;
  onDeliveryLocationSelect: (location: DeliveryLocation) => void;
  onPickupSpotChange: (value: string) => void;
  onPickupDateChange: (value: string) => void;
  onPickupTimeChange: (value: string) => void;
  onDeliveryNotesChange: (value: string) => void;
  onWebsiteChange: (value: string) => void;
  onPreferredContactMethodChange: (value: PreferredContactMethod) => void;
}

const getSelectValue = (value: string | string[]) =>
  Array.isArray(value) ? value[0] || "" : value;

const CheckoutDetailsForm: React.FC<CheckoutDetailsFormProps> = ({
  name,
  email,
  phone,
  businessName,
  address,
  deliveryLocation,
  deliveryLocationResults,
  deliveryLocationLoading,
  deliveryLocationError,
  deliveryNotes,
  fulfillmentMethod,
  pickupSpots,
  pickupSpotId,
  pickupDate,
  pickupTime,
  minimumPickupDate,
  website,
  preferredContactMethod,
  notice,
  error,
  reviewing,
  submitting,
  hasLines,
  onSubmit,
  onEdit,
  onNameChange,
  onEmailChange,
  onPhoneChange,
  onBusinessNameChange,
  onFulfillmentMethodChange,
  onAddressChange,
  onDeliveryLocationSelect,
  onPickupSpotChange,
  onPickupDateChange,
  onPickupTimeChange,
  onDeliveryNotesChange,
  onWebsiteChange,
  onPreferredContactMethodChange,
}) => {
  return (
    <form className="checkout-form" onSubmit={onSubmit} noValidate>
      <h2 className="checkout-section-title">Your details</h2>

      <div className="checkout-form__row">
        <TextField
          fieldClassName="checkout-field"
          label="Full name"
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          autoComplete="name"
          required
        />
        <TextField
          fieldClassName="checkout-field"
          label="Email"
          type="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          autoComplete="email"
          required
        />
      </div>

      <div className="checkout-form__row">
        <TextField
          fieldClassName="checkout-field"
          label="Phone"
          type="tel"
          value={phone}
          onChange={(event) => onPhoneChange(event.target.value)}
          autoComplete="tel"
          inputMode="tel"
          pattern={PHONE_INPUT_PATTERN}
          placeholder="+233..."
          title="Use a valid phone number, for example +233 24 331 6192."
          required
        />
        <TextField
          fieldClassName="checkout-field"
          label="Business name"
          type="text"
          value={businessName}
          onChange={(event) => onBusinessNameChange(event.target.value)}
          autoComplete="organization"
        />
      </div>

      <SelectField
        fieldClassName="checkout-field checkout-field--full"
        label="Preferred contact method"
        value={preferredContactMethod}
        onChangeValue={(value) =>
          onPreferredContactMethodChange(getSelectValue(value) as PreferredContactMethod)
        }
        options={[
          { value: "email", label: "Email" },
          { value: "phone", label: "Phone call" },
          { value: "whatsapp", label: "WhatsApp" },
        ]}
      />

      <section className="checkout-fulfillment" aria-labelledby="checkout-fulfillment-title">
        <h3 id="checkout-fulfillment-title">Order type</h3>
        <div className="checkout-fulfillment__switch" role="group" aria-label="Order type">
          <button
            type="button"
            className={fulfillmentMethod === "delivery" ? "is-active" : ""}
            aria-pressed={fulfillmentMethod === "delivery"}
            onClick={() => onFulfillmentMethodChange("delivery")}
          >
            Delivery
          </button>
          <button
            type="button"
            className={fulfillmentMethod === "pickup" ? "is-active" : ""}
            aria-pressed={fulfillmentMethod === "pickup"}
            onClick={() => onFulfillmentMethodChange("pickup")}
          >
            Pickup
          </button>
        </div>

        {fulfillmentMethod === "delivery" ? (
          <div className="checkout-address-field checkout-field--full">
            <TextField
              fieldClassName="checkout-field"
              label="Delivery address"
              type="search"
              value={address}
              onChange={(event) => onAddressChange(event.target.value)}
              autoComplete="street-address"
              placeholder="Search your delivery address"
              required
            />
            {deliveryLocation ? (
              <p className="checkout-address-selected">
                Selected GPS address: <strong>{deliveryLocation.label}</strong>
              </p>
            ) : null}
            {deliveryLocationLoading ? (
              <p className="checkout-address-status" role="status">
                Searching addresses...
              </p>
            ) : null}
            {deliveryLocationError ? (
              <p className="checkout-address-status is-error" role="alert">
                {deliveryLocationError}
              </p>
            ) : null}
            {deliveryLocationResults.length ? (
              <div className="checkout-address-suggestions" aria-label="GPS address results">
                {deliveryLocationResults.map((location) => (
                  <button
                    key={location.id || location.placeId || location.label}
                    type="button"
                    className="checkout-address-suggestion"
                    onClick={() => onDeliveryLocationSelect(location)}
                  >
                    <strong>{location.label}</strong>
                    {location.provider ? <small>{location.provider}</small> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className="checkout-pickup-spots" role="radiogroup" aria-label="Pickup spot">
              {pickupSpots.map((spot) => (
                <button
                  key={spot.id}
                  type="button"
                  className={pickupSpotId === spot.id ? "is-active" : ""}
                  role="radio"
                  aria-checked={pickupSpotId === spot.id}
                  onClick={() => onPickupSpotChange(spot.id)}
                >
                  <strong>{spot.name}</strong>
                  <span>{spot.address}</span>
                  <small>{spot.detail}</small>
                </button>
              ))}
            </div>
            <div className="checkout-form__row checkout-form__row--compact">
              <DateField
                fieldClassName="checkout-field"
                label="Pickup date"
                value={pickupDate}
                min={minimumPickupDate}
                onChangeValue={onPickupDateChange}
                required
              />
              <TimeField
                fieldClassName="checkout-field"
                label="Pickup time"
                value={pickupTime}
                onChangeValue={(value) => onPickupTimeChange(getSelectValue(value))}
                intervalMinutes={30}
                placeholder="Select time"
                required
              />
            </div>
          </>
        )}
      </section>

      <TextareaField
        fieldClassName="checkout-field checkout-field--full"
        label={fulfillmentMethod === "pickup" ? "Pickup notes" : "Delivery notes"}
        rows={3}
        value={deliveryNotes}
        onChange={(event) => onDeliveryNotesChange(event.target.value)}
      />

      <label className="checkout-field checkout-field--trap" aria-hidden="true">
        <span>Website</span>
        <input
          type="text"
          value={website}
          onChange={(event) => onWebsiteChange(event.target.value)}
          autoComplete="off"
          tabIndex={-1}
        />
      </label>

      {notice ? (
        <p className="checkout-form__notice" role="status">
          {notice}
        </p>
      ) : null}

      <p className="checkout-form__notice">
        Payment is handled by Paystack. Stroane does not store any payment details on our system.
      </p>

      {reviewing ? (
        <div className="checkout-review-notice" role="status">
          <strong>Review step</strong>
          <span>Confirm the details and order summary, then submit the order request.</span>
        </div>
      ) : null}

      {error ? (
        <p className="checkout-form__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="checkout-form__actions">
        {reviewing ? (
          <button
            type="button"
            className="checkout-edit-btn"
            onClick={onEdit}
            disabled={submitting}
          >
            Edit details
          </button>
        ) : null}
        <button type="submit" className="checkout-pay-btn" disabled={submitting || !hasLines}>
          {submitting ? "Preparing Paystack..." : reviewing ? "Continue to Paystack" : "Review order"}
          {!submitting ? <HiArrowRight size={18} aria-hidden="true" /> : null}
        </button>
      </div>
    </form>
  );
};

export default CheckoutDetailsForm;
