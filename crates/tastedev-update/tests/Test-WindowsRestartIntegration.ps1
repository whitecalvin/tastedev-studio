param([Parameter(Mandatory)][string]$WorkRoot)
$ErrorActionPreference = 'Stop'
$source = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../src/plan.rs') -Raw
$match = [regex]::Match($source, '(?s)let body = format!\(\s*"(.*?)",\s*name = ctx.product.name,')
if (-not $match.Success) { throw 'generated script template not found' }
$template = $match.Groups[1].Value.Replace('{{', '__OPEN__').Replace('}}', '__CLOSE__')
$template = [regex]::Replace($template, '\\\r?\n\s*', '')
$template = [regex]::Replace($template, '\\(x20|n|r|t|\\|")', {
    param($m)
    switch ($m.Groups[1].Value) { 'x20' {' '} 'n' {"`n"} 'r' {"`r"} 't' {"`t"} '\' {'\'} '"' {'"'} }
})
# Protect Rust format's escaped braces before substituting named fields.
$helper = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../src/windows_restart.ps1') -Raw
$instances = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../src/windows_instances.ps1') -Raw
$progress = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../src/windows_progress.ps1') -Raw
$progressView = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../src/windows_progress_view.ps1') -Raw -Encoding UTF8
function Quote([string]$s) { return "'" + $s.Replace("'", "''") + "'" }
foreach ($case in @('success', 'consent-cancelled', 'restart-denied', 'startup-crash', 'install-failed', 'still-running', 'viewer-failed')) {
    $dir = Join-Path $WorkRoot $case
    $null = New-Item -ItemType Directory -Path $dir -Force
    $result = Join-Path $dir 'update-result.txt'
    $log = Join-Path $dir 'update-log.txt'
    $mocks = @'
function Wait-AppInstances {
    $script:waits++
    if ($script:testCase -eq 'still-running') { throw 'still running' }
}
function Request-ExitConsent { if($script:testCase -eq 'consent-cancelled'){throw 'consent cancelled'} }
function Start-UpdateProgress { if($script:testCase -eq 'viewer-failed'){throw 'progress viewer unavailable'} }
function Get-AppInstances { if ($script:launches -gt 0) { [pscustomobject]@{Id=42} } }
function Start-Process {
    param($FilePath, $WorkingDirectory, $WindowStyle, [switch]$PassThru, $ErrorAction)
    $script:launches++
    if ($script:testCase -eq 'restart-denied') { throw [ComponentModel.Win32Exception]::new(5) }
    $ack = @{token=$env:TASTEDEV_UPDATE_RESTART_TOKEN;pid=42;exe=$FilePath;version='1.2.3'}
    $readyPath = Join-Path (Split-Path $progressState -Parent) ('progress-restart-'+$env:TASTEDEV_UPDATE_RESTART_TOKEN+'.42.ready.json')
    [IO.File]::WriteAllText($readyPath, ($ack|ConvertTo-Json), [Text.UTF8Encoding]::new($false))
    $p = [pscustomobject]@{Id=42; HasExited=($script:testCase -eq 'startup-crash'); ExitCode=37; MainWindowHandle=[IntPtr]1; Responding=$true}
    $p | Add-Member ScriptMethod Refresh {}
    return $p
}
function New-Object {
    param($ComObject)
    if($ComObject -ne 'WScript.Shell'){throw 'unexpected COM class'}
    $shell=[pscustomobject]@{}
    $shell | Add-Member ScriptMethod AppActivate {param($ProcessId) return $ProcessId -eq 42}
    return $shell
}
'@
    $fields = @{
        name='TEST'; ver='1.2.3'; pid='42'; check=''; instances=$instances
        restart=$helper
        progress=($progress + "`n" + $mocks)
        progress_view=(Quote $progressView)
        progress_state=(Quote (Join-Path $dir 'progress.json'))
        progress_script=(Quote (Join-Path $dir 'progress.ps1'))
        product="'TEST'"; version="'1.2.3'"; language="'ko'"
        result=(Quote $result); log=(Quote $log); app=(Quote (Join-Path $PSHOME 'powershell.exe'))
        started="'started 1.2.3 '"; ok="'ok 1.2.3'"; fail="'fail 1.2.3 '"; still="'still running'"
        install="if (`$script:testCase -eq 'install-failed') { throw 'simulated installer failure' }; `$script:installed = `$true`n"
        relaunch="`$null = Restart-App -Executable `$app`n"
    }
    $body = [regex]::Replace($template, '\{([a-z_]+)\}', { param($m) $fields[$m.Groups[1].Value] })
    $body = $body.Replace('__OPEN__', '{').Replace('__CLOSE__', '}')
    $script:testCase = $case
    $script:installed = $false
    $script:launches = 0
    $script:waits = 0
    & ([scriptblock]::Create($body))
    $outcome = (Get-Content -LiteralPath $result -Raw).Trim()
    $record = Get-Content -LiteralPath $log -Raw
    if ($case -in @('success','restart-denied','startup-crash') -and $outcome -ne 'ok 1.2.3') { throw "installation result overwritten: $case" }
    if ($case -eq 'success' -and $record -notmatch 'restart confirmed:') { throw 'no restart confirmation' }
    if ($case -in @('restart-denied','startup-crash') -and $record -notmatch 'restart failed:') { throw 'no restart failure record' }
    if ($case -eq 'install-failed' -and $outcome -notmatch '^fail 1.2.3 simulated installer failure') { throw 'installation failure overwritten' }
    if ($case -eq 'still-running' -and $script:launches -ne 0) { throw 'restart before users closed their windows' }
    if ($case -eq 'viewer-failed' -and ($script:launches -ne 0 -or $script:installed -or $outcome -notmatch '^fail ')) { throw 'silent UI failure allowed installation' }
    if ($script:launches -gt 1) { throw 'duplicate restart attempt' }
    if ($case -eq 'consent-cancelled' -and ($script:launches -ne 0 -or $script:installed)) { throw 'installed after consent cancellation' }
    if ($case -eq 'success' -and $script:waits -ne 1) { throw 'did not wait for all instances' }
    $state = Get-Content -LiteralPath (Join-Path $dir 'progress.json') -Raw | ConvertFrom-Json
    $expectedPhase = if($case -eq 'success'){'complete'}else{'failed'}
    if ($state.phase -ne $expectedPhase) { throw "incorrect final phase: $case $($state.phase)" }
    foreach($required in @('waiting', 'installing', 'restarting')) {
        if ($case -eq 'success' -and $record -notmatch "phase=$required") { throw "missing phase: $required" }
    }
    Write-Output "PASS generated-wrapper $case (launches=$script:launches)"
}
