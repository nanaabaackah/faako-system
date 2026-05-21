import React, { useMemo, useState, type FormEvent } from "react";
import { productApi } from "../api/products";
import type { Product } from "../data/products";

interface ProductInquiryFormProps {
  product: Product;
}

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
      setStatus("error");
      setFeedback("Add your name, a phone or email, and a short message.");
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
        name,
        email,
        phone,
        businessName,
        message,
        productSlug: product.id,
        productName: product.name,
        source: "product_detail",
        website,
      });
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
  };

  return (
    <form className="product-inquiry-form" onSubmit={handleSubmit} noValidate>
      <header className="product-inquiry-form__header">
        <h2>Request product details</h2>
        <p>{product.inquiryCta || "Ask Stroane to confirm availability and pricing."}</p>
      </header>

      <div className="product-inquiry-form__grid">
        <label className="product-inquiry-form__field">
          <span>Name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            required
          />
        </label>

        <label className="product-inquiry-form__field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </label>

        <label className="product-inquiry-form__field">
          <span>Phone</span>
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            placeholder="+233..."
          />
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

      <label className="product-inquiry-form__field product-inquiry-form__field--full">
        <span>Message</span>
        <textarea
          rows={4}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
        />
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
