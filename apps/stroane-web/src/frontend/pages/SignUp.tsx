import React, { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { HiArrowRight } from "react-icons/hi";
import { SelectField, TextField } from "@faako/ui";
import Layout from "../../components/Layout";
import useSEOMeta from "../../hooks/useSEOMeta";
import { useAuth } from "../../context/AuthContext";
import PasswordRequirementList from "../components/auth/PasswordRequirementList";
import { isLikelyEmail, isLikelyPhone, PHONE_INPUT_PATTERN } from "../../utils/contactValidation";
import { getPasswordValidationMessage } from "../../utils/passwordRequirements";
import "../styles/Auth.css";

type ContactMethod = "email" | "phone" | "whatsapp";

const getSelectValue = (value: string | string[]) =>
  Array.isArray(value) ? value[0] || "" : value;

const SignUp: React.FC = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = useMemo(() => searchParams.get("invite") || "", [searchParams]);
  const paymentReference = useMemo(
    () => searchParams.get("reference") || searchParams.get("trxref") || "",
    [searchParams]
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const businessName = "";
  const [preferredContactMethod, setPreferredContactMethod] = useState<ContactMethod>("email");
  const defaultDeliveryAddress = "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useSEOMeta({
    title: "Create Account | Stroane",
    description: "Create your secure Stroane customer account.",
    canonical: "https://stroanesolutions.com/signup",
    noIndex: true,
  });

  const validate = () => {
    if (!name.trim()) return "Add your full name.";
    if (!isLikelyEmail(email)) return "Add a valid email address.";
    if (phone.trim() && !isLikelyPhone(phone)) return "Add a valid phone number.";
    const passwordMessage = getPasswordValidationMessage(password);
    if (passwordMessage) return passwordMessage;
    if (password !== confirmPassword) return "Passwords do not match.";
    return "";
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const normalizedEmail = email.trim().toLowerCase();
    const validationMessage = validate();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setLoading(true);
    try {
      await signUp({
        name,
        email: normalizedEmail,
        phone,
        businessName,
        preferredContactMethod,
        defaultDeliveryAddress,
        password,
        inviteToken,
        paymentReference,
      });
      navigate("/account", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account.");
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="auth-page">
        <aside className="auth-visual" aria-hidden="true">
          <video
            className="auth-visual__video"
            src="/imgs/bg_imgs/auth_bg.mp4"
            autoPlay
            loop
            muted
            playsInline
          />
          <div className="auth-visual__overlay" />
          <div className="auth-visual__content">
            <span className="auth-visual__brand">Stroane</span>
            <p className="auth-visual__tagline">
              Food safety supplies and compliance support for Ghana.
            </p>
          </div>
        </aside>

        <div className="auth-form-col">
          <div className="auth-card">
            <span className="auth-card__kicker">Customer profile</span>
            <h1 className="auth-card__title">Create your account</h1>
            <p className="auth-card__sub">
              Create a secure Stroane profile to manage your details and future orders.
            </p>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <TextField
                fieldClassName="auth-field"
                label="Full name"
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError("");
                }}
                autoComplete="name"
                required
              />
              <TextField
                fieldClassName="auth-field"
                label="Email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                }}
                onBlur={() => setEmail((current) => current.trim().toLowerCase())}
                autoComplete="email"
                required
              />
              <TextField
                fieldClassName="auth-field"
                label="Phone"
                type="tel"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setError("");
                }}
                inputMode="tel"
                pattern={PHONE_INPUT_PATTERN}
                autoComplete="tel"
              />
              <SelectField
                fieldClassName="auth-field"
                label="Preferred contact"
                value={preferredContactMethod}
                onChangeValue={(value) =>
                  setPreferredContactMethod(getSelectValue(value) as ContactMethod)
                }
                options={[
                  { value: "email", label: "Email" },
                  { value: "phone", label: "Phone call" },
                  { value: "whatsapp", label: "WhatsApp" },
                ]}
              />
              <TextField
                fieldClassName="auth-field"
                label="Password"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                autoComplete="new-password"
                aria-describedby="signup-password-requirements"
                required
              />
              <PasswordRequirementList
                id="signup-password-requirements"
                password={password}
              />
              <TextField
                fieldClassName="auth-field"
                label="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setError("");
                }}
                autoComplete="new-password"
                required
              />

              {error ? (
                <p className="auth-form__error" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className="auth-form__submit"
                disabled={loading}
              >
                {loading ? "Creating account..." : "Create account"}
                {!loading ? <HiArrowRight size={17} aria-hidden="true" /> : null}
              </button>
            </form>

            <p className="auth-card__alt">
              Already have an account? <Link to="/signin">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SignUp;
