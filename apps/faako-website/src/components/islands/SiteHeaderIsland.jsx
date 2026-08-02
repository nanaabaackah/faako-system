import { useEffect, useState } from "react";
import { MemoryRouter } from "react-router-dom";
import Header from "../Header.jsx";

const THEME_STORAGE_KEY = "faako-theme";

export default function SiteHeaderIsland({ path = "/" }) {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const nextTheme =
      savedTheme === "dark" || savedTheme === "light" ? savedTheme : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  const handleThemeToggle = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  return (
    <MemoryRouter initialEntries={[path]}>
      <Header
        headerLogo={
          theme === "dark"
            ? "/assets/logos/logo-white.png"
            : "/assets/logos/logo-colour.png"
        }
        currentTheme={theme}
        nextThemeLabel={theme === "dark" ? "Light mode" : "Dark mode"}
        onToggleTheme={handleThemeToggle}
      />
    </MemoryRouter>
  );
}
