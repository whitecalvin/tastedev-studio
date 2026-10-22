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
//! [`crate::RESULT_FILE`] 에 `ok <판>` · `fail <판> <까닭>` 으로 남긴다(다음 실행이 읽는다). 앱은 스크립트를 띄우기 전에
//! `pending <판>` 을, 스크립트는 시작하자마자 `started <판> <때>` 를 써 두어 "돌지 못함" · "도중에 멈춤" 도 알 수 있다.
//! 단계마다 [`crate::LOG_FILE`] 에 한 줄씩 남긴다. 설치 프로그램이 0 으로 끝나도 실행 파일이 바뀌지 않았으면 실패로 본다. 실패하면 옛 판은
//! 그대로다(NSIS · MSI 는 설치 프로그램이 되돌리고, zip 은 스크립트가 되돌린다).
//!
//! Windows 스크립트는 무엇이든 실행 · 교체하기 **전에** Authenticode 서명을 본다([`crate::WINDOWS_SIGNER`]).
//! NSIS · MSI 는 설치 파일 자체를, zip 은 풀어 놓은 모든 `.exe` 를. 서명이 없거나 · 깨졌거나 · 타임스탬프가
//! 없거나 · 다른 서명자면 `fail` 로 남기고 아무것도 바꾸지 않는다.

use std::path::{Path, PathBuf};

use crate::{
    APP_STILL_RUNNING, InstallKind, LOG_FILE, Product, RESULT_FILE, UpdateError, Version,
    WINDOWS_SIGNER,
};

/// NSIS 조용한 설치가 "같은 이름의 앱이 아직 떠 있음"으로 멈출 때의 종료 코드(출시 도구 1.0.148 템플릿).
pub const NSIS_APP_RUNNING_EXIT: i32 = 10;

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

/// 서명 확인 함수(스크립트 머리에 둔다). 출시 도구의 `Test-WindowsSignedBinaries` 와 같은 조건.
/// 스크립트는 Windows PowerShell 5.1(.NET Framework)에서 돈다 — 거기엔 `String.Contains(값, 비교)` 가 없어
/// `IndexOf` 로 본다(출시 도구는 PowerShell 7 이라 Contains 를 쓴다).
pub(crate) fn signature_check() -> String {
    format!(
        "function Assert-Signed([string]$path) {{\n\
         \x20   Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1') -ErrorAction Stop\n\
         \x20   $s = Get-AuthenticodeSignature -LiteralPath $path\n\
         \x20   if ($s.Status -ne 'Valid' -or $null -eq $s.TimeStamperCertificate -or $null -eq $s.SignerCertificate -or\n\
         \x20       $s.SignerCertificate.Subject.IndexOf({signer}, [StringComparison]::OrdinalIgnoreCase) -lt 0) {{\n\
         \x20       throw ('signature not trusted: ' + (Split-Path -Leaf $path) + ' (' + $s.Status + ')')\n\
         \x20   }}\n\
         }}\n",
        signer = powershell_quote(WINDOWS_SIGNER),
    )
}

fn windows(kind: &InstallKind, file: &Path, ctx: &Ctx<'_>) -> Step {
    let q = powershell_quote;
    let file_s = path_str(file);
    let ver = ctx.version.to_string();
    let install = match kind {
        InstallKind::Nsis { dir } => format!(
            "    Assert-Signed {file}\n\
             \x20   $before = Get-AppHash\n\
             \x20   Write-Log 'running the installer'\n\
             \x20   $p = Start-Process -FilePath {file} -ArgumentList {args} -Verb RunAs -Wait -PassThru\n\
             \x20   Write-Log ('installer exit code ' + $p.ExitCode)\n\
             \x20   if ($p.ExitCode -eq {busy}) {{ throw {still} }}\n\
             \x20   if ($p.ExitCode -ne 0) {{ throw ('installer exit code ' + $p.ExitCode) }}\n\
             \x20   Assert-Replaced $before\n",
            file = q(&file_s),
            // /D= 는 따옴표 없이 마지막에 둔다(NSIS 규칙). /NS: 지운 바로 가기를 다시 만들지 않는다.
            args = q(&format!("/S /NS /D={}", path_str(dir))),
            // 조용한 설치에서 같은 이름의 앱 창이 남아 있으면 설치 프로그램은 끄지 않고 10 으로 끝난다
            // (출시 도구 1.0.148). "앱이 끝나지 않았습니다 — 닫고 다시" 알림으로 보낸다.
            busy = NSIS_APP_RUNNING_EXIT,
            still = q(&format!("{APP_STILL_RUNNING} (another window is open)")),
        ),
        InstallKind::Msi => format!(
            "    Assert-Signed {file}\n\
             \x20   $before = Get-AppHash\n\
             \x20   Write-Log 'running msiexec'\n\
             \x20   $p = Start-Process -FilePath 'msiexec.exe' -ArgumentList {args} -Verb RunAs -Wait -PassThru\n\
             \x20   Write-Log ('msiexec exit code ' + $p.ExitCode)\n\
             \x20   if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) {{ throw ('msiexec exit code ' + $p.ExitCode) }}\n\
             \x20   Assert-Replaced $before\n",
            file = q(&file_s),
            args = q(&format!(
                "/i \"{file_s}\" /qb! /norestart MSIRESTARTMANAGERCONTROL=Disable"
            )),
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
                 \x20   $exes = @(Get-ChildItem -LiteralPath $src -Recurse -File -Filter '*.exe')\n\
                 \x20   if ($exes.Count -eq 0) {{ throw 'no program in the update' }}\n\
                 \x20   foreach ($e in $exes) {{ Assert-Signed $e.FullName }}\n\
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
    // 앱이 끝나기를 기다린다: 0.5초마다 그 번호의 프로세스가 아직 있는지(이름도 같은지 — 번호 재사용) 본다.
    // Wait-Process 는 쓰지 않는다. 앱이 관리자 권한으로 떠 있으면(설치 프로그램 마지막 화면의 "실행"으로 켬)
    // 일반 권한 스크립트의 Wait-Process 는 접근 거부로 곧바로 돌아오는데, Get-Process 로는 여전히 보여
    // 1초 만에 "앱이 아직 실행 중" 으로 실패했다(2026-10-11 CAD 0.2.6 실증). Get-Process 는 권한과 상관없이 보인다.
    // 실패해도 옛 판은 그대로다(설치 프로그램 · zip 되돌림). 앱을 닫은 뒤에 실패했다면 옛 판을 다시 켠다 —
    // 그러지 않으면 "지금 설치"를 누른 사용자에게는 앱이 그냥 꺼진 것으로 보인다. 다시 켠 앱이 결과 파일을
    // 읽어 실패를 알린다. 앱이 아직 떠 있어 실패한 것이면($exited 거짓) 켜지 않는다(두 개가 뜬다).
    // 결과 파일: 앱이 띄우기 전에 `pending`, 스크립트가 시작하자마자 `started`, 끝에 `ok` · `fail`.
    // 단계마다 업데이트 기록(LOG_FILE)에 한 줄씩 남긴다.
    let body = format!(
        "# {name} {ver} update - written by the app, runs after the app exits.\n\
         $ErrorActionPreference = 'Stop'\n\
         $result = {result}\n\
         $log = {log}\n\
         $app = {app}\n\
         $stillMessage = {still}\n\
         $installLock = $null\n\
         $ownsInstallLock = $false\n\
         $exited = $false\n\
         function Write-Log([string]$text) {{\n\
         \x20   try {{ Add-Content -LiteralPath $log -Value ((Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ' script: ' + $text) -Encoding UTF8 }} catch {{ }}\n\
         }}\n\
         function Get-AppHash {{\n\
         \x20   if (Test-Path -LiteralPath $app) {{ return (Get-FileHash -LiteralPath $app -Algorithm SHA256).Hash }}\n\
         \x20   return ''\n\
         }}\n\
         function Assert-Replaced([string]$before) {{\n\
         \x20   if ((Get-AppHash) -eq $before) {{ throw 'the installer finished but the program was not replaced' }}\n\
         }}\n\
         {check}\
         {instances}\n\
         try {{\n\
         \x20   $installLock = [IO.File]::Open((Join-Path (Split-Path -Parent $result) '.update-install.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::ReadWrite)\n\
         \x20   $lockDeadline = (Get-Date).AddSeconds(10)\n\
         \x20   while (-not $ownsInstallLock) {{\n\
         \x20       try {{ $installLock.Lock(0, 1); $ownsInstallLock = $true }} catch {{\n\
         \x20           if ((Get-Date) -gt $lockDeadline) {{ throw }}\n\
         \x20           Start-Sleep -Milliseconds 100\n\
         \x20       }}\n\
         \x20   }}\n\
         \x20   Set-Content -LiteralPath $result -Value ({started} + (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssK')) -Encoding UTF8\n\
         \x20   Write-Log ('started {ver}, waiting for process ' + {pid})\n\
         \x20   Wait-AppInstances\n\
         \x20   $exited = $true\n\
         \x20   Write-Log 'the app exited'\n\
         \x20   if (@(Get-AppInstances).Count -ne 0) {{ throw $stillMessage }}\n\
         {install}\
         \x20   Set-Content -LiteralPath $result -Value {ok} -Encoding UTF8\n\
         \x20   Write-Log 'installed {ver}'\n\
         \x20   $installLock.Dispose(); $installLock = $null\n\
         {relaunch}\
         }} catch {{\n\
         \x20   if (-not $ownsInstallLock) {{ Write-Log 'another updater owns the install lock'; return }}\n\
         \x20   Set-Content -LiteralPath $result -Value ({fail} + $_.Exception.Message) -Encoding UTF8\n\
         \x20   Write-Log ('failed: ' + $_.Exception.Message)\n\
         \x20   if ($exited) {{\n\
         \x20       if ($installLock) {{ $installLock.Dispose(); $installLock = $null }}\n\
         \x20       try {{\n\
         \x20   {relaunch}\
         \x20       }} catch {{ Write-Log ('restart failed: ' + $_.Exception.Message) }}\n\
         \x20   }}\n\
         }} finally {{ if ($installLock) {{ $installLock.Dispose() }} }}\n",
        name = ctx.product.name,
        check = signature_check(),
        instances = include_str!("windows_instances.ps1"),
        result = q(&path_str(&ctx.work_dir.join(RESULT_FILE))),
        log = q(&path_str(&ctx.work_dir.join(LOG_FILE))),
        app = q(&path_str(ctx.exe)),
        pid = ctx.pid,
        started = q(&format!("started {ver} ")),
        still = q(APP_STILL_RUNNING),
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
