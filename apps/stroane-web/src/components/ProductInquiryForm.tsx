import React, { useMemo, useState, type FormEvent } from "react";
import { productApi } from "../api/products";
import type { Product } from "../data/products";

interface ProductInquiryFormProps {
  product: Product;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9][0-9\s().-]{6,}$/;

const isReasonableName = (value: string) => {
  const normalized = value.trim();
  return normalized.length >= 2 && /[A-Za-z]/.test(normalized) && !/[@:/\\]/.test(normalized);
};

const validateInquiry = ({
  name,
  email,
  phone,
  message,
}: {
  name: string;
  email: string;
  phone: string;
  message: string;
}) => {
  const errors: Record<string, string> = {};
  const normalizedEmail = email.trim();
  const normalizedPhone = phone.trim();

  if (!isReasonableName(name)) errors.name = "Enter your name.";
  if (!normalizedEmail && !normalizedPhone) {
    errors.email = "Enter an email or phone number.";
    errors.phone = "Enter a phone number or email.";
  }
  if (normalizedEmail && !EMAIL_PATTERN.test(normalizedEmail.toLowerCase())) {
    errors.email = "Enter a valid email address.";
  }
  if (normalizedPhone && !PHONE_PATTERN.test(normalizedPhone)) {
    errors.phone = "Enter a valid phone number.";
  }
  if (!message.trim()) errors.message = "Add a short message.";
  return errors;
};

const RequiredMark = () => (
  <>
    <span className="product-inquiry-form__required" aria-hidden="true">*</span>
    <span className="sr-only">required</span>
  </>
);

const ProductInquiryForm: React.FC<ProductInquiryFormProps> = ({ product }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState(
    `Hello Stroane, I would like availability and pricing for ${product.name}.`
  );
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [feedback, setFeedback] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent(`Product inquiry: ${product.name}`);
    const body = encodeURIComponent(
      `Product: ${product.name}\nSKU: ${product.sku}\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nBusiness: ${businessName}\n\nMessage:\n${message}`
    );
    return `mailto:info@stroanesolutions.com?subject=${subject}&body=${body}`;
  }, [businessName, email, message, name, phone, product.name, product.sku]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("idle");
    setFeedback("");

    if (!name.trim() || (!email.trim() && !phone.trim()) || !message.trim()) {
      const nextErrors = validateInquiry({ name, email, phone, message });
      setFieldErrors(nextErrors);
      setStatus("error");
      setFeedback(Object.values(nextErrors)[0] || "Add your name, a phone or email, and a short message.");
      return;
    }

    const nextErrors = validateInquiry({ name, email, phone, message });
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setStatus("error");
      setFeedback(Object.values(nextErrors)[0]);
      return;
    }

    if (website.trim()) {
      setStatus("error");
      setFeedback("The inquiry could not be submitted. Please email Stroane directly.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await productApi.submitInquiry({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        businessName: businessName.trim(),
        message: message.trim(),
        productSlug: product.id,
        productName: product.name,
        source: "product_detail",
        website,
      });
      setFieldErrors({});
      setStatus("success");
      setFeedback(response.inquiry.nextStep);
    } catch (error) {
      setStatus("error");
      setFeedback(
        error instanceof Error
          ? error.message
          : "The inquiry service is unavailable. You can email Stroane directly."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setBusinessName("");
    setWebsite("");
    setMessage(`Hello Stroane, I would like availability and pricing for ${product.name}.`);
    setStatus("idle");
    setFeedback("");
    setFieldErrors({});
  };

  const updateField = (field: string, setter: (value: string) => void) => (value: string) => {
    setter(value);
    setFieldErrors((current) => {
      const next = { ...current };
      let changed = false;
      const clear = (key: string) => {
        if (!next[key]) return;
        delete next[key];
        changed = true;
      };

      clear(field);
      if (value.trim()) {
        if (field === "email") clear("phone");
        if (field === "phone") clear("email");
      }
      return changed ? next : current;
    });
    if (status === "error") {
      setStatus("idle");
      setFeedback("");
    }
  };

  const fieldError = (field: string) => fieldErrors[field] || "";

  return (
    <form className="product-inquiry-form" onSubmit={handleSubmit} noValidate>
      <header className="product-inquiry-form__header">
        <h2>Request product details</h2>
        <p>{product.inquiryCta || "Ask Stroane to confirm availability and pricing."}</p>
      </header>

      <div className="product-inquiry-form__grid">
        <label className={`product-inquiry-form__field ${fieldError("name") ? "is-error" : ""}`}>
          <span>Name <RequiredMark /></span>
          <input
            type="text"
            value={name}
            onChange={(event) => updateField("name", setName)(event.target.value)}
            autoComplete="name"
            required
            aria-invalid={fieldError("name") ? true : undefined}
            aria-describedby={fieldError("name") ? "product-inquiry-name-error" : undefined}
          />
          {fieldError("name") ? (
            <span className="product-inquiry-form__field-error" id="product-inquiry-name-error">
              {fieldError("name")}
            </span>
          ) : null}
        </label>

        <label className={`product-inquiry-form__field ${fieldError("email") ? "is-error" : ""}`}>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => updateField("email", setEmail)(event.target.value)}
            autoComplete="email"
            aria-invalid={fieldError("email") ? true : undefined}
            aria-describedby={fieldError("email") ? "product-inquiry-email-error" : undefined}
          />
          {fieldError("email") ? (
            <span className="product-inquiry-form__field-error" id="product-inquiry-email-error">
              {fieldError("email")}
            </span>
          ) : null}
        </label>

        <label className={`product-inquiry-form__field ${fieldError("phone") ? "is-error" : ""}`}>
          <span>Phone</span>
          <input
            type="tel"
            value={phone}
            onChange={(event) => updateField("phone", setPhone)(event.target.value)}
            autoComplete="tel"
            placeholder="+233..."
            aria-invalid={fieldError("phone") ? true : undefined}
            aria-describedby={fieldError("phone") ? "product-inquiry-phone-error" : undefined}
          />
          {fieldError("phone") ? (
            <span className="product-inquiry-form__field-error" id="product-inquiry-phone-error">
              {fieldError("phone")}
            </span>
          ) : null}
        </label>

        <label className="product-inquiry-form__field">
          <span>Business name</span>
          <input
            type="text"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            autoComplete="organization"
          />
        </label>
      </div>

      <label className="product-inquiry-form__trap" aria-hidden="true">
        <span>Website</span>
        <input
          type="text"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          autoComplete="off"
          tabIndex={-1}
        />
      </label>

      <label className={`product-inquiry-form__field product-inquiry-form__field--full ${fieldError("message") ? "is-error" : ""}`}>
        <span>Message <RequiredMark /></span>
        <textarea
          rows={4}
          value={message}
          onChange={(event) => updateField("message", setMessage)(event.target.value)}
          required
          aria-invalid={fieldError("message") ? true : undefined}
          aria-describedby={fieldError("message") ? "product-inquiry-message-error" : undefined}
        />
        {fieldError("message") ? (
          <span className="product-inquiry-form__field-error" id="product-inquiry-message-error">
            {fieldError("message")}
          </span>
        ) : null}
      </label>

      {feedback ? (
        <p
          className={`product-inquiry-form__feedback product-inquiry-form__feedback--${status}`}
          role={status === "error" ? "alert" : "status"}
        >
          {feedback}
          {status === "error" ? (
            <>
              {" "}
              <a href={mailtoHref}>Email Stroane instead.</a>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="product-inquiry-form__actions">
        <button type="submit" className="product-inquiry-form__submit" disabled={submitting}>
          {submitting ? "Sending..." : "Send inquiry"}
        </button>
        {status === "success" ? (
          <button
            type="button"
            className="product-inquiry-form__reset"
            onClick={handleReset}
          >
            Send another
          </button>
        ) : null}
      </div>
    </form>
  );
};

export default ProductInquiryForm;
