[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$RuntimeDirectory,
    [Parameter(Mandatory)][string]$OutputDirectory,
    [string]$ToolDirectory = (Join-Path $PSScriptRoot '../../tools/cross-platform-release/service-runtime'),
    [string]$ReuseHostPackage,
    [switch]$ValidateOnly
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$runtime = (Resolve-Path -LiteralPath $RuntimeDirectory).Path
if ((Get-Item -LiteralPath $runtime).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Runtime links are forbidden' }
$manifest = Get-Content -LiteralPath (Join-Path $runtime 'runtime-manifest.json') -Raw | ConvertFrom-Json
if ($manifest.schemaVersion -ne 1 -or $manifest.files.Count -lt 1) { throw 'Invalid runtime manifest' }
$listed = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($entry in $manifest.files) {
    $relative = [string]$entry.file
    if ($relative -notmatch '^[^:/\\]+(?:/[^:/\\]+)*$' -or $relative -match '(^|/)\.\.?(/|$)' -or
        $relative -match '(^|/)(\.env(?:\..*)?|.*(?:credential|secret).*|.*\.(?:key|pem|pfx))$' -or
        $entry.sha256 -notmatch '^[a-fA-F0-9]{64}$' -or -not $listed.Add($relative)) { throw 'Unsafe runtime manifest entry' }
    $file = Join-Path $runtime $relative
    if (-not (Test-Path -LiteralPath $file -PathType Leaf) -or
        (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ine $entry.sha256) { throw 'Runtime checksum mismatch' }
}
# 파일뿐 아니라 부모 directory junction도 거부하고 manifest에 없는 파일을 묶지 않는다.
foreach ($item in Get-ChildItem -LiteralPath $runtime -Recurse -Force) {
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Runtime links are forbidden' }
    $relative = [IO.Path]::GetRelativePath($runtime, $item.FullName).Replace('\', '/')
    if (-not $item.PSIsContainer -and $relative -ne 'runtime-manifest.json' -and -not $listed.Contains($relative)) { throw 'Unlisted runtime file' }
}
if (-not $listed.Contains('transport/main.ts') -or -not $listed.Contains('package.json')) { throw 'Core entry point/package missing' }
if ($ValidateOnly) { Write-Output "Runtime verified: $($manifest.files.Count) files"; return }
if (Test-Path -LiteralPath $OutputDirectory) { throw 'Existing package output: verify and reuse it instead of overwriting' }
$tools = (Resolve-Path -LiteralPath $ToolDirectory).Path
$compiler = Join-Path $env:SystemRoot 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$hostInputs = [ordered]@{
    sourceSha256 = (Get-FileHash -LiteralPath (Join-Path $tools 'WindowsServiceHost.cs')).Hash
    toolSha256 = (Get-FileHash -LiteralPath (Join-Path $tools 'Invoke-WindowsServiceRuntime.ps1')).Hash
    compilerSha256 = (Get-FileHash -LiteralPath $compiler).Hash
    contract = 'shared-windows-service-host-v1'
}
$reusedHost = $null
if ($ReuseHostPackage) {
    $previous = (Resolve-Path -LiteralPath $ReuseHostPackage).Path
    $record = Get-Content -LiteralPath (Join-Path $previous 'host-build.json') -Raw | ConvertFrom-Json
    $reusedHost = Join-Path $previous 'tastestudio-core-service.exe'
    if ($record.schemaVersion -ne 1) { throw 'Invalid service host reuse record' }
    foreach ($key in $hostInputs.Keys) {
        if ($record.inputs.$key -cne $hostInputs[$key]) { throw "Service host input changed: $key" }
    }
    if ((Get-Item -LiteralPath $reusedHost).Attributes -band [IO.FileAttributes]::ReparsePoint -or
        $record.hostSha256 -notmatch '^[a-fA-F0-9]{64}$' -or
        (Get-FileHash -LiteralPath $reusedHost).Hash -cne $record.hostSha256) { throw 'Service host checksum mismatch' }
}
$output = [IO.Path]::GetFullPath($OutputDirectory)
if ($output -ieq $runtime -or $output.StartsWith($runtime + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Package output must be outside the input runtime'
}
[IO.Directory]::CreateDirectory($output) | Out-Null
Copy-Item -LiteralPath $runtime -Destination (Join-Path $output 'runtime') -Recurse
foreach ($name in @('Invoke-WindowsServiceRuntime.ps1','WindowsServiceHost.cs')) {
    Copy-Item -LiteralPath (Join-Path $tools $name) -Destination (Join-Path $output $name)
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'configure-windows-core.ps1') -Destination $output
$definition = Join-Path $output 'build-definition.json'
@{serviceName='TASTESTUDIO-Core'} | ConvertTo-Json | Set-Content -LiteralPath $definition -Encoding utf8
$hostOutput = Join-Path $output 'tastestudio-core-service.exe'
if ($reusedHost) {
    Copy-Item -LiteralPath $reusedHost -Destination $hostOutput
    Write-Output 'Verified unchanged shared service host reused; no compilation'
} else {
    & (Join-Path $output 'Invoke-WindowsServiceRuntime.ps1') -Action Build -Definition $definition -HostPath $hostOutput
    if ($LASTEXITCODE -ne 0) { throw 'Shared service host build failed' }
}
@{schemaVersion=1;inputs=$hostInputs;hostSha256=(Get-FileHash -LiteralPath $hostOutput).Hash} |
    ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output 'host-build.json') -Encoding utf8
@'
TASTESTUDIO Core — Windows operator package

Requires native Node 24. This package does not include Node or install a service automatically.
Run configure-windows-core.ps1 with absolute NodePath, CredentialFile and DataDirectory.
CredentialFile must already exist and contain distinct CORE_AGENT_TOKEN / CORE_STUDIO_TOKEN values.
Restrict that file to the service account and administrators; do not place it in the runtime bundle.
The generated definition uses Node --env-file, so token values are not copied to service JSON.

After reviewing paths and granting LocalService read access to runtime/credentials and write access
to DataDirectory, use the shared Invoke-WindowsServiceRuntime.ps1 Install/Start/Status/Stop/Remove actions.
Install requires administrator privileges, uses LocalService and manual startup, refuses replacement.
HostPath and Definition must be absolute. Install and service lifecycle require user QA.
The service host is unsigned; this is a local verification package, not a signed release.
host-build.json records source/tool/compiler and executable hashes for verified incremental reuse.
Project toolchains and Playwright/browser dependencies are configured separately.
'@ | Set-Content -LiteralPath (Join-Path $output 'README.txt') -Encoding utf8
$packageFiles = @(Get-ChildItem -LiteralPath $output -Recurse -File | ForEach-Object {
    @{file=[IO.Path]::GetRelativePath($output,$_.FullName).Replace('\','/');sha256=(Get-FileHash -LiteralPath $_.FullName).Hash}
})
@{schemaVersion=1;files=$packageFiles;serviceInstalled=$false;hostSigned=$false} | ConvertTo-Json -Depth 5 |
    Set-Content -LiteralPath (Join-Path $output 'package-manifest.json') -Encoding utf8
Write-Output "Windows Core operator package: $output"
