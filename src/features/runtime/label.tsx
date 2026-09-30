'use client';
import { useI18n } from '@/i18n/react';
import { useSyncExternalStore } from 'react';
import { detectRuntime } from './hosts';
const subscribe = () => () => {};
export function useRuntime() { return useSyncExternalStore(subscribe, detectRuntime, () => 'web' as const); }
export function RuntimeLabel() {
  const { t } = useI18n();
 const runtime = useRuntime(); return <>{runtime === 'desktop' ? t("Desktop runtime") : t("Web runtime")}</>; }
export function RuntimeNote() {
  const { t } = useI18n();
 const runtime = useRuntime(); return <div className="runtime-note"><h3>{runtime === 'desktop' ? t("Working on your computer") : t("Working in your browser")}</h3><p>{runtime === 'desktop' ? t("Connect a local folder to edit files, use the terminal and manage Git changes. Projects stay on this computer. Git cloning is not connected.") : t("Chrome and Edge can connect a local folder with your permission. Metadata and folder handles stay in this browser. Git cloning is not connected.")}</p></div>; }
export function StorageNote() {
  const { t } = useI18n();
 const runtime = useRuntime(); return <span>{runtime === 'desktop' ? t("Project metadata stays on this computer") : t("Project metadata stays in this browser")}</span>; }
