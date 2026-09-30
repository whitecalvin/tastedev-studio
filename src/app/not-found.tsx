"use client";
import { useI18n } from '@/i18n/react';
import { AppShell } from "@/components/ui/app-shell";
import Link from "next/link";
export default function NotFound() {
  const { t } = useI18n();
 return <AppShell><section className="overview-empty"><h1>{t("Page not found")}</h1><p>{t("This page does not exist.")}</p><Link className="text-link" href="/">{t("Return to Project Manager")}</Link></section></AppShell>; }

