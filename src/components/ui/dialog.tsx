"use client";
import { useI18n } from '@/i18n/react';

import { useEffect, useRef } from "react";
import { Button } from "@heroui/react";
import { X } from "lucide-react";

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const { t } = useI18n();

  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog?.showModal();
    dialog?.querySelector<HTMLInputElement>("input")?.focus();
    return () => { dialog?.close(); if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  return <dialog ref={ref} className="studio-dialog" aria-labelledby="dialog-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="dialog-heading"><h2 id="dialog-title">{t(title)}</h2><Button variant="ghost" isIconOnly aria-label={t("Close dialog")} onPress={onClose}><X size={18} /></Button></div>
    {children}
  </dialog>;
}
