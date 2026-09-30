"use client";
import { useI18n } from '@/i18n/react';
import { AppShell } from "@/components/ui/app-shell";
import { Button } from "@heroui/react";
import { useEffect } from 'react';
import { reportFrontendError } from '@/features/runtime/frontend-diagnostics';
export default function ErrorPage({ error, reset }: { error: unknown; reset: () => void }) {
  const { t } = useI18n();

  useEffect(() => { reportFrontendError('react.boundary', error); }, [error]);
  return <AppShell><section className="overview-empty"><h1>{t("Something went wrong")}</h1><p role="alert">{t("The page could not be displayed. Retry to load your projects again.")}</p><Button onPress={reset}>{t("Retry")}</Button></section></AppShell>;
}

