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

function Invoke-Step([string]$Label, [scriptblock]$Command) {
    Write-Host "== $Label"
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "$Label 이 실패했습니다(종료 코드 $LASTEXITCODE)." }
}

Push-Location $root
try {
    # pnpm 은 Node 의 corepack 으로 부른다(PATH 에 pnpm 이 없어도 된다). 잠금 파일 그대로 설치.
    Invoke-Step 'pnpm install (잠금 파일 그대로)' { & corepack.cmd pnpm install --frozen-lockfile }
    Invoke-Step '화면 lint' { & corepack.cmd pnpm run lint }
    Invoke-Step '화면 typecheck' { & corepack.cmd pnpm run typecheck }
    Invoke-Step '화면 · Core 시험' { & corepack.cmd pnpm run test }
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
finally { Pop-Location }

[IO.Directory]::CreateDirectory($PayloadDirectory) | Out-Null
Write-Host "TASTEDEV Studio $Version 화면 준비 완료(.next-desktop). Windows payload 에 더할 파일은 없습니다."
