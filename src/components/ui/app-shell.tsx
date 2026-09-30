"use client";
import { useI18n, LanguageControl } from '@/i18n/react';
import { RuntimeLabel, StorageNote } from '@/features/runtime/label';

import Link from "next/link";
import { ThemeControl } from "./theme";
import { Boxes, FolderKanban } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">{t("Skip to content")}</a>
    <header className="app-header">
      <Link href="/" className="brand"><Boxes size={22} aria-hidden="true" /><span>TASTE<strong>STUDIO</strong></span></Link>
      <nav aria-label={t("Main navigation")}><Link href="/" className="nav-link"><FolderKanban size={16} aria-hidden="true" />{t("Projects")}</Link></nav>
      <LanguageControl /><ThemeControl />
    </header>
    <main id="main-content" className="main-content">{children}</main>
    <footer className="app-footer"><span><span className="status-dot" /><RuntimeLabel /></span><StorageNote /></footer>
  </div>;
}



