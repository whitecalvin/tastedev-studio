# 공용 출시 도구(release.desktop.json windows.prepareScript)가 깨끗한 복사본에서, cargo 빌드 앞에 부른다.
# Tauri 앱은 custom-protocol(cargo.allFeatures)로 빌드할 때 화면(Next.js 정적 내보내기, .next-desktop)을 실행 파일에
# 담는다. 그래서 여기서 먼저 화면을 검사하고 내보낸다. 실행 파일 옆에 더 넣을 것은 없어 -PayloadDirectory 는 비워 둔다.
param(
    [Parameter(Mandatory = $true)][string]$Version,
    [Parameter(Mandatory = $true)][string]$PayloadDirectory
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$env:COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'

# Opt-in evidence is outside the release checkout. Mismatch always runs the normal gates.
function Test-VerifiedFrontendGates {
    $recordPath = $env:TASTESTUDIO_VERIFICATION_REUSE
    if ([string]::IsNullOrWhiteSpace($recordPath) -or -not [IO.Path]::IsPathRooted($recordPath)) { return $false }
    try {
        $record = Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json -Depth 20
        if ($record.schema -ne 1 -or $record.nodeVersion -cne (& node -p 'process.version')) { return $false }
        $nodePath = (& node -p 'process.execPath').Trim()
        if ((Get-FileHash -LiteralPath $nodePath).Hash -cne $record.nodeHash) { return $false }
        $package = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json -AsHashtable
        $package.Remove('version') | Out-Null
        if (($package | ConvertTo-Json -Depth 20 -Compress) -cne $record.packageWithoutVersion) { return $false }
        $config = Get-Content -LiteralPath (Join-Path $root 'src-tauri/tauri.conf.json') -Raw | ConvertFrom-Json -AsHashtable
        $config.Remove('version') | Out-Null
        if (($config | ConvertTo-Json -Depth 20 -Compress) -cne $record.tauriWithoutVersion) { return $false }
        foreach ($item in $record.inputs) {
            if ([IO.Path]::IsPathRooted($item.path) -or $item.path -match '(^|[/\\])\.\.([/\\]|$)') { return $false }
            $file = Join-Path $root $item.path
            if (-not (Test-Path -LiteralPath $file -PathType Leaf) -or (Get-FileHash -LiteralPath $file).Hash -cne $item.sha256) { return $false }
        }
        $current = @(Get-ChildItem -LiteralPath (Join-Path $root 'src'),(Join-Path $root 'transport'),(Join-Path $root 'tests'),(Join-Path $root 'scripts'),(Join-Path $root 'browser-runner') -Recurse -File | Where-Object Extension -NE '.ps1')
        if ($current.Count -ne $record.codeFileCount) { return $false }
        $required = @($current | ForEach-Object { [IO.Path]::GetRelativePath($root,$_.FullName) }) + @('pnpm-lock.yaml','tsconfig.json','eslint.config.mjs','next.config.ts')
        $listed = @($record.inputs | ForEach-Object { ([string]$_.path).Replace('/','\') })
        if ($listed.Count -ne $required.Count -or @($listed | Sort-Object -Unique).Count -ne $listed.Count) { return $false }
        foreach ($requiredPath in $required) { if ($requiredPath.Replace('/','\') -notin $listed) { return $false } }
        foreach ($gate in $record.gates) {
            if ($gate.exitCode -ne 0 -or -not (Test-Path -LiteralPath $gate.path -PathType Leaf) -or (Get-FileHash -LiteralPath $gate.path).Hash -cne $gate.sha256) { return $false }
        }
        if ((@($record.gates.name | Sort-Object) -join ',') -cne 'lint,node,typecheck') { return $false }
        return $true
    } catch { return $false }
}

function Invoke-Step([string]$Label, [scriptblock]$Command) {
    Write-Host "== $Label"
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "$Label 이 실패했습니다(종료 코드 $LASTEXITCODE)." }
}

# pnpm 11 의 `pnpm run` 은 먼저 의존성 상태를 보려고 `pnpm` 을 이름으로 다시 부른다. 이 PC 처럼 pnpm 이 PATH 에 없고
# corepack 으로만 쓸 수 있으면 "'pnpm' 은 ... 명령이 아닙니다" 로 멈춘다. 이 스크립트 동안만 corepack 을 부르는
# pnpm.cmd 를 PATH 앞에 둔다(끝나면 지운다).
$pnpmShim = $null
if ($null -eq (Get-Command pnpm -CommandType Application -ErrorAction SilentlyContinue)) {
    $pnpmShim = Join-Path ([IO.Path]::GetTempPath()) "tastedev-pnpm-shim-$PID"
    [IO.Directory]::CreateDirectory($pnpmShim) | Out-Null
    [IO.File]::WriteAllText((Join-Path $pnpmShim 'pnpm.cmd'), "@corepack pnpm %*`r`n", [Text.Encoding]::ASCII)
    $env:PATH = "$pnpmShim;$env:PATH"
}

Push-Location $root
try {
    # pnpm 은 Node 의 corepack 으로 부른다(PATH 에 pnpm 이 없어도 된다). 잠금 파일 그대로 설치.
    Invoke-Step 'pnpm install (잠금 파일 그대로)' { & corepack.cmd pnpm install --frozen-lockfile }
    if (Test-VerifiedFrontendGates) {
        Write-Host '검사 재사용: 같은 Node, 잠금 파일, 소스·설정 및 성공 로그 해시 확인. lint/typecheck/Node 중복 실행 없음.'
    } else {
        Invoke-Step '화면 lint' { & corepack.cmd pnpm run lint }
        Invoke-Step '화면 typecheck' { & corepack.cmd pnpm run typecheck }
        Invoke-Step '화면 · Core 시험' { & corepack.cmd pnpm run test }
    }
    # pnpm build:desktop(scripts/build-desktop.mjs)은 저장소 밖(resources)에 검증 기록을 남기므로, 출시에서는 같은 일을
    # 직접 한다: Monaco 준비 → STUDIO_DESKTOP_EXPORT=1 로 next build(= .next-desktop 정적 내보내기).
    Invoke-Step 'Monaco 준비' { & node scripts/prepare-monaco.mjs }
    $previousExport = $env:STUDIO_DESKTOP_EXPORT
    try {
        $env:STUDIO_DESKTOP_EXPORT = '1'
        Invoke-Step '화면 정적 내보내기(.next-desktop)' { & node node_modules/next/dist/bin/next build }
    }
    finally { $env:STUDIO_DESKTOP_EXPORT = $previousExport }
    if (-not (Test-Path -LiteralPath (Join-Path $root '.next-desktop\index.html') -PathType Leaf)) {
        throw '.next-desktop\index.html 이 없습니다 — Tauri 앱에 담을 화면을 내보내지 못했습니다.'
    }
}
finally {
    Pop-Location
    if ($null -ne $pnpmShim) { Remove-Item -LiteralPath $pnpmShim -Recurse -Force -ErrorAction SilentlyContinue }
}

[IO.Directory]::CreateDirectory($PayloadDirectory) | Out-Null
Write-Host "TASTESTUDIO $Version 화면 준비 완료(.next-desktop). Windows payload 에 더할 파일은 없습니다."
