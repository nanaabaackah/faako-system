import { useEffect, useState } from "react";

const GOOGLE_TRANSLATE_SCRIPT_ID = "faako-google-translate-script";
const GOOGLE_TRANSLATE_CONTAINER_ID = "google_translate_element";
const GOOGLE_TRANSLATE_COOKIE = "googtrans";
const LANGUAGE_STORAGE_KEY = "faako-language";

const languageOptions = [
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "ak", label: "Twi (Akan)" },
];

const readCookie = (name) => {
  if (typeof document === "undefined") {
    return "";
  }

  const prefix = `${name}=`;
  const cookies = document.cookie.split(";").map((item) => item.trim());
  const match = cookies.find((item) => item.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : "";
};

const getActiveLanguage = () => {
  const cookieValue = readCookie(GOOGLE_TRANSLATE_COOKIE);
  if (!cookieValue) {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved) {
        return saved;
      }
    }
    return "en";
  }

  const parts = cookieValue.split("/");
  const translatedTo = parts[2];
  return translatedTo || "en";
};

const writeTranslateCookie = (nextLanguage) => {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  const value = `/en/${nextLanguage}`;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${GOOGLE_TRANSLATE_COOKIE}=${value};path=/;max-age=${maxAge}`;

  const hostname = window.location.hostname.replace(/^www\./, "");
  if (hostname && hostname !== "localhost") {
    document.cookie = `${GOOGLE_TRANSLATE_COOKIE}=${value};path=/;domain=.${hostname};max-age=${maxAge}`;
  }
};

const syncGoogleCombo = (nextLanguage) => {
  if (typeof document === "undefined") {
    return false;
  }

  const combo = document.querySelector(".goog-te-combo");
  if (!combo) {
    return false;
  }

  combo.value = nextLanguage;
  combo.dispatchEvent(new Event("change"));
  return true;
};

export default function FooterLanguagePicker() {
  const [activeLanguage, setActiveLanguage] = useState("en");
  const [isWidgetReady, setIsWidgetReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    setActiveLanguage(getActiveLanguage());

    const initializeWidget = () => {
      if (!window.google?.translate?.TranslateElement) {
        return;
      }

      const container = document.getElementById(GOOGLE_TRANSLATE_CONTAINER_ID);
      if (!container) {
        return;
      }

      if (!container.dataset.initialized) {
        // Renders Google Translate's hidden combo that powers our custom selector.
        new window.google.translate.TranslateElement(
          {
            pageLanguage: "en",
            includedLanguages: "en,fr,ak",
            autoDisplay: false,
            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
          },
          GOOGLE_TRANSLATE_CONTAINER_ID
        );
        container.dataset.initialized = "true";
      }

      setIsWidgetReady(true);
      setTimeout(() => {
        const currentLanguage = getActiveLanguage();
        writeTranslateCookie(currentLanguage);
        syncGoogleCombo(currentLanguage);
      }, 250);
    };

    window.googleTranslateElementInit = initializeWidget;

    if (window.google?.translate?.TranslateElement) {
      initializeWidget();
      return;
    }

    let script = document.getElementById(GOOGLE_TRANSLATE_SCRIPT_ID);
    if (!script) {
      script = document.createElement("script");
      script.id = GOOGLE_TRANSLATE_SCRIPT_ID;
      script.src =
        "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const applyLanguage = (nextLanguage) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    }

    writeTranslateCookie(nextLanguage);
    const synced = syncGoogleCombo(nextLanguage);

    // If the widget combo isn't ready yet, reload so Google can apply the cookie.
    if (!synced && typeof window !== "undefined") {
      window.location.reload();
    }
  };

  const handleLanguageChange = (event) => {
    const nextLanguage = event.target.value;
    setActiveLanguage(nextLanguage);
    applyLanguage(nextLanguage);
  };

  return (
    <div className="footer-language-picker">
      <label htmlFor="footer-language-select">Translate site</label>
      <div className="footer-language-control">
        <select
          id="footer-language-select"
          value={activeLanguage}
          onChange={handleLanguageChange}
          aria-label="Translate website language"
        >
          {languageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <p className="footer-language-status">
        {isWidgetReady
          ? "Live translation is active for this page."
          : "Preparing translation..."}
      </p>
      <div id={GOOGLE_TRANSLATE_CONTAINER_ID} className="footer-language-hidden" />
    </div>
  );
}
