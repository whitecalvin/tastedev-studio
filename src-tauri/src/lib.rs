mod debugger;
mod diagnostics;
mod git_collaboration;
mod git_hunks;
mod language;
use diagnostics::runtime_diagnostic;
mod announcements;
mod bootstrap;
mod filesystem;
mod git;
mod job;
mod process;
mod update;

#[tauri::command]
async fn language_start(
    app: tauri::AppHandle,
    request: language::Start,
) -> Result<serde_json::Value> {
    tauri::async_runtime::spawn_blocking(move || {
        use tauri::Emitter;
        let events = app.clone();
        app.state::<language::Languages>().start(
            request,
            &app.state::<Workspaces>(),
            std::sync::Arc::new(move |event| {
                let _ = events.emit("studio-language", event);
            }),
        )
    })
    .await
    .map_err(|_| error("internal"))?
}
#[tauri::command]
async fn language_call(
    app: tauri::AppHandle,
    request: language::Call,
) -> Result<serde_json::Value> {
    tauri::async_runtime::spawn_blocking(move || app.state::<language::Languages>().call(request))
        .await
        .map_err(|_| error("internal"))?
}
#[tauri::command]
async fn language_stop(
    app: tauri::AppHandle,
    session_id: String,
    workspace_id: String,
) -> Result<()> {
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<language::Languages>()
            .stop(&session_id, &workspace_id)
    })
    .await
    .map_err(|_| error("internal"))?
}

#[tauri::command]
async fn debug_start(app: tauri::AppHandle, request: debugger::Start) -> Result<()> {
    tauri::async_runtime::spawn_blocking(move || {
        use tauri::Emitter;
        let events = app.clone();
        app.state::<debugger::Debuggers>().start(
            request,
            &app.state::<Workspaces>(),
            std::sync::Arc::new(move |event| {
                let _ = events.emit("studio-debug", event);
            }),
        )
    })
    .await
    .map_err(|_| error("internal"))?
}
#[tauri::command]
fn debug_action(request: debugger::Action, state: State<debugger::Debuggers>) -> Result<()> {
    state.action(request)
}
#[tauri::command]
async fn debug_stop(app: tauri::AppHandle, session_id: String, workspace_id: String) -> Result<()> {
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<debugger::Debuggers>()
            .stop(&session_id, &workspace_id)
    })
    .await
    .map_err(|_| error("internal"))?
}

#[tauri::command]
async fn project_environment() -> Result<serde_json::Value> {
    tauri::async_runtime::spawn_blocking(bootstrap::environment)
        .await
        .map_err(|_| error("internal"))
}
use filesystem::{error, Connection, Result, Workspaces};
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;
#[tauri::command]
fn project_begin(id: String, state: State<bootstrap::Operations>) -> Result<()> {
    state.begin(&id)
}
#[tauri::command]
fn project_cancel(id: String, state: State<bootstrap::Operations>) -> Result<()> {
    state.cancel(&id)
}
#[tauri::command]
async fn project_prepare(request: bootstrap::Request, app: tauri::AppHandle) -> Result<Connection> {
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<bootstrap::Operations>()
            .execute(request, &app.state::<Workspaces>())
    })
    .await
    .map_err(|_| error("internal"))?
}
fn save_projects(app: &tauri::AppHandle, state: &Workspaces) -> Result<()> {
    let path = app.path().app_data_dir().map_err(|_| error("storage"))?;
    std::fs::create_dir_all(&path)?;
    let data = serde_json::to_vec(&*state.projects.lock().map_err(|_| error("internal"))?)
        .map_err(|_| error("storage"))?;
    std::fs::write(path.join("workspaces.json"), data)?;
    Ok(())
}
#[tauri::command]
async fn workspace_select(
    app: tauri::AppHandle,
    state: State<'_, Workspaces>,
) -> Result<Connection> {
    let handle = app.clone();
    let path = tauri::async_runtime::spawn_blocking(move || {
        handle
            .dialog()
            .file()
            .set_title("Open TASTESTUDIO workspace")
            .blocking_pick_folder()
    })
    .await
    .map_err(|_| error("dialog"))?
    .ok_or_else(|| error("cancelled"))?
    .into_path()
    .map_err(|_| error("path"))?;
    state.register(path)
}
#[tauri::command]
fn workspace_restore(project_id: String, state: State<Workspaces>) -> Result<Option<Connection>> {
    let path = state
        .projects
        .lock()
        .map_err(|_| error("internal"))?
        .get(&project_id)
        .cloned();
    path.map(|path| state.register(path)).transpose()
}
#[tauri::command]
fn workspace_bind(
    app: tauri::AppHandle,
    project_id: String,
    connection_id: String,
    state: State<Workspaces>,
) -> Result<Connection> {
    let root = state.root(&connection_id)?;
    state
        .projects
        .lock()
        .map_err(|_| error("internal"))?
        .insert(project_id, root.clone());
    save_projects(&app, &state)?;
    state.register(root)
}
#[tauri::command]
fn workspace_same(
    connection_id: String,
    project_id: String,
    state: State<Workspaces>,
) -> Result<bool> {
    let root = state.root(&connection_id)?;
    Ok(state
        .projects
        .lock()
        .map_err(|_| error("internal"))?
        .get(&project_id)
        == Some(&root))
}
#[tauri::command]
fn workspace_permission(connection_id: String, state: State<Workspaces>) -> Result<String> {
    let root = state.root(&connection_id)?;
    if !root.is_dir() {
        return Err(error("not-found"));
    }
    Ok("granted".into())
}
#[tauri::command]
fn workspace_disconnect(
    app: tauri::AppHandle,
    project_id: String,
    connection_id: String,
    state: State<Workspaces>,
    processes: State<process::Processes>,
) -> Result<()> {
    app.state::<language::Languages>().stop_all();
    app.state::<debugger::Debuggers>().stop_all();
    processes.stop_all();
    state
        .projects
        .lock()
        .map_err(|_| error("internal"))?
        .remove(&project_id);
    state
        .roots
        .lock()
        .map_err(|_| error("internal"))?
        .remove(&connection_id);
    save_projects(&app, &state)
}
#[tauri::command]
async fn workspace_file(
    request: filesystem::FileRequest,
    app: tauri::AppHandle,
) -> Result<serde_json::Value> {
    tauri::async_runtime::spawn_blocking(move || {
        filesystem::execute(&app.state::<Workspaces>(), request)
    })
    .await
    .map_err(|_| error("internal"))?
}
#[tauri::command]
async fn git_collaboration(
    app: tauri::AppHandle,
    request: git_collaboration::Request,
) -> Result<serde_json::Value> {
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<git_collaboration::Collaboration>()
            .execute(&app.state::<Workspaces>(), request)
    })
    .await
    .map_err(|_| error("internal"))?
}
#[tauri::command]
async fn git_operation(request: git::Request, app: tauri::AppHandle) -> Result<serde_json::Value> {
    tauri::async_runtime::spawn_blocking(move || git::execute(&app.state::<Workspaces>(), request))
        .await
        .map_err(|_| error("internal"))?
}
#[tauri::command]
async fn process_start(
    session_id: String,
    request: process::Request,
    app: tauri::AppHandle,
) -> Result<()> {
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<process::Processes>().start(
            app.clone(),
            &app.state::<Workspaces>(),
            session_id,
            request,
        )
    })
    .await
    .map_err(|_| error("internal"))?
}
#[tauri::command]
async fn process_stop(session_id: String, app: tauri::AppHandle) -> Result<()> {
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<process::Processes>().stop(&session_id)
    })
    .await
    .map_err(|_| error("internal"))?
}
#[tauri::command]
fn process_write(session_id: String, data: String, state: State<process::Processes>) -> Result<()> {
    state.write(&session_id, &data)
}
#[tauri::command]
fn process_resize(
    session_id: String,
    columns: u16,
    rows: u16,
    state: State<process::Processes>,
) -> Result<()> {
    state.resize(&session_id, columns, rows)
}
#[tauri::command]
fn update_action(
    app: tauri::AppHandle,
    action: String,
    enabled: Option<bool>,
    protected: Option<bool>,
) -> std::result::Result<update::Status, String> {
    let processes = app.state::<process::Processes>();
    if action == "install" {
        if protected.unwrap_or(true) {
            return Err("workspace-busy".into());
        }
        app.state::<language::Languages>().begin_update();
        let debuggers = app.state::<debugger::Debuggers>();
        if debuggers.prepare_update().is_err() {
            app.state::<language::Languages>().end_update();
            return Err("workspace-busy".into());
        }
        if processes.prepare_update().is_err() {
            debuggers.cancel_update();
            return Err("workspace-busy".into());
        }
    }
    match app
        .state::<update::Updates>()
        .action(&action, enabled, protected.unwrap_or(true))
    {
        Ok((status, quit)) => {
            if quit {
                app.exit(0);
            }
            Ok(status)
        }
        Err(error) => {
            if action == "install" {
                app.state::<debugger::Debuggers>().cancel_update();
                processes.cancel_update();
                app.state::<language::Languages>().end_update();
            }
            Err(error)
        }
    }
}
#[tauri::command]
async fn announcements_get(locale: String) -> std::result::Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || announcements::fetch(&locale))
        .await
        .map_err(|_| "network".to_string())?
}
#[tauri::command]
fn announcements_open(url: String) -> std::result::Result<(), String> {
    announcements::open(&url)
}
pub fn run() {
    let context = tauri::generate_context!();
    // Capture initialization failures as well as errors after setup. No user data
    // or exception text is written to this diagnostic log.
    if let Some(directory) = std::env::var_os("APPDATA") {
        let _ = diagnostics::initialize(
            &std::path::PathBuf::from(directory).join(&context.config().identifier),
        );
    }
    diagnostics::record("native", "building-webview");
    let app = tauri::Builder::default()
        .plugin(
            tauri::plugin::Builder::<tauri::Wry>::new("runtime-diagnostics")
                .js_init_script(include_str!("diagnostics-init.js"))
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .manage(Workspaces::default())
        .manage(bootstrap::Operations::default())
        .manage(process::Processes::default())
        .manage(debugger::Debuggers::default())
        .manage(language::Languages::default())
        .manage(git_collaboration::Collaboration::default())
        .setup(|app| {
            diagnostics::initialize(&app.path().app_data_dir()?)?;
            app.manage(update::Updates::new(
                &app.path().app_data_dir()?,
                &app.path().app_cache_dir()?,
            ));
            let path = app.path().app_data_dir()?.join("workspaces.json");
            if path.exists() {
                let data = std::fs::read(path)?;
                let projects = serde_json::from_slice(&data)?;
                *app.state::<Workspaces>()
                    .projects
                    .lock()
                    .map_err(|_| "workspace lock")? = projects;
            }
            eprintln!("Studio native runtime started");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            project_begin,
            project_prepare,
            project_cancel,
            project_environment,
            workspace_select,
            workspace_restore,
            workspace_bind,
            workspace_same,
            workspace_permission,
            workspace_disconnect,
            workspace_file,
            git_operation,
            git_collaboration,
            language_start,
            language_call,
            language_stop,
            debug_start,
            debug_action,
            debug_stop,
            process_start,
            process_stop,
            process_write,
            process_resize,
            runtime_diagnostic,
            update_action,
            announcements_get,
            announcements_open
        ])
        .build(context)
        .expect("Studio runtime initialization failed");
    app.run(|app, event| {
        if matches!(event, tauri::RunEvent::Ready) {
            // Tauri creates configured windows when the event loop starts, after
            // Builder::build. WebView2's shared browser must not inherit our job.
            // Later command processes retain the app/session cleanup boundaries.
            diagnostics::record("native", "attaching-command-job");
            let app_job = job::ProcessJob::attach_app(unsafe {
                windows_sys::Win32::System::Threading::GetCurrentProcess()
            })
            .expect("Process cleanup boundary could not initialize");
            std::mem::forget(app_job);
            diagnostics::record("native", "runtime-ready");
        }
        if matches!(
            event,
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
        ) {
            app.state::<debugger::Debuggers>().stop_all();
            app.state::<process::Processes>().stop_all();
            diagnostics::record("native", "stopped");
        }
    });
}
