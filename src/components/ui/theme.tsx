"use client";
import { useI18n } from '@/i18n/react';
import { useEffect, useSyncExternalStore } from "react";
import { Monitor } from "lucide-react";
type Theme = "system" | "light" | "dark";
const themeKey = "tastedev.studio.theme";
function readTheme(): Theme {
  try { const value = localStorage.getItem(themeKey); return value === "dark" || value === "light" ? value : "system"; }
  catch { return "system"; }
}
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("studio-theme", listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener("studio-theme", listener); };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { document.documentElement.dataset.theme = theme === "system" ? (media.matches ? "dark" : "light") : theme; };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
return children;
}
export function ThemeControl() {
  const { t } = useI18n();

const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);
return (      <label className="theme-control"><Monitor size={16} aria-hidden="true" /><span className="sr-only">{t("Color theme")}</span>
        <select value={theme} onChange={(event) => {
          const value = event.target.value as Theme;
          document.documentElement.dataset.theme = value === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : value;
          try { localStorage.setItem(themeKey, value); window.dispatchEvent(new Event("studio-theme")); } catch { /* Theme still applies for the current page when storage is blocked. */ }
        }}><option value="system">{t("System theme")}</option><option value="light">{t("Light theme")}</option><option value="dark">{t("Dark theme")}</option></select>
      </label>);
}
