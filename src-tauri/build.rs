fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "workspace_select",
            "workspace_restore",
            "workspace_bind",
            "workspace_same",
            "workspace_permission",
            "workspace_disconnect",
            "workspace_file",
            "git_operation",
            "task_worktree_action",
            "task_worktree_open",
            "process_start",
            "process_stop",
            "process_write",
            "process_resize",
            "runtime_diagnostic",
            "update_action",
            "announcements_get",
            "announcements_open",
        ]),
    ))
    .expect("Tauri build configuration failed");
}
