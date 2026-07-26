import React, { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { getTheme, applyTheme, type Theme } from "../lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getTheme());
  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  };
  return (
    <button className="iconbtn" onClick={toggle} title="Тема" aria-label="Переключить тему">
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
