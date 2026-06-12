import React, { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  HiOutlineCamera,
  HiOutlineCheckCircle,
  HiOutlineDesktopComputer,
  HiOutlineMoon,
  HiOutlineSun,
  HiOutlineUserCircle,
} from "react-icons/hi";
import { ERPFormNotice } from "@faako/ui";
import {
  getAdminDisplayName,
  type AdminAppearancePreference,
  type AdminProfileUpdatePayload,
} from "../../api/adminSession";
import { portalUrl } from "../../config/appSurface";
import { useAdminPortal } from "../../context/AdminPortalContext";
import useSEOMeta from "../../hooks/useSEOMeta";
import "../../styles/pages/AdminPortal.css";

const MAX_AVATAR_FILE_BYTES = 350000;

const APPEARANCE_OPTIONS: Array<{
  value: AdminAppearancePreference;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: "system",
    label: "System",
    description: "Follow this device",
    icon: <HiOutlineDesktopComputer aria-hidden="true" />,
  },
  {
    value: "light",
    label: "Light",
    description: "Bright portal",
    icon: <HiOutlineSun aria-hidden="true" />,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Dim portal",
    icon: <HiOutlineMoon aria-hidden="true" />,
  },
];

const emptyProfileForm = {
  username: "",
  firstName: "",
  lastName: "",
  personalEmail: "",
  phone: "",
  jobTitle: "",
  department: "",
  bio: "",
  avatarUrl: "",
  appearancePreference: "system" as AdminAppearancePreference,
};

const getInitials = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

const AdminPortalProfile: React.FC = () => {
  const { session, updateProfile } = useAdminPortal();
  const [form, setForm] = useState(emptyProfileForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useSEOMeta({
    title: "Profile | Stroane operations",
    description: "Update your Stroane portal profile and personal preferences.",
    canonical: portalUrl("/admin/profile"),
    noIndex: true,
  });

  useEffect(() => {
    if (!session) return;
    setForm({
      username: session.username || "",
      firstName: session.firstName || "",
      lastName: session.lastName || "",
      personalEmail: session.personalEmail || "",
      phone: session.phone || "",
      jobTitle: session.jobTitle || "",
      department: session.department || "",
      bio: session.bio || "",
      avatarUrl: session.avatarUrl || "",
      appearancePreference: session.appearancePreference || "system",
    });
  }, [session]);

  const previewName = useMemo(
    () =>
      [form.firstName, form.lastName].filter(Boolean).join(" ") ||
      getAdminDisplayName(session) ||
      form.username,
    [form.firstName, form.lastName, form.username, session]
  );

  if (!session) return null;

  const updateField = <Field extends keyof typeof emptyProfileForm>(
    field: Field,
    value: (typeof emptyProfileForm)[Field]
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage("");
    setError("");
  };

  const handleAvatarFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file for your avatar.");
      return;
    }
    if (file.size > MAX_AVATAR_FILE_BYTES) {
      setError("Choose an avatar image under 350 KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        updateField("avatarUrl", reader.result);
      }
    };
    reader.onerror = () => setError("Unable to read that avatar image.");
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const payload: AdminProfileUpdatePayload = {
      username: form.username,
      firstName: form.firstName,
      lastName: form.lastName,
      personalEmail: form.personalEmail,
      phone: form.phone,
      jobTitle: form.jobTitle,
      department: form.department,
      bio: form.bio,
      avatarUrl: form.avatarUrl,
      appearancePreference: form.appearancePreference,
    };

    try {
      await updateProfile(payload);
      setMessage("Profile updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="stroane-portal-profile">
      <header className="stroane-portal-profile__head">
        <div>
          <span>Personal workspace</span>
          <h1>Profile and preferences</h1>
          <p>Update the details shown across your private Stroane operations portal.</p>
        </div>
      </header>

      {message ? (
        <ERPFormNotice tone="success" title="Saved">
          {message}
        </ERPFormNotice>
      ) : null}

      {error ? (
        <ERPFormNotice tone="warning" title="Profile update">
          {error}
        </ERPFormNotice>
      ) : null}

      <form className="stroane-portal-profile__layout" onSubmit={handleSubmit}>
        <aside className="bubble-card stroane-portal-profile__preview" aria-label="Profile preview">
          <div className="stroane-portal-profile__avatar">
            {form.avatarUrl ? (
              <img src={form.avatarUrl} alt="" />
            ) : (
              <span>{getInitials(previewName)}</span>
            )}
          </div>
          <strong>{previewName}</strong>
          <small>@{form.username || session.username}</small>
          <p>{form.jobTitle || "Stroane portal user"}</p>
          <label className="stroane-portal-profile__upload">
            <HiOutlineCamera aria-hidden="true" />
            <span>Upload avatar</span>
            <input type="file" accept="image/*" onChange={handleAvatarFile} />
          </label>
          <button
            type="button"
            className="stroane-portal-profile__text-button"
            onClick={() => updateField("avatarUrl", "")}
            disabled={!form.avatarUrl}
          >
            Remove avatar
          </button>
        </aside>

        <div className="stroane-portal-profile__main">
          <section className="glass-card stroane-portal-profile__panel">
            <div className="stroane-portal-profile__panel-head">
              <span><HiOutlineUserCircle aria-hidden="true" /> Identity</span>
              <h2>Dashboard name</h2>
            </div>
            <div className="stroane-portal-profile__fields">
              <label>
                <span>First name</span>
                <input
                  value={form.firstName}
                  onChange={(event) => updateField("firstName", event.target.value)}
                  autoComplete="given-name"
                />
              </label>
              <label>
                <span>Last name</span>
                <input
                  value={form.lastName}
                  onChange={(event) => updateField("lastName", event.target.value)}
                  autoComplete="family-name"
                />
              </label>
              <label>
                <span>Username</span>
                <input
                  value={form.username}
                  onChange={(event) => updateField("username", event.target.value)}
                  autoComplete="username"
                  required
                />
              </label>
            </div>
          </section>

          <section className="glass-card stroane-portal-profile__panel">
            <div className="stroane-portal-profile__panel-head">
              <span>Contact details</span>
              <h2>Personal information</h2>
            </div>
            <div className="stroane-portal-profile__fields">
              <label>
                <span>Personal email</span>
                <input
                  type="email"
                  value={form.personalEmail}
                  onChange={(event) => updateField("personalEmail", event.target.value)}
                  autoComplete="email"
                />
              </label>
              <label>
                <span>Phone</span>
                <input
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  autoComplete="tel"
                />
              </label>
              <label>
                <span>Job title</span>
                <input
                  value={form.jobTitle}
                  onChange={(event) => updateField("jobTitle", event.target.value)}
                  autoComplete="organization-title"
                />
              </label>
              <label>
                <span>Department</span>
                <input
                  value={form.department}
                  onChange={(event) => updateField("department", event.target.value)}
                />
              </label>
              <label className="stroane-portal-profile__wide-field">
                <span>Avatar URL</span>
                <input
                  value={form.avatarUrl.startsWith("data:") ? "Uploaded avatar" : form.avatarUrl}
                  onChange={(event) => updateField("avatarUrl", event.target.value)}
                  disabled={form.avatarUrl.startsWith("data:")}
                />
              </label>
            </div>
          </section>

          <section className="glass-card stroane-portal-profile__panel">
            <div className="stroane-portal-profile__panel-head">
              <span>Preferences</span>
              <h2>Portal appearance</h2>
            </div>
            <div className="stroane-portal-profile__appearance" role="group" aria-label="Portal appearance">
              {APPEARANCE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={form.appearancePreference === option.value ? "is-active" : ""}
                  aria-pressed={form.appearancePreference === option.value}
                  onClick={() => updateField("appearancePreference", option.value)}
                >
                  {option.icon}
                  <span>
                    <strong>{option.label}</strong>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <div className="stroane-portal-profile__actions">
            <button type="submit" disabled={saving}>
              <HiOutlineCheckCircle aria-hidden="true" />
              <span>{saving ? "Saving profile" : "Save profile"}</span>
            </button>
          </div>
        </div>
      </form>
    </section>
  );
};

export default AdminPortalProfile;
