import { useState } from "react";
import { getEffectiveTheme, setTheme } from "../theme";

export default function ThemeToggle() {
  const [theme, setThemeState] = useState(getEffectiveTheme());

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  }

  return (
    <button className="theme-toggle" onClick={toggle} aria-label="Toggle dark mode">
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}
