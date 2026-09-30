"use client";
import { useI18n } from '@/i18n/react';

import { useState } from "react";
import { Button } from "@heroui/react";
import { Dialog } from "@/components/ui/dialog";
import { gitClone, projectService } from "../services/browser-services";
import { validateClone } from "../utils/validation";

export function ProjectForm({ mode, onClose, onCreated }: { mode: "new" | "clone"; onClose: () => void; onCreated: (name: string) => Promise<void> }) {
  const { t } = useI18n();

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return <Dialog title={mode === "new" ? t("New Project") : t("Clone Repository")} onClose={() => { if (!busy) onClose(); }}>
    <p className="dialog-description">{mode === "new" ? t("Register a project in this browser. This saves metadata; it does not create folders or source files.") : t("Enter a repository and destination. Cloning requires native Git in the future desktop runtime.")}</p>
    <form onSubmit={async (event) => {
      event.preventDefault();
      if (busy) return;
      const data = new FormData(event.currentTarget);
      const value = (key: string) => String(data.get(key) ?? "");
      setError(null); setNotice(null); setBusy(true);
      try {
        if (mode === "new") {
          const project = await projectService.create({ name: value("name"), workspacePath: value("workspacePath"), description: value("description") });
          await onCreated(project.name);
          onClose();
        } else {
          const result = await gitClone.clone(validateClone({ repositoryUrl: value("repositoryUrl"), workspacePath: value("workspacePath"), branch: value("branch") }));
          if (result.status === "unsupported") setNotice(result.message);
        }
      } catch (error) { setError(error instanceof Error ? error.message : "The project could not be saved. Please retry."); }
      finally { setBusy(false); }
    }}>
      <div className="form-fields">
        {mode === "new" ? <label>{t("Project name")} <span className="required-note">{t("Required")}</span><input name="name" required maxLength={120} autoComplete="off" placeholder={t("My project")} /></label> : <label>{t("Repository URL")} <span className="required-note">{t("Required")}</span><input name="repositoryUrl" required autoComplete="off" placeholder="https://github.com/owner/repository.git" /></label>}
        <label>{mode === "new" ? t("Workspace path") : t("Target workspace")} <span className="required-note">{t("Required")}</span><input name="workspacePath" required maxLength={4096} autoComplete="off" spellCheck={false} placeholder="C:\Projects\my-project" aria-describedby="path-help" /><small id="path-help">{t("Use an absolute Windows, macOS, or Linux path. Folder existence is not checked in the browser.")}</small></label>
        {mode === "new" ? <label>{t("Description")} <span className="optional-note">{t("Optional")}</span><textarea name="description" rows={3} maxLength={2000} placeholder={t("What are you working on?")} /></label> : <label>{t("Branch")} <span className="optional-note">{t("Optional")}</span><input name="branch" autoComplete="off" placeholder={t("Use repository default")} /></label>}
      </div>
      {error && <p className="message error" role="alert">{t(error || "")}</p>}
      {notice && <p className="message" role="status">{t(notice || "")}</p>}
      <div className="dialog-actions"><Button type="button" variant="ghost" isDisabled={busy} onPress={onClose}>{t("Cancel")}</Button><Button type="submit" isPending={busy}>{mode === "new" ? t("Create Project") : t("Check clone availability")}</Button></div>
    </form>
  </Dialog>;
}
