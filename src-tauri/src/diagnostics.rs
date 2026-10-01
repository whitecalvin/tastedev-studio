use std::{
    fs::{File, OpenOptions},
    io::Write,
    path::Path,
    sync::{Mutex, OnceLock},
    time::{SystemTime, UNIX_EPOCH},
};
static LOG: OnceLock<Mutex<File>> = OnceLock::new();
struct ErrorLogger;
impl log::Log for ErrorLogger {
    fn enabled(&self, metadata: &log::Metadata) -> bool {
        metadata.level() <= log::Level::Warn
    }
    fn log(&self, message: &log::Record) {
        if self.enabled(message.metadata()) {
            record(
                "rust-log",
                if message.level() == log::Level::Error {
                    "error"
                } else {
                    "warn"
                },
            );
        }
    }
    fn flush(&self) {}
}
static ERROR_LOGGER: ErrorLogger = ErrorLogger;
pub fn initialize(directory: &Path) -> std::io::Result<()> {
    if LOG.get().is_some() {
        return Ok(());
    }
    std::fs::create_dir_all(directory)?;
    let path = directory.join("native-runtime.log");
    if path
        .metadata()
        .map(|m| m.len() > 1024 * 1024)
        .unwrap_or(false)
    {
        std::fs::copy(&path, directory.join("native-runtime.previous.log"))?;
        File::create(&path)?;
    }
    let file = OpenOptions::new().create(true).append(true).open(path)?;
    let _ = LOG.set(Mutex::new(file));
    log::set_logger(&ERROR_LOGGER)
        .map_err(|_| std::io::Error::other("Diagnostic logger already installed"))?;
    log::set_max_level(log::LevelFilter::Warn);
    let prior = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        record("rust", "panic");
        prior(info);
    }));
    record("native", "started");
    Ok(())
}
// Only internal codes are accepted. No paths, arguments, environment or file data.
pub fn record(source: &str, code: &str) {
    static COUNT: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
    let count = COUNT.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    if count > 10000 {
        return;
    }
    let (source, code) = if count == 10000 {
        ("audit", "truncated")
    } else {
        (source, code)
    };
    if let Some(log) = LOG.get() {
        if let Ok(mut file) = log.lock() {
            let stamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis();
            let _ = writeln!(file, "{stamp} {source} {code}");
        }
    }
}
#[derive(serde::Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum FrontendEvent {
    Ready,
    Error,
    UnhandledRejection,
    ConsoleError,
    ConsoleWarn,
    CommandFailure,
    EventError,
    ResizeObserverError,
}
#[tauri::command]
pub fn runtime_diagnostic(event: FrontendEvent) {
    record(
        "frontend",
        match event {
            FrontendEvent::Ready => "ready",
            FrontendEvent::Error => "error",
            FrontendEvent::UnhandledRejection => "unhandled-rejection",
            FrontendEvent::ConsoleError => "console-error",
            FrontendEvent::ConsoleWarn => "console-warn",
            FrontendEvent::CommandFailure => "command-failure",
            FrontendEvent::EventError => "event-error",
            FrontendEvent::ResizeObserverError => "resize-observer-error",
        },
    );
}

#[cfg(test)]
mod tests {
    #[test]
    fn records_native_errors_logs_and_panics_without_payloads() {
        let directory = tempfile::tempdir().unwrap();
        super::initialize(directory.path()).unwrap();
        super::initialize(directory.path()).unwrap();
        super::runtime_diagnostic(super::FrontendEvent::ConsoleWarn);
        crate::filesystem::error("not-found");
        log::error!("private diagnostic payload");
        let _ = std::panic::catch_unwind(|| {
            panic!("expected diagnostic self-test");
        });
        let output = std::fs::read_to_string(directory.path().join("native-runtime.log")).unwrap();
        for expected in [
            "frontend console-warn",
            "native-error not-found",
            "rust-log error",
            "rust panic",
        ] {
            assert!(output.contains(expected));
        }
        assert!(!output.contains("private diagnostic payload"));
        assert!(!output.contains("expected diagnostic self-test"));
    }
}
