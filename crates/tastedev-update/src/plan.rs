//! OS 별 설치 명령 만들기(실행은 하지 않는다 — [`crate::Runner`] 가 한다).
//!
//! "지금 설치" — 설치하고 새 앱을 다시 켠다.
//!
//! | 설치 방식 | 명령 |
//! |---|---|
//! | Windows NSIS | 앱이 끝나면 PowerShell 이 `setup.exe /S /NS /D=<설치 폴더>` 를 관리자 권한(UAC 한 번)으로 돌리고 새 앱을 켠다 |
//! | Windows MSI | 앱이 끝나면 `msiexec /i "<msi>" /qb! /norestart`(UAC 한 번, 0 · 3010 = 성공) → 새 앱 |
//! | Windows zip | 앱이 끝나면 작업 폴더에 풀고, 파일마다 옛 파일을 따로 둔 뒤 바꾼다(하나라도 실패하면 모두 되돌림) → 새 앱 |
//! | Linux deb | 앱 안에서 `pkexec apt-get install -y <deb>`(apt-get 이 없으면 `pkexec dpkg -i`) → 끝나면 새 앱 |
//! | Linux rpm | `pkexec dnf install -y <rpm>`(dnf 가 없으면 `pkexec rpm -U`) → 새 앱 |
//! | Linux AppImage | 파일 바꿔치기(`<파일>.new` → 실행 권한 → 이름 바꾸기) → 새 앱 |
//!
//! Windows 는 실행 중인 exe 를 바꿀 수 없어 앱이 끝난 뒤 도는 스크립트가 설치한다. 스크립트는 결과를 작업 폴더의
//! [`crate::RESULT_FILE`] 에 `ok <판>` · `fail <판> <까닭>` 으로 남긴다(다음 실행이 읽는다). 실패하면 옛 판은
//! 그대로다(NSIS · MSI 는 설치 프로그램이 되돌리고, zip 은 스크립트가 되돌린다).

use std::path::{Path, PathBuf};

use crate::{InstallKind, Product, RESULT_FILE, UpdateError, Version};

/// 설치 명령 한 벌.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Step {
    /// 앱이 끝난 뒤 따로 도는 스크립트(Windows PowerShell). 제품은 이것을 띄우고 앱을 닫는다.
    AfterExit {
        /// 쓸 스크립트 파일(작업 폴더 안).
        script: PathBuf,
        /// 스크립트 내용.
        body: String,
        program: String,
        args: Vec<String>,
    },
    /// 앱 안에서 곧바로 권한을 얻어 설치(Linux deb · rpm — `pkexec`). 끝을 기다린다.
    Elevated { program: String, args: Vec<String> },
    /// 파일 바꿔치기(Linux AppImage).
    Replace { from: PathBuf, to: PathBuf },
}

/// 명령을 만들 때 쓰는 것.
pub struct Ctx<'a> {
    pub product: &'a Product,
    /// 지금 실행 파일(다시 켤 때 쓴다).
    pub exe: &'a Path,
    /// 지금 프로세스 번호(스크립트가 끝나기를 기다린다).
    pub pid: u32,
    /// 작업 폴더(스크립트 · 결과 파일).
    pub work_dir: &'a Path,
    /// 설치할 판.
    pub version: Version,
    /// 파일이 있는지(`/usr/bin/pkexec` · `apt-get` · `dnf`). 시험은 가짜를 준다.
    pub exists: &'a dyn Fn(&Path) -> bool,
}

/// PowerShell 작은따옴표 글(`'` → `''`).
pub fn powershell_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "''"))
}

fn path_str(p: &Path) -> String {
    p.to_string_lossy().into_owned()
}

/// "지금 설치" 명령을 만든다(설치 뒤 새 앱을 다시 켠다). 이 설치 방식에서 할 수 없으면 오류.
pub fn plan(kind: &InstallKind, file: &Path, ctx: &Ctx<'_>) -> Result<Step, UpdateError> {
    match kind {
        InstallKind::Nsis { .. } | InstallKind::Msi | InstallKind::Portable { .. } => {
            Ok(windows(kind, file, ctx))
        }
        InstallKind::Deb | InstallKind::Rpm => {
            let (program, args) = linux_elevated(kind, file, ctx)?;
            Ok(Step::Elevated { program, args })
        }
        InstallKind::AppImage { path } => Ok(Step::Replace {
            from: file.to_path_buf(),
            to: path.clone(),
        }),
        InstallKind::Unsupported(_) => Err(UpdateError::Unsupported),
    }
}

/// Linux deb · rpm 권한 설치 명령(pkexec 뒤 인자).
fn linux_elevated(
    kind: &InstallKind,
    file: &Path,
    ctx: &Ctx<'_>,
) -> Result<(String, Vec<String>), UpdateError> {
    let has = |p: &str| (ctx.exists)(Path::new(p));
    if !has("/usr/bin/pkexec") && !has("/bin/pkexec") {
        return Err(UpdateError::Denied("pkexec not found".into()));
    }
    let file = path_str(file);
    let args: Vec<String> = match kind {
        InstallKind::Deb if has("/usr/bin/apt-get") => {
            vec!["apt-get".into(), "install".into(), "-y".into(), file]
        }
        InstallKind::Deb => vec!["dpkg".into(), "-i".into(), file],
        InstallKind::Rpm if has("/usr/bin/dnf") => {
            vec!["dnf".into(), "install".into(), "-y".into(), file]
        }
        _ => vec!["rpm".into(), "-U".into(), file],
    };
    Ok(("pkexec".into(), args))
}

fn windows(kind: &InstallKind, file: &Path, ctx: &Ctx<'_>) -> Step {
    let q = powershell_quote;
    let file_s = path_str(file);
    let ver = ctx.version.to_string();
    let install = match kind {
        InstallKind::Nsis { dir } => format!(
            "    $p = Start-Process -FilePath {file} -ArgumentList {args} -Verb RunAs -Wait -PassThru\n\
             \x20   if ($p.ExitCode -ne 0) {{ throw ('installer exit code ' + $p.ExitCode) }}\n",
            file = q(&file_s),
            // /D= 는 따옴표 없이 마지막에 둔다(NSIS 규칙). /NS: 지운 바로 가기를 다시 만들지 않는다.
            args = q(&format!("/S /NS /D={}", path_str(dir))),
        ),
        InstallKind::Msi => format!(
            "    $p = Start-Process -FilePath 'msiexec.exe' -ArgumentList {args} -Verb RunAs -Wait -PassThru\n\
             \x20   if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) {{ throw ('msiexec exit code ' + $p.ExitCode) }}\n",
            args = q(&format!("/i \"{file_s}\" /qb! /norestart")),
        ),
        InstallKind::Portable { dir } => {
            let work = ctx.work_dir;
            format!(
                "    $stage = {stage}\n\
                 \x20   $backup = {backup}\n\
                 \x20   $dest = {dest}\n\
                 \x20   foreach ($d in @($stage, $backup)) {{ if (Test-Path -LiteralPath $d) {{ Remove-Item -LiteralPath $d -Recurse -Force }} }}\n\
                 \x20   Expand-Archive -LiteralPath {zip} -DestinationPath $stage -Force\n\
                 \x20   $src = $stage\n\
                 \x20   $top = @(Get-ChildItem -LiteralPath $stage)\n\
                 \x20   if ($top.Count -eq 1 -and $top[0].PSIsContainer) {{ $src = $top[0].FullName }}\n\
                 \x20   New-Item -ItemType Directory -Path $backup -Force | Out-Null\n\
                 \x20   $done = New-Object System.Collections.Generic.List[string]\n\
                 \x20   try {{\n\
                 \x20       foreach ($f in @(Get-ChildItem -LiteralPath $src -Recurse -File)) {{\n\
                 \x20           $rel = $f.FullName.Substring($src.Length).TrimStart('\\')\n\
                 \x20           $target = Join-Path $dest $rel\n\
                 \x20           if (Test-Path -LiteralPath $target) {{\n\
                 \x20               $b = Join-Path $backup $rel\n\
                 \x20               New-Item -ItemType Directory -Path (Split-Path -Parent $b) -Force | Out-Null\n\
                 \x20               Copy-Item -LiteralPath $target -Destination $b -Force\n\
                 \x20           }}\n\
                 \x20           $done.Add($rel)\n\
                 \x20           New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null\n\
                 \x20           Copy-Item -LiteralPath $f.FullName -Destination $target -Force\n\
                 \x20       }}\n\
                 \x20   }} catch {{\n\
                 \x20       foreach ($rel in $done) {{\n\
                 \x20           $b = Join-Path $backup $rel\n\
                 \x20           $t = Join-Path $dest $rel\n\
                 \x20           if (Test-Path -LiteralPath $b) {{ Copy-Item -LiteralPath $b -Destination $t -Force }} else {{ Remove-Item -LiteralPath $t -Force -ErrorAction SilentlyContinue }}\n\
                 \x20       }}\n\
                 \x20       throw\n\
                 \x20   }}\n\
                 \x20   Remove-Item -LiteralPath $stage, $backup -Recurse -Force -ErrorAction SilentlyContinue\n",
                stage = q(&path_str(&work.join(format!("stage-{ver}")))),
                backup = q(&path_str(&work.join(format!("backup-{ver}")))),
                dest = q(&path_str(dir)),
                zip = q(&file_s),
            )
        }
        _ => String::new(),
    };
    let relaunch = format!("    Start-Process -FilePath {}\n", q(&path_str(ctx.exe)));
    let script = ctx.work_dir.join(format!("install-{ver}.ps1"));
    let body = format!(
        "# {name} {ver} update - written by the app, runs after the app exits.\n\
         $ErrorActionPreference = 'Stop'\n\
         $result = {result}\n\
         try {{\n\
         \x20   Wait-Process -Id {pid} -Timeout 600 -ErrorAction SilentlyContinue\n\
         \x20   if (Get-Process -Id {pid} -ErrorAction SilentlyContinue) {{ throw 'the app is still running' }}\n\
         {install}\
         \x20   Set-Content -LiteralPath $result -Value {ok} -Encoding UTF8\n\
         {relaunch}\
         }} catch {{\n\
         \x20   Set-Content -LiteralPath $result -Value ({fail} + $_.Exception.Message) -Encoding UTF8\n\
         }}\n",
        name = ctx.product.name,
        result = q(&path_str(&ctx.work_dir.join(RESULT_FILE))),
        pid = ctx.pid,
        ok = q(&format!("ok {ver}")),
        fail = q(&format!("fail {ver} ")),
    );
    Step::AfterExit {
        program: "powershell.exe".into(),
        args: [
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-WindowStyle",
            "Hidden",
            "-File",
        ]
        .iter()
        .map(|s| (*s).to_owned())
        .chain([path_str(&script)])
        .collect(),
        script,
        body,
    }
}
