/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatedLoadingState, ERPFormNotice, SelectField } from "@faako/ui";
import "./AdminSettings.css";
import { useLocation, useNavigate } from "react-router-dom";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import AdminPageHeader from "../../components/AdminPageHeader/AdminPageHeader";
import { useAuth } from "../../components/AuthContext/AuthContext";
import { getAdminQuickActions } from "../../utils/adminQuickActions";
import {
  ADMIN_PREFERENCES_CHANGE_EVENT,
  ADMIN_FONT_SIZE_OPTIONS,
  ADMIN_THEME_OPTIONS,
  DEFAULT_ADMIN_PREFERENCES,
  readAdminPreferences,
  writeAdminPreferences,
} from "../../utils/adminPreferences";
import {
  loadCustomerSnapshot,
  loadInventorySnapshot,
  loadOfflineQueue,
} from "../../utils/offlineQueue";
import {
  COMMERCIAL_CONFIG_ENDPOINT,
  WATER_PRICE_TYPES,
  buildCommercialRulePayload,
  buildWaterPricePayload,
  formatCommercialRuleValue,
  formatWaterPrice,
  getCommercialScheduleAccess,
  getCoreRuleModels,
  getRuleInputBounds,
  groupWaterPriceSchedule,
  toDateInputValue,
} from "./commercialSettings";
import {
  DEFAULT_DOCUMENT_IDENTITY,
  cacheDocumentIdentity,
  loadPortalSettings,
  readCachedPortalConfig,
  savePortalSettingsSection,
} from "../../utils/portalSettings";

const defaultConfig = {
  currency: "GHS",
  taxRate: "0",
  transportRate: "0",
  ...DEFAULT_DOCUMENT_IDENTITY,
};
const SYSTEM_ADMIN_EMAIL = "system_admin@reebs.com";
const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const PROFILE_IMAGE_TARGET_SIZE = 320;
const PROFILE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const LOW_STOCK_THRESHOLD = 3;
const scheduleDateFormatter = new Intl.DateTimeFormat("en-GH", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const formatScheduleDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : scheduleDateFormatter.format(date);
};

const formatWaterPriceType = (value) =>
  WATER_PRICE_TYPES.find((option) => option.value === value)?.label || String(value || "Price");

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read the selected image."));
    reader.readAsDataURL(file);
  });

const loadImageElement = (src) =>
  new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to process the selected image."));
    image.src = src;
  });

const normalizeProfileImage = async (file) => {
  if (!PROFILE_IMAGE_TYPES.has(file.type)) {
    throw new Error("Upload a JPG, PNG, WEBP, or GIF image.");
  }
  if (file.size > PROFILE_IMAGE_MAX_BYTES) {
    throw new Error("Profile picture must be 2 MB or smaller.");
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImageElement(source);
  const width = image.naturalWidth || image.width || PROFILE_IMAGE_TARGET_SIZE;
  const height = image.naturalHeight || image.height || PROFILE_IMAGE_TARGET_SIZE;
  const cropSize = Math.max(1, Math.min(width, height));
  const offsetX = Math.max(0, (width - cropSize) / 2);
  const offsetY = Math.max(0, (height - cropSize) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = PROFILE_IMAGE_TARGET_SIZE;
  canvas.height = PROFILE_IMAGE_TARGET_SIZE;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Image processing is not available in this browser.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.clearRect(0, 0, PROFILE_IMAGE_TARGET_SIZE, PROFILE_IMAGE_TARGET_SIZE);
  context.drawImage(
    image,
    offsetX,
    offsetY,
    cropSize,
    cropSize,
    0,
    0,
    PROFILE_IMAGE_TARGET_SIZE,
    PROFILE_IMAGE_TARGET_SIZE,
  );

  const webpResult = canvas.toDataURL("image/webp", 0.86);
  if (webpResult.startsWith("data:image/webp")) {
    return webpResult;
  }
  return canvas.toDataURL("image/png");
};

const getInitials = (firstName, lastName, fallback = "") => {
  const firstParts = String(firstName || "")
    .split(/\s+/)
    .filter(Boolean);
  const lastParts = String(lastName || "")
    .split(/\s+/)
    .filter(Boolean);
  if (firstParts.length || lastParts.length) {
    return [firstParts[0], lastParts[lastParts.length - 1]]
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "TM";
  }
  if (fallback) {
    const fallbackParts = String(fallback)
      .split(/\s+/)
      .filter(Boolean);
    return [fallbackParts[0], fallbackParts[fallbackParts.length - 1]]
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  }
  return "TM";
};

function AdminSettings({ profileOnly = false }) {
  const { user, updateUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    password: "",
    imageUrl: "",
    personalEmail: "",
    jobTitle: "",
    phone: "",
    address: "",
  });
  const [profileStatus, setProfileStatus] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileImageError, setProfileImageError] = useState("");
  const [profileImageLoading, setProfileImageLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [preferencesForm, setPreferencesForm] = useState(DEFAULT_ADMIN_PREFERENCES);
  const [preferencesStatus, setPreferencesStatus] = useState("");
  const [preferencesError, setPreferencesError] = useState("");
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const preferencesRevisionRef = useRef(0);

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [inviteForm, setInviteForm] = useState({ firstName: "", lastName: "", role: "Staff", password: "" });
  const [inviteStatus, setInviteStatus] = useState("");

  const [configForm, setConfigForm] = useState(() => ({
    ...defaultConfig,
    ...readCachedPortalConfig(),
  }));
  const [configStatus, setConfigStatus] = useState("");
  const [configError, setConfigError] = useState("");
  const [configSaving, setConfigSaving] = useState(false);
  const [portalSettingsLoading, setPortalSettingsLoading] = useState(false);
  const [portalSettingsError, setPortalSettingsError] = useState("");
  const [canManageDocumentIdentity, setCanManageDocumentIdentity] = useState(false);
  const [commercialSchedule, setCommercialSchedule] = useState(null);
  const [commercialLoading, setCommercialLoading] = useState(false);
  const [commercialLoadError, setCommercialLoadError] = useState("");
  const [commercialSaveError, setCommercialSaveError] = useState("");
  const [commercialStatus, setCommercialStatus] = useState("");
  const [commercialSavingKey, setCommercialSavingKey] = useState("");
  const [commercialRuleDrafts, setCommercialRuleDrafts] = useState({});
  const [waterPriceDrafts, setWaterPriceDrafts] = useState({});
  const [newWaterPriceDraft, setNewWaterPriceDraft] = useState({
    productKey: "",
    productName: "",
    priceType: "RETAIL",
    minimumQuantity: "1",
    price: "",
    currency: "GHS",
    effectiveDate: toDateInputValue(),
  });
  const [advancedHealth, setAdvancedHealth] = useState({
    queuePending: 0,
    queueFailed: 0,
    inventorySnapshotItems: 0,
    customerSnapshotItems: 0,
    lowStockItems: 0,
  });

  const roleKey = (user?.role || "staff").toLowerCase();
  const isSystemAdmin = String(user?.email || "").trim().toLowerCase() === SYSTEM_ADMIN_EMAIL;
  const canViewUsers = ["owner", "admin", "manager"].includes(roleKey);
  const canCreateUsers = ["owner", "admin"].includes(roleKey);
  const canManageIdentityForRole = ["owner", "admin"].includes(roleKey);
  const commercialScheduleAccess = getCommercialScheduleAccess(roleKey);
  const canManageCommercialSchedule = commercialScheduleAccess.canManage;
  const canViewCoreCommercialSchedule = commercialScheduleAccess.canViewCore;
  const canViewWaterPriceSchedule = commercialScheduleAccess.canViewWater;
  const canViewCommercialSchedule = canViewCoreCommercialSchedule || canViewWaterPriceSchedule;
  const showTabs = !profileOnly;
  const pageTitle = profileOnly ? "My Profile" : "Settings";
  const pageSubtitle = profileOnly
    ? "Update your name, username, delivery email, password, photo, and system preferences."
    : "Manage your profile, staff access, commercial configuration, and portal controls.";
  const breadcrumbItems = [{ label: profileOnly ? "Profile" : "Settings" }];
  const legacyModuleLinks = useMemo(() => getAdminQuickActions(roleKey), [roleKey]);

  const selectSettingsTab = useCallback((tab) => {
    setActiveTab(tab);
    if (!profileOnly) {
      navigate(`/admin/settings?tab=${tab}`, { replace: true });
    }
  }, [navigate, profileOnly]);

  const syncUserProfile = (data) => {
    const nextFirstName = String(data?.firstName || "").trim();
    const nextLastName = String(data?.lastName || "").trim();
    const nextFullName =
      String(data?.fullName || "").trim()
      || [nextFirstName, nextLastName].filter(Boolean).join(" ");

    updateUser({
      id: data?.id || user?.id,
      firstName: nextFirstName,
      lastName: nextLastName,
      fullName: nextFullName,
      name: nextFullName,
      email: data?.email || user?.email,
      personalEmail: data?.personalEmail ?? "",
      role: data?.role || user?.role,
      imageUrl: data?.imageUrl || null,
      jobTitle: data?.jobTitle || "",
      phone: data?.phone || "",
      address: data?.address || "",
    });
  };

  useEffect(() => {
    if (profileOnly) {
      setActiveTab("profile");
      return;
    }
    const params = new URLSearchParams(location.search);
    const requestedTab = params.get("tab") === "commercial" ? "config" : params.get("tab");
    const allowedTabs = new Set(["profile", "users", "config", "advanced"]);
    if (!allowedTabs.has(requestedTab)) return;
    if (requestedTab === "users" && !canViewUsers) {
      setActiveTab("profile");
      return;
    }
    setActiveTab(requestedTab);
  }, [canViewUsers, location.search, profileOnly]);

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  const hydrateCommercialDrafts = useCallback((schedule) => {
    const effectiveDate = toDateInputValue();
    setCommercialRuleDrafts(Object.fromEntries(
      getCoreRuleModels(schedule).map(({ definition }) => [
        definition.key,
        { value: "", effectiveDate },
      ]),
    ));
    setWaterPriceDrafts(Object.fromEntries(
      groupWaterPriceSchedule(schedule).map(({ key, reference }) => [
        key,
        {
          price: "",
          minimumQuantity: String(reference?.minimumQuantity || 1),
          currency: String(reference?.currency || "GHS").toUpperCase(),
          effectiveDate,
        },
      ]),
    ));
  }, []);

  const loadCommercialSchedule = useCallback(async () => {
    if (!canViewCommercialSchedule) {
      setCommercialSchedule(null);
      setCommercialLoadError("");
      return;
    }
    setCommercialLoading(true);
    setCommercialLoadError("");
    try {
      const response = await fetch(`${COMMERCIAL_CONFIG_ENDPOINT}?view=schedule`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load the shared commercial schedule.");
      }
      setCommercialSchedule(data);
      hydrateCommercialDrafts(data);
    } catch (error) {
      setCommercialLoadError(error.message || "Failed to load the shared commercial schedule.");
    } finally {
      setCommercialLoading(false);
    }
  }, [canViewCommercialSchedule, hydrateCommercialDrafts]);

  useEffect(() => {
    if (activeTab !== "config") return;
    loadCommercialSchedule();
  }, [activeTab, loadCommercialSchedule]);

  const coreRuleModels = useMemo(
    () => getCoreRuleModels(commercialSchedule || {}),
    [commercialSchedule],
  );
  const waterPriceGroups = useMemo(
    () => groupWaterPriceSchedule(commercialSchedule || {}),
    [commercialSchedule],
  );

  useEffect(() => {
    const name =
      user?.fullName ||
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
      user?.name ||
      "";
    const parts = name.trim().split(" ").filter(Boolean);
    const firstName = String(user?.firstName || parts[0] || "").trim();
    const lastName = String(user?.lastName || parts.slice(1).join(" ") || "").trim();
    setProfileForm((prev) => ({
      ...prev,
      firstName,
      lastName,
      imageUrl: String(user?.imageUrl || "").trim(),
      personalEmail: String(user?.personalEmail || "").trim(),
      jobTitle: String(user?.jobTitle || "").trim(),
      phone: String(user?.phone || "").trim(),
      address: String(user?.address || "").trim(),
    }));
  }, [user]);

  useEffect(() => {
    setPreferencesForm(readAdminPreferences(user?.id));
    setPreferencesStatus("");
    setPreferencesError("");

    const handlePreferenceChange = (event) => {
      const changedUserId = String(event?.detail?.userId || "guest");
      if (changedUserId !== String(user?.id || "guest")) return;
      preferencesRevisionRef.current += 1;
      setPreferencesForm(event?.detail?.preferences || readAdminPreferences(user?.id));
    };
    window.addEventListener(ADMIN_PREFERENCES_CHANGE_EVENT, handlePreferenceChange);
    return () => window.removeEventListener(ADMIN_PREFERENCES_CHANGE_EVENT, handlePreferenceChange);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const controller = new AbortController();
    let ignore = false;

    const syncPortalSettings = async () => {
      const loadRevision = preferencesRevisionRef.current;
      setPortalSettingsLoading(true);
      setPortalSettingsError("");
      try {
        const data = await loadPortalSettings({ signal: controller.signal });
        if (ignore) return;
        if (
          data?.preferences
          && preferencesRevisionRef.current === loadRevision
        ) {
          setPreferencesForm(writeAdminPreferences(user.id, data.preferences));
        }
        if (data?.documentIdentity) {
          const identity = cacheDocumentIdentity(data.documentIdentity);
          setConfigForm((previous) => ({ ...previous, ...identity }));
        }
        setCanManageDocumentIdentity(
          Boolean(data?.capabilities?.canManageDocumentIdentity) && canManageIdentityForRole,
        );
      } catch (error) {
        if (error?.name !== "AbortError" && !ignore) {
          setPortalSettingsError(error.message || "Shared portal settings could not be loaded.");
          setCanManageDocumentIdentity(canManageIdentityForRole);
        }
      } finally {
        if (!ignore) setPortalSettingsLoading(false);
      }
    };

    syncPortalSettings();
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [canManageIdentityForRole, user?.id]);

  useEffect(() => {
    if (activeTab !== "profile") return;
    let ignore = false;

    const loadProfile = async () => {
      setProfileLoading(true);
      setProfileError("");
      try {
        const response = await fetch("/api/staffProfile");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load profile.");
        }
        if (ignore) return;
        setProfileForm((prev) => ({
          ...prev,
          firstName: String(data.firstName || "").trim(),
          lastName: String(data.lastName || "").trim(),
          imageUrl: String(data.imageUrl || "").trim(),
          personalEmail: String(data.personalEmail || "").trim(),
          jobTitle: String(data.jobTitle || "").trim(),
          phone: String(data.phone || "").trim(),
          address: String(data.address || "").trim(),
        }));
        syncUserProfile(data);
      } catch (error) {
        if (!ignore) {
          setProfileError(error.message || "Failed to load profile.");
        }
      } finally {
        if (!ignore) {
          setProfileLoading(false);
        }
      }
    };

    loadProfile();
    return () => {
      ignore = true;
    };
  }, [activeTab]);

  const refreshAdvancedHealth = useCallback(() => {
    const queue = loadOfflineQueue();
    const inventorySnapshot = loadInventorySnapshot();
    const customerSnapshot = loadCustomerSnapshot();
    const lowStockItems = inventorySnapshot.filter((item) => {
      const quantity = Number(item?.quantity ?? item?.stock ?? item?.stockOnHand ?? 0);
      return Number.isFinite(quantity) && quantity <= LOW_STOCK_THRESHOLD;
    }).length;

    setAdvancedHealth({
      queuePending: queue.filter((item) => item?.status === "pending").length,
      queueFailed: queue.filter((item) => item?.status === "failed").length,
      inventorySnapshotItems: inventorySnapshot.length,
      customerSnapshotItems: customerSnapshot.length,
      lowStockItems,
    });
  }, []);

  useEffect(() => {
    if (activeTab !== "advanced") return;
    refreshAdvancedHealth();
  }, [activeTab, refreshAdvancedHealth]);

  const profileInitials = useMemo(
    () =>
      getInitials(
        profileForm.firstName,
        profileForm.lastName,
        user?.fullName ||
          [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
          user?.name ||
          "",
      ),
    [profileForm.firstName, profileForm.lastName, user?.firstName, user?.lastName, user?.fullName, user?.name],
  );

  const fetchUsers = async () => {
    setUsersLoading(true);
    setUsersError("");
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load users");
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Users load failed", err);
      setUsersError(err.message || "Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "users" || !canViewUsers) return;
    fetchUsers();
  }, [activeTab, canViewUsers]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileStatus("");
    setProfileError("");
    setProfileImageError("");
    if (!profileForm.firstName || !profileForm.lastName) {
      setProfileError("First and last name are required.");
      return;
    }
    if (profileForm.password && profileForm.password.length < 8) {
      setProfileError("New password must be at least 8 characters.");
      return;
    }
    try {
      const res = await fetch("/api/staffProfile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: profileForm.firstName,
          lastName: profileForm.lastName,
          password: profileForm.password || undefined,
          imageUrl: profileForm.imageUrl || null,
          personalEmail: profileForm.personalEmail,
          jobTitle: profileForm.jobTitle,
          phone: profileForm.phone,
          address: profileForm.address,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update profile");
      setProfileForm((prev) => ({
        ...prev,
        firstName: String(data.firstName || "").trim(),
        lastName: String(data.lastName || "").trim(),
        password: "",
        imageUrl: String(data.imageUrl || "").trim(),
        personalEmail: String(data.personalEmail || "").trim(),
        jobTitle: String(data.jobTitle || "").trim(),
        phone: String(data.phone || "").trim(),
        address: String(data.address || "").trim(),
      }));
      syncUserProfile(data);
      setProfileStatus("Profile updated.");
    } catch (err) {
      console.error("Profile save failed", err);
      setProfileError(err.message || "Failed to update profile");
    }
  };

  const handleProfileImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setProfileStatus("");
    setProfileError("");
    setProfileImageError("");
    setProfileImageLoading(true);
    try {
      const imageUrl = await normalizeProfileImage(file);
      setProfileForm((prev) => ({ ...prev, imageUrl }));
    } catch (error) {
      setProfileImageError(error.message || "Failed to process the selected image.");
    } finally {
      setProfileImageLoading(false);
    }
  };

  const removeProfileImage = () => {
    setProfileStatus("");
    setProfileError("");
    setProfileImageError("");
    setProfileForm((prev) => ({ ...prev, imageUrl: "" }));
  };

  const inviteUser = async (event) => {
    event.preventDefault();
    if (!canCreateUsers) return;
    setInviteStatus("");
    setUsersError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to add user");
      setUsers((prev) => [data, ...prev]);
      setInviteStatus("User added.");
      setInviteForm({ firstName: "", lastName: "", role: "Staff", password: "" });
    } catch (err) {
      console.error("Invite failed", err);
      setUsersError(err.message || "Failed to add user");
    }
  };

  const postCommercialResource = async (payload) => {
    const response = await fetch(COMMERCIAL_CONFIG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || "The commercial schedule was not updated.");
    }
    return data;
  };

  const saveCommercialRule = async (event, model) => {
    event.preventDefault();
    if (!canManageCommercialSchedule) return;
    const savingKey = `rule:${model.definition.key}`;
    setCommercialSavingKey(savingKey);
    setCommercialSaveError("");
    setCommercialStatus("");
    try {
      const payload = buildCommercialRulePayload(
        commercialRuleDrafts[model.definition.key],
        model.definition,
        model.metadata,
      );
      await postCommercialResource(payload);
      setCommercialStatus(`${model.metadata.label} scheduled successfully.`);
      await loadCommercialSchedule();
    } catch (error) {
      setCommercialSaveError(error.message || "The REEBS Core rule was not scheduled.");
    } finally {
      setCommercialSavingKey("");
    }
  };

  const saveWaterPrice = async (event, group) => {
    event.preventDefault();
    if (!canManageCommercialSchedule) return;
    const savingKey = `water:${group.key}`;
    setCommercialSavingKey(savingKey);
    setCommercialSaveError("");
    setCommercialStatus("");
    try {
      const payload = buildWaterPricePayload(waterPriceDrafts[group.key], group.reference);
      await postCommercialResource(payload);
      setCommercialStatus(
        `${group.reference.productName} ${formatWaterPriceType(group.reference.priceType).toLowerCase()} price scheduled successfully.`,
      );
      await loadCommercialSchedule();
    } catch (error) {
      setCommercialSaveError(error.message || "The Water price was not scheduled.");
    } finally {
      setCommercialSavingKey("");
    }
  };

  const addWaterPrice = async (event) => {
    event.preventDefault();
    if (!canManageCommercialSchedule) return;
    setCommercialSavingKey("water:new");
    setCommercialSaveError("");
    setCommercialStatus("");
    try {
      const payload = buildWaterPricePayload(newWaterPriceDraft);
      await postCommercialResource(payload);
      setCommercialStatus(`${payload.productName} Water price scheduled successfully.`);
      setNewWaterPriceDraft({
        productKey: "",
        productName: "",
        priceType: "RETAIL",
        minimumQuantity: "1",
        price: "",
        currency: "GHS",
        effectiveDate: toDateInputValue(),
      });
      await loadCommercialSchedule();
    } catch (error) {
      setCommercialSaveError(error.message || "The Water price was not scheduled.");
    } finally {
      setCommercialSavingKey("");
    }
  };

  const saveConfig = async (event) => {
    event.preventDefault();
    if (!canManageDocumentIdentity) return;
    setConfigStatus("");
    setConfigError("");
    setConfigSaving(true);
    try {
      const data = await savePortalSettingsSection("documentIdentity", {
        storeName: configForm.storeName,
        storeEmail: configForm.storeEmail,
        storePhone: configForm.storePhone,
        storeAddress: configForm.storeAddress,
      });
      const identity = cacheDocumentIdentity(data?.documentIdentity || configForm);
      setConfigForm((previous) => ({ ...previous, ...identity }));
      setConfigStatus("Document identity saved for this organization.");
    } catch (error) {
      setConfigError(error.message || "Document identity could not be saved.");
    } finally {
      setConfigSaving(false);
    }
  };

  const savePreferences = async (event) => {
    event.preventDefault();
    setPreferencesStatus("");
    setPreferencesError("");
    setPreferencesSaving(true);
    try {
      const data = await savePortalSettingsSection("preferences", preferencesForm);
      const nextPreferences = writeAdminPreferences(
        user?.id,
        data?.preferences || preferencesForm,
      );
      setPreferencesForm(nextPreferences);
      setPreferencesStatus("System preferences updated and synced.");
    } catch (error) {
      setPreferencesError(error.message || "System preferences could not be saved.");
    } finally {
      setPreferencesSaving(false);
    }
  };

  const handleSettingsTabKeyDown = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = Array.from(
      event.currentTarget.querySelectorAll('[role="tab"]:not(:disabled)'),
    );
    if (!tabs.length) return;
    event.preventDefault();
    const currentIndex = tabs.indexOf(document.activeElement);
    let nextIndex = currentIndex;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (event.key === "ArrowRight") {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % tabs.length;
    }
    if (event.key === "ArrowLeft") {
      nextIndex = currentIndex <= 0 ? tabs.length - 1 : currentIndex - 1;
    }
    tabs[nextIndex]?.focus();
    tabs[nextIndex]?.click();
  };

  return (
    <div className="settings-page">
      <div className="settings-shell">
        <AdminBreadcrumb items={breadcrumbItems} />

        <AdminPageHeader title={pageTitle} subtitle={pageSubtitle} />

        {showTabs && (
          <div
            className="settings-tabs"
            role="tablist"
            aria-label="Settings sections"
            onKeyDown={handleSettingsTabKeyDown}
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "profile"}
              tabIndex={activeTab === "profile" ? 0 : -1}
              className={activeTab === "profile" ? "is-active" : ""}
              onClick={() => selectSettingsTab("profile")}
            >
              Profile
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "users"}
              tabIndex={activeTab === "users" ? 0 : -1}
              className={activeTab === "users" ? "is-active" : ""}
              onClick={() => selectSettingsTab("users")}
              disabled={!canViewUsers}
            >
              User Management
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "config"}
              tabIndex={activeTab === "config" ? 0 : -1}
              className={activeTab === "config" ? "is-active" : ""}
              onClick={() => selectSettingsTab("config")}
            >
              Commercial Config
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "advanced"}
              tabIndex={activeTab === "advanced" ? 0 : -1}
              className={activeTab === "advanced" ? "is-active" : ""}
              onClick={() => selectSettingsTab("advanced")}
            >
              Advanced
            </button>
          </div>
        )}

        {activeTab === "profile" && (
          <>
            <section className="glass-card settings-panel">
              <form className="settings-form" onSubmit={saveProfile}>
                {profileLoading && (
                  <AnimatedLoadingState
                    compact
                    className="glass-card admin-module-loading"
                    title="Loading profile"
                    message="Fetching your saved profile details."
                    variant="detail"
                  />
                )}
                <div className="settings-profile-media">
                  <div className="settings-profile-avatar" aria-hidden="true">
                    {profileForm.imageUrl ? (
                      <img src={profileForm.imageUrl} alt="" />
                    ) : (
                      <span>{profileInitials}</span>
                    )}
                  </div>
                  <div className="settings-profile-media-copy">
                    <p>Profile picture</p>
                    <div className="settings-profile-media-actions">
                      <label className="settings-profile-upload">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={handleProfileImageChange}
                        />
                        <span>{profileImageLoading ? "Processing..." : "Upload photo"}</span>
                      </label>
                      {profileForm.imageUrl && (
                        <button
                          type="button"
                          className="settings-profile-remove"
                          onClick={removeProfileImage}
                        >
                          Remove photo
                        </button>
                      )}
                    </div>
                    <p className="settings-profile-note">
                      JPG, PNG, WEBP, or GIF up to 2 MB. The image is cropped to a square avatar.
                    </p>
                    {profileImageError && (
                      <ERPFormNotice tone="danger" title="Photo not updated" onDismiss={() => setProfileImageError("")}>
                        {profileImageError}
                      </ERPFormNotice>
                    )}
                  </div>
                </div>
                <div className="settings-grid">
                  <label>
                    First name
                    <input
                      type="text"
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, firstName: e.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Last name
                    <input
                      type="text"
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, lastName: e.target.value }))}
                      required
                    />
                  </label>
                </div>
                <div className="settings-grid settings-grid--profile-details">
                  <label>
                    Personal email
                    <input
                      type="email"
                      value={profileForm.personalEmail}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, personalEmail: e.target.value }))}
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                    <span className="settings-muted">
                      Password reset links are sent here.
                    </span>
                  </label>
                  <label>
                    Phone number
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="+233 24 000 0000"
                      autoComplete="tel"
                    />
                  </label>
                </div>
                <label>
                  Address
                  <textarea
                    value={profileForm.address}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder="House number, street, area, city"
                    rows={3}
                    autoComplete="street-address"
                  />
                </label>
                <label>
                  Portal username
                  <input type="text" value={user?.email || ""} readOnly />
                  <span className="settings-muted">
                    This autogenerated `@reebs.com` value is your login ID, not your delivery inbox.
                  </span>
                </label>
                <label>
                  Reset password
                  <input
                    type="password"
                    value={profileForm.password}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder="New password"
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <span className="settings-muted">Use at least 8 characters.</span>
                </label>
                {profileError && (
                  <ERPFormNotice tone="danger" title="Profile not saved" onDismiss={() => setProfileError("")}>
                    {profileError}
                  </ERPFormNotice>
                )}
                {profileStatus && (
                  <ERPFormNotice tone="success" title="Profile saved" onDismiss={() => setProfileStatus("")}>
                    {profileStatus}
                  </ERPFormNotice>
                )}
                <div className="settings-actions">
                  <button type="submit" className="settings-primary">Save profile</button>
                </div>
              </form>
            </section>

            <section className="glass-card settings-panel">
              <div className="settings-panel-head">
                <div>
                  <h3>System preferences</h3>
                  <p className="settings-muted">
                    Choose how REEBS Portal looks for your account across signed-in devices.
                  </p>
                </div>
              </div>
              <form className="settings-form" onSubmit={savePreferences}>
                <div className="settings-grid settings-grid--preferences">
                  <SelectField
                    label="Theme mode"
                    fieldClassName="settings-select"
                    value={preferencesForm.theme}
                    disabled={portalSettingsLoading || preferencesSaving}
                    onChange={(e) => {
                      setPreferencesStatus("");
                      setPreferencesForm((prev) => ({ ...prev, theme: e.target.value }));
                    }}
                  >
                    {ADMIN_THEME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    label="Font size"
                    fieldClassName="settings-select"
                    value={preferencesForm.fontSize}
                    disabled={portalSettingsLoading || preferencesSaving}
                    onChange={(e) => {
                      setPreferencesStatus("");
                      setPreferencesForm((prev) => ({ ...prev, fontSize: e.target.value }));
                    }}
                  >
                    {ADMIN_FONT_SIZE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </SelectField>
                </div>
                <p className="settings-muted settings-preferences-note">
                  Preferences are saved to your account and cached locally so they can apply immediately.
                </p>
                {portalSettingsLoading && (
                  <p className="settings-muted" role="status">Syncing saved portal preferences…</p>
                )}
                {portalSettingsError && (
                  <ERPFormNotice tone="danger" title="Settings sync unavailable" onDismiss={() => setPortalSettingsError("")}>
                    {portalSettingsError} Your cached appearance remains active.
                  </ERPFormNotice>
                )}
                {preferencesError && (
                  <ERPFormNotice tone="danger" title="Preferences not saved" onDismiss={() => setPreferencesError("")}>
                    {preferencesError}
                  </ERPFormNotice>
                )}
                {preferencesStatus && (
                  <ERPFormNotice tone="success" title="Preferences saved" onDismiss={() => setPreferencesStatus("")}>
                    {preferencesStatus}
                  </ERPFormNotice>
                )}
                <div className="settings-actions">
                  <button
                    type="submit"
                    className="settings-primary"
                    disabled={portalSettingsLoading || preferencesSaving}
                  >
                    {preferencesSaving ? "Saving…" : "Save preferences"}
                  </button>
                </div>
              </form>
            </section>
          </>
        )}

        {activeTab === "users" && (
          <section className="glass-card settings-panel">
            <div className="settings-panel-head settings-panel-head--split">
              <div>
                <h3>User management</h3>
                <p className="settings-muted">
                  Review staff access. Owners and admins can add standard operational accounts.
                </p>
              </div>
              {isSystemAdmin && (
                <button
                  type="button"
                  className="settings-advanced-refresh"
                  onClick={() => navigate("/admin/roles")}
                >
                  Manage roles &amp; permissions
                </button>
              )}
            </div>
            {usersLoading && (
              <AnimatedLoadingState
                compact
                className="glass-card admin-module-loading"
                title="Loading users"
                message="Fetching staff accounts and role assignments."
                variant="dashboard"
              />
            )}
            {usersError && (
              <ERPFormNotice tone="danger" title="User update failed" onDismiss={() => setUsersError("")}>
                {usersError}
              </ERPFormNotice>
            )}
            <div className="settings-users">
              <div className="settings-users-list">
                {users.map((member) => (
                  <div key={member.id} className="glass-card settings-user-card">
                    <div>
                      <strong>{member.fullName || member.name || "Unnamed"}</strong>
                      <p className="settings-muted">{member.email}</p>
                    </div>
                    <span className="settings-role">{member.role}</span>
                  </div>
                ))}
                {!usersLoading && users.length === 0 && (
                  <p className="settings-muted">No users found.</p>
                )}
              </div>
              <aside className="settings-sidebar">
                <h4>{canCreateUsers ? "Add new user" : "Account access"}</h4>
                {canCreateUsers ? (
                  <form className="settings-form" onSubmit={inviteUser}>
                  <label>
                    First name
                    <input
                      type="text"
                      value={inviteForm.firstName}
                      onChange={(e) => setInviteForm((prev) => ({ ...prev, firstName: e.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Last name
                    <input
                      type="text"
                      value={inviteForm.lastName}
                      onChange={(e) => setInviteForm((prev) => ({ ...prev, lastName: e.target.value }))}
                      required
                    />
                  </label>
                  <SelectField
                    label="Role"
                    fieldClassName="settings-select"
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm((prev) => ({ ...prev, role: e.target.value }))}
                  >
                    <option value="Staff">Staff</option>
                    <option value="Warehouse">Warehouse</option>
                    <option value="Driver">Driver</option>
                    {isSystemAdmin && <option value="Owner">Owner</option>}
                    {isSystemAdmin && <option value="Admin">Admin</option>}
                    {isSystemAdmin && <option value="Manager">Manager</option>}
                    {isSystemAdmin && <option value="Water">Water</option>}
                  </SelectField>
                  <label>
                    Initial password
                    <input
                      type="password"
                      value={inviteForm.password}
                      onChange={(e) => setInviteForm((prev) => ({ ...prev, password: e.target.value }))}
                      minLength={8}
                      autoComplete="new-password"
                      required
                    />
                    <span className="settings-muted">
                      Use at least 8 characters and share it through a secure channel.
                    </span>
                  </label>
                  {inviteStatus && (
                    <ERPFormNotice tone="success" title="User added" onDismiss={() => setInviteStatus("")}>
                      {inviteStatus}
                    </ERPFormNotice>
                  )}
                  <button type="submit" className="settings-primary">Add user</button>
                  </form>
                ) : (
                  <p className="settings-muted">
                    Your role can review staff accounts. An owner or administrator must create new accounts.
                  </p>
                )}
              </aside>
            </div>
          </section>
        )}

        {activeTab === "config" && (
          <>
            {commercialSaveError && (
              <ERPFormNotice
                tone="danger"
                title="Commercial schedule not updated"
                onDismiss={() => setCommercialSaveError("")}
              >
                {commercialSaveError}
              </ERPFormNotice>
            )}
            {commercialStatus && (
              <ERPFormNotice
                tone="success"
                title="Commercial schedule updated"
                onDismiss={() => setCommercialStatus("")}
              >
                {commercialStatus}
              </ERPFormNotice>
            )}
            {commercialLoadError && (
              <div className="settings-commercial-load-error">
                <ERPFormNotice
                  tone="danger"
                  title="Commercial schedule unavailable"
                  onDismiss={() => setCommercialLoadError("")}
                >
                  {commercialLoadError}
                </ERPFormNotice>
                <button
                  type="button"
                  className="settings-advanced-refresh"
                  onClick={loadCommercialSchedule}
                  disabled={commercialLoading}
                >
                  Try again
                </button>
              </div>
            )}

            <section className="glass-card settings-panel settings-commercial-panel">
              <div className="settings-panel-head settings-panel-head--split">
                <div>
                  <p className="settings-commercial-eyebrow">REEBS Core</p>
                  <h3>Booking, delivery and deposit rules</h3>
                  <p className="settings-muted">
                    Shared, effective-dated rules for the REEBS rental and event business. Water is excluded.
                  </p>
                </div>
                {!canManageCommercialSchedule && canViewCoreCommercialSchedule && (
                  <span className="settings-commercial-access">Read only</span>
                )}
              </div>

              {commercialLoading && canViewCoreCommercialSchedule && (
                <AnimatedLoadingState
                  compact
                  className="glass-card admin-module-loading"
                  title="Loading REEBS Core rules"
                  message="Fetching the current and scheduled commercial values."
                  variant="detail"
                />
              )}

              {!canViewCoreCommercialSchedule ? (
                <p className="settings-commercial-empty">
                  REEBS Core commercial rules are available to managers, admins and owners.
                </p>
              ) : !commercialLoading && !commercialLoadError && coreRuleModels.length === 0 ? (
                <p className="settings-commercial-empty">
                  No supported REEBS Core rule definitions are available.
                </p>
              ) : (
                <div className="settings-commercial-list">
                  {coreRuleModels.map((model) => {
                    const draft = commercialRuleDrafts[model.definition.key] || {
                      value: "",
                      effectiveDate: toDateInputValue(),
                    };
                    const bounds = getRuleInputBounds(model.definition);
                    const savingKey = `rule:${model.definition.key}`;
                    const isSaving = commercialSavingKey === savingKey;
                    return (
                      <form
                        key={model.definition.key}
                        className="settings-commercial-row"
                        onSubmit={(event) => saveCommercialRule(event, model)}
                      >
                        <div className="settings-commercial-current">
                          <span className="settings-commercial-step">Current</span>
                          <strong>{model.metadata.label}</strong>
                          <span className="settings-commercial-value">
                            {formatCommercialRuleValue(model.current, model.metadata)}
                          </span>
                          <small>{model.metadata.description}</small>
                          {model.upcoming && (
                            <small className="settings-commercial-upcoming">
                              Scheduled: {formatCommercialRuleValue(model.upcoming, model.metadata)} from{" "}
                              {formatScheduleDate(model.upcoming.effectiveFrom)}
                            </small>
                          )}
                        </div>
                        <label className="settings-commercial-field">
                          <span className="settings-commercial-step">New</span>
                          <span>{model.metadata.inputLabel}</span>
                          <div className="settings-commercial-input-with-unit">
                            <input
                              type="number"
                              min={bounds.min}
                              max={bounds.max}
                              step={bounds.step}
                              value={draft.value}
                              onChange={(event) => {
                                setCommercialSaveError("");
                                setCommercialRuleDrafts((previous) => ({
                                  ...previous,
                                  [model.definition.key]: { ...draft, value: event.target.value },
                                }));
                              }}
                              placeholder={canManageCommercialSchedule ? "Enter new value" : "Owner/admin only"}
                              disabled={!canManageCommercialSchedule || Boolean(commercialSavingKey)}
                              required={canManageCommercialSchedule}
                            />
                            <span>{model.metadata.displayUnit}</span>
                          </div>
                        </label>
                        <label className="settings-commercial-field">
                          <span className="settings-commercial-step">Effective date</span>
                          <span>Starts on</span>
                          <input
                            type="date"
                            min={toDateInputValue()}
                            value={draft.effectiveDate}
                            onChange={(event) => setCommercialRuleDrafts((previous) => ({
                              ...previous,
                              [model.definition.key]: { ...draft, effectiveDate: event.target.value },
                            }))}
                            disabled={!canManageCommercialSchedule || Boolean(commercialSavingKey)}
                            required={canManageCommercialSchedule}
                          />
                        </label>
                        <button
                          type="submit"
                          className="settings-primary settings-commercial-save"
                          disabled={!canManageCommercialSchedule || Boolean(commercialSavingKey)}
                        >
                          {isSaving ? "Saving..." : canManageCommercialSchedule ? "Schedule" : "Read only"}
                        </button>
                      </form>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="glass-card settings-panel settings-commercial-panel settings-commercial-panel--water">
              <div className="settings-panel-head settings-panel-head--split">
                <div>
                  <p className="settings-commercial-eyebrow settings-commercial-eyebrow--water">Water Business</p>
                  <h3>Water pricing schedule</h3>
                  <p className="settings-muted">
                    Standalone Water product prices. These values do not become REEBS rental or event revenue.
                  </p>
                </div>
                {!canManageCommercialSchedule && canViewWaterPriceSchedule && (
                  <span className="settings-commercial-access settings-commercial-access--water">Read only</span>
                )}
              </div>

              {commercialLoading && canViewWaterPriceSchedule && !canViewCoreCommercialSchedule && (
                <AnimatedLoadingState
                  compact
                  className="glass-card admin-module-loading"
                  title="Loading Water prices"
                  message="Fetching the current and scheduled Water price list."
                  variant="detail"
                />
              )}

              {!canViewWaterPriceSchedule ? (
                <p className="settings-commercial-empty settings-commercial-empty--water">
                  Water pricing is visible to authorized Water staff, admins and owners.
                </p>
              ) : !commercialLoading && !commercialLoadError && waterPriceGroups.length === 0 ? (
                <p className="settings-commercial-empty settings-commercial-empty--water">
                  No Water prices have been scheduled yet.
                </p>
              ) : (
                <div className="settings-commercial-list">
                  {waterPriceGroups.map((group) => {
                    const draft = waterPriceDrafts[group.key] || {
                      price: "",
                      minimumQuantity: String(group.reference?.minimumQuantity || 1),
                      currency: String(group.reference?.currency || "GHS"),
                      effectiveDate: toDateInputValue(),
                    };
                    const savingKey = `water:${group.key}`;
                    const isSaving = commercialSavingKey === savingKey;
                    return (
                      <form
                        key={group.key}
                        className="settings-commercial-row settings-commercial-row--water"
                        onSubmit={(event) => saveWaterPrice(event, group)}
                      >
                        <div className="settings-commercial-current">
                          <span className="settings-commercial-step">Current</span>
                          <strong>{group.reference?.productName || group.reference?.productKey}</strong>
                          <span className="settings-commercial-price-type">
                            {formatWaterPriceType(group.reference?.priceType)}
                          </span>
                          <span className="settings-commercial-value">{formatWaterPrice(group.current)}</span>
                          <small>
                            Minimum {group.current?.minimumQuantity || group.reference?.minimumQuantity || 1} units
                          </small>
                          {group.upcoming && (
                            <small className="settings-commercial-upcoming">
                              Scheduled: {formatWaterPrice(group.upcoming)} from{" "}
                              {formatScheduleDate(group.upcoming.effectiveFrom)}
                            </small>
                          )}
                        </div>
                        <div className="settings-commercial-field settings-commercial-field--price">
                          <span className="settings-commercial-step">New</span>
                          <div className="settings-commercial-price-fields">
                            <label>
                              Price
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={draft.price}
                                onChange={(event) => {
                                  setCommercialSaveError("");
                                  setWaterPriceDrafts((previous) => ({
                                    ...previous,
                                    [group.key]: { ...draft, price: event.target.value },
                                  }));
                                }}
                                placeholder="0.00"
                                disabled={!canManageCommercialSchedule || Boolean(commercialSavingKey)}
                                required={canManageCommercialSchedule}
                              />
                            </label>
                            <label>
                              Currency
                              <input
                                type="text"
                                value={draft.currency}
                                maxLength={3}
                                onChange={(event) => setWaterPriceDrafts((previous) => ({
                                  ...previous,
                                  [group.key]: { ...draft, currency: event.target.value.toUpperCase() },
                                }))}
                                disabled={!canManageCommercialSchedule || Boolean(commercialSavingKey)}
                                required={canManageCommercialSchedule}
                              />
                            </label>
                            <label>
                              Minimum quantity
                              <input
                                type="number"
                                min="1"
                                max="100000"
                                step="1"
                                value={draft.minimumQuantity}
                                onChange={(event) => setWaterPriceDrafts((previous) => ({
                                  ...previous,
                                  [group.key]: { ...draft, minimumQuantity: event.target.value },
                                }))}
                                disabled={!canManageCommercialSchedule || Boolean(commercialSavingKey)}
                                required={canManageCommercialSchedule}
                              />
                            </label>
                          </div>
                        </div>
                        <label className="settings-commercial-field">
                          <span className="settings-commercial-step">Effective date</span>
                          <span>Starts on</span>
                          <input
                            type="date"
                            min={toDateInputValue()}
                            value={draft.effectiveDate}
                            onChange={(event) => setWaterPriceDrafts((previous) => ({
                              ...previous,
                              [group.key]: { ...draft, effectiveDate: event.target.value },
                            }))}
                            disabled={!canManageCommercialSchedule || Boolean(commercialSavingKey)}
                            required={canManageCommercialSchedule}
                          />
                        </label>
                        <button
                          type="submit"
                          className="settings-primary settings-commercial-save settings-commercial-save--water"
                          disabled={!canManageCommercialSchedule || Boolean(commercialSavingKey)}
                        >
                          {isSaving ? "Saving..." : canManageCommercialSchedule ? "Schedule" : "Read only"}
                        </button>
                      </form>
                    );
                  })}
                </div>
              )}

              {canManageCommercialSchedule && canViewWaterPriceSchedule && (
                <details className="settings-commercial-new-water">
                  <summary>Add a Water price schedule</summary>
                  <form className="settings-form" onSubmit={addWaterPrice}>
                    <div className="settings-grid">
                      <label>
                        Product name
                        <input
                          type="text"
                          maxLength={160}
                          value={newWaterPriceDraft.productName}
                          onChange={(event) => setNewWaterPriceDraft((previous) => ({
                            ...previous,
                            productName: event.target.value,
                          }))}
                          placeholder="500 ml bottle"
                          disabled={Boolean(commercialSavingKey)}
                          required
                        />
                      </label>
                      <label>
                        Product key
                        <input
                          type="text"
                          value={newWaterPriceDraft.productKey}
                          onChange={(event) => setNewWaterPriceDraft((previous) => ({
                            ...previous,
                            productKey: event.target.value.toLowerCase(),
                          }))}
                          placeholder="500ml-bottle"
                          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                          disabled={Boolean(commercialSavingKey)}
                          required
                        />
                        <span className="settings-muted">Lowercase letters, numbers and hyphens.</span>
                      </label>
                      <SelectField
                        label="Price type"
                        fieldClassName="settings-select"
                        value={newWaterPriceDraft.priceType}
                        onChange={(event) => setNewWaterPriceDraft((previous) => ({
                          ...previous,
                          priceType: event.target.value,
                        }))}
                        disabled={Boolean(commercialSavingKey)}
                      >
                        {WATER_PRICE_TYPES.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </SelectField>
                    </div>
                    <div className="settings-commercial-new-water-flow">
                      <div className="settings-commercial-current">
                        <span className="settings-commercial-step">Current</span>
                        <strong>New schedule</strong>
                        <small>No current price exists for this product and price type.</small>
                      </div>
                      <div className="settings-commercial-field settings-commercial-field--price">
                        <span className="settings-commercial-step">New</span>
                        <div className="settings-commercial-price-fields">
                          <label>
                            Price
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={newWaterPriceDraft.price}
                              onChange={(event) => setNewWaterPriceDraft((previous) => ({
                                ...previous,
                                price: event.target.value,
                              }))}
                              placeholder="0.00"
                              disabled={Boolean(commercialSavingKey)}
                              required
                            />
                          </label>
                          <label>
                            Currency
                            <input
                              type="text"
                              value={newWaterPriceDraft.currency}
                              maxLength={3}
                              onChange={(event) => setNewWaterPriceDraft((previous) => ({
                                ...previous,
                                currency: event.target.value.toUpperCase(),
                              }))}
                              disabled={Boolean(commercialSavingKey)}
                              required
                            />
                          </label>
                          <label>
                            Minimum quantity
                            <input
                              type="number"
                              min="1"
                              max="100000"
                              step="1"
                              value={newWaterPriceDraft.minimumQuantity}
                              onChange={(event) => setNewWaterPriceDraft((previous) => ({
                                ...previous,
                                minimumQuantity: event.target.value,
                              }))}
                              disabled={Boolean(commercialSavingKey)}
                              required
                            />
                          </label>
                        </div>
                      </div>
                      <label className="settings-commercial-field">
                        <span className="settings-commercial-step">Effective date</span>
                        <span>Starts on</span>
                        <input
                          type="date"
                          min={toDateInputValue()}
                          value={newWaterPriceDraft.effectiveDate}
                          onChange={(event) => setNewWaterPriceDraft((previous) => ({
                            ...previous,
                            effectiveDate: event.target.value,
                          }))}
                          disabled={Boolean(commercialSavingKey)}
                          required
                        />
                      </label>
                      <button
                        type="submit"
                        className="settings-primary settings-commercial-save settings-commercial-save--water"
                        disabled={Boolean(commercialSavingKey)}
                      >
                        {commercialSavingKey === "water:new" ? "Saving..." : "Schedule price"}
                      </button>
                    </div>
                  </form>
                </details>
              )}
            </section>

            <section className="glass-card settings-panel">
              <div className="settings-panel-head settings-panel-head--split">
                <div>
                  <h3>Organization document identity</h3>
                  <p className="settings-muted">
                    Shared business contact details used when preparing REEBS Core documents.
                  </p>
                </div>
                {!canManageDocumentIdentity && (
                  <span className="settings-commercial-access">Read only</span>
                )}
              </div>
              <div className="settings-commercial-retired" role="note">
                Legacy browser-only currency, tax and transport controls remain retired. They are not used as
                shared commercial policy and are not migrated into the schedules above.
              </div>
              {portalSettingsLoading && (
                <p className="settings-muted" role="status">Loading shared document identity…</p>
              )}
              {portalSettingsError && (
                <ERPFormNotice tone="danger" title="Document identity unavailable" onDismiss={() => setPortalSettingsError("")}>
                  {portalSettingsError}
                </ERPFormNotice>
              )}
              <form className="settings-form" onSubmit={saveConfig}>
                <div className="settings-grid">
                  <label>
                    Business name
                    <input
                      type="text"
                      value={configForm.storeName}
                      onChange={(e) => setConfigForm((prev) => ({ ...prev, storeName: e.target.value }))}
                      disabled={!canManageDocumentIdentity || configSaving}
                      required
                    />
                  </label>
                  <label>
                    Business address
                    <input
                      type="text"
                      value={configForm.storeAddress}
                      onChange={(e) => setConfigForm((prev) => ({ ...prev, storeAddress: e.target.value }))}
                      disabled={!canManageDocumentIdentity || configSaving}
                      required
                    />
                  </label>
                  <label>
                    Business email
                    <input
                      type="email"
                      value={configForm.storeEmail}
                      onChange={(e) => setConfigForm((prev) => ({ ...prev, storeEmail: e.target.value }))}
                      disabled={!canManageDocumentIdentity || configSaving}
                      required
                    />
                  </label>
                  <label>
                    Business phone
                    <input
                      type="tel"
                      value={configForm.storePhone}
                      onChange={(e) => setConfigForm((prev) => ({ ...prev, storePhone: e.target.value }))}
                      disabled={!canManageDocumentIdentity || configSaving}
                      required
                    />
                  </label>
                </div>
                {configStatus && (
                  <ERPFormNotice tone="success" title="Document identity saved" onDismiss={() => setConfigStatus("")}>
                    {configStatus}
                  </ERPFormNotice>
                )}
                {configError && (
                  <ERPFormNotice tone="danger" title="Document identity not saved" onDismiss={() => setConfigError("")}>
                    {configError}
                  </ERPFormNotice>
                )}
                <div className="settings-actions">
                  <button
                    type="submit"
                    className="settings-primary"
                    disabled={!canManageDocumentIdentity || configSaving || portalSettingsLoading}
                  >
                    {configSaving ? "Saving…" : canManageDocumentIdentity ? "Save document identity" : "Read only"}
                  </button>
                </div>
              </form>
            </section>
          </>
        )}

        {activeTab === "advanced" && (
          <>
            <section className="glass-card settings-panel">
              <div className="settings-panel-head">
                <div>
                  <h3>Legacy modules</h3>
                  <p className="settings-muted">
                    Quick access to modules that still use the older flow.
                  </p>
                </div>
              </div>
              <div className="settings-advanced-links">
                {legacyModuleLinks.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    className="settings-advanced-link"
                    onClick={() => navigate(item.path)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="glass-card settings-panel">
              <div className="settings-panel-head settings-panel-head--split">
                <div>
                  <h3>System health</h3>
                  <p className="settings-muted">
                    Local queue and saved fallback data on this device.
                  </p>
                </div>
                <button
                  type="button"
                  className="settings-advanced-refresh"
                  onClick={refreshAdvancedHealth}
                >
                  Refresh
                </button>
              </div>
              <div className="settings-advanced-kpis">
                <article className="settings-advanced-kpi">
                  <p>Queue pending</p>
                  <strong>{advancedHealth.queuePending}</strong>
                  <span>Waiting to sync</span>
                </article>
                <article className="settings-advanced-kpi">
                  <p>Queue failed</p>
                  <strong>{advancedHealth.queueFailed}</strong>
                  <span>Need retry</span>
                </article>
                <article className="settings-advanced-kpi">
                  <p>Inventory snapshot</p>
                  <strong>{advancedHealth.inventorySnapshotItems}</strong>
                  <span>Saved stock rows</span>
                </article>
                <article className="settings-advanced-kpi">
                  <p>Customer snapshot</p>
                  <strong>{advancedHealth.customerSnapshotItems}</strong>
                  <span>Saved customer rows</span>
                </article>
                <article className="settings-advanced-kpi">
                  <p>Low stock in snapshot</p>
                  <strong>{advancedHealth.lowStockItems}</strong>
                  <span>{LOW_STOCK_THRESHOLD} units or less</span>
                </article>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default AdminSettings;
