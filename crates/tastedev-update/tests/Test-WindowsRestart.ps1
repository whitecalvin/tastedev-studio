param([Parameter(Mandatory)][string]$WorkRoot, [string]$HelperPath, [string[]]$Cases = @('success', 'missing', 'denied', 'crash', 'wrong-path', 'no-window', 'not-responding', 'activation-denied','no-ack','wrong-token','wrong-pid','wrong-exe','wrong-version','delayed-ready','sibling-ack'))
$ErrorActionPreference = 'Stop'
if (-not $HelperPath) { $HelperPath = Join-Path $PSScriptRoot '../src/windows_restart.ps1' }
. $HelperPath
$script:messages = [Collections.Generic.List[string]]::new()
$script:mode = 'success'
$script:launches = 0
$script:sleeps = 0
$null = [IO.Directory]::CreateDirectory($WorkRoot)
$progressState = Join-Path $WorkRoot 'progress.json'
$updateVersion = '1.2.3'
$app = "D:\앱 폴더\it's SSH\tastessh.exe"
function Write-Log([string]$text) { $script:messages.Add($text) }
function Test-Path { param($LiteralPath, $PathType) return $script:mode -ne 'missing' }
function Start-Sleep {
    param($Milliseconds)
    $script:sleeps++
    if($script:mode -eq 'delayed-ready' -and $script:sleeps -eq 3) {
        [IO.File]::WriteAllText($script:replyPath, ($script:ack|ConvertTo-Json), [Text.UTF8Encoding]::new($false))
    }
}
function Start-Process {
    param($FilePath, $WorkingDirectory, $WindowStyle, [switch]$PassThru, $ErrorAction)
    $script:launches++
    if ($FilePath -cne $app -or $WorkingDirectory -cne (Split-Path -Parent $app) -or $WindowStyle -ne 'Normal' -or -not $PassThru) {
        throw 'incorrect restart arguments'
    }
    if ($script:mode -eq 'denied') { throw [ComponentModel.Win32Exception]::new(5) }
    $token = $env:TASTEDEV_UPDATE_RESTART_TOKEN
    $ack = @{token=$token;pid=42;exe=$app;version=$updateVersion}
    switch ($script:mode) {
        'wrong-token' { $ack.token='old-token' }
        'wrong-pid' { $ack.pid=43 }
        'wrong-exe' { $ack.exe='C:\Other\tastessh.exe' }
        'wrong-version' { $ack.version='1.2.2' }
    }
    $script:ack = $ack
    $replyPid = if($script:mode -eq 'sibling-ack'){43}else{42}
    $script:replyPath = Join-Path $WorkRoot ('progress-restart-'+$token+'.'+$replyPid+'.ready.json')
    if ($script:mode -notin @('no-ack','delayed-ready')) {
        [IO.File]::WriteAllText($script:replyPath, ($ack|ConvertTo-Json), [Text.UTF8Encoding]::new($false))
    }
    $p = [pscustomobject]@{ Id = 42; HasExited = $false; ExitCode = 37; MainWindowHandle=[IntPtr]1; Responding=$true }
    if ($script:mode -eq 'no-window') { $p.MainWindowHandle=[IntPtr]::Zero }
    if ($script:mode -eq 'not-responding') { $p.Responding=$false }
    $p | Add-Member ScriptMethod Refresh { if ($script:mode -eq 'crash') { $this.HasExited = $true } }
    return $p
}
function Get-AppInstances {
    if ($script:mode -ne 'wrong-path') { [pscustomobject]@{Id=42} }
}
function New-Object {
    param($ComObject)
    if ($ComObject -ne 'WScript.Shell') { throw 'unexpected COM class' }
    $shell = [pscustomobject]@{}
    $shell | Add-Member ScriptMethod AppActivate { param($ProcessId) return $ProcessId -eq 42 -and $script:mode -ne 'activation-denied' }
    return $shell
}
foreach ($case in $Cases) {
    $script:mode = $case
    $script:messages.Clear()
    $script:launches = 0
    $script:sleeps = 0
    $previousToken = $env:TASTEDEV_UPDATE_RESTART_TOKEN
    $result = Restart-App -Executable $app -StartupTimeoutMilliseconds 100
    if ($env:TASTEDEV_UPDATE_RESTART_TOKEN -cne $previousToken) { throw 'restart environment was not restored' }
    if ($result -ne ($case -in @('success','delayed-ready'))) { throw "incorrect result: $case" }
    $log = $script:messages -join "`n"
    if ($case -eq 'success' -and $log -notmatch 'restart confirmed: pid=42') { throw 'missing confirmation' }
    if ($case -notin @('success','delayed-ready') -and $log -notmatch 'restart failed:') { throw "missing failure: $case" }
    if ($case -eq 'denied' -and $log -notmatch 'nativeErrorCode=5') { throw 'missing native error' }
    if ($case -eq 'crash' -and $log -notmatch 'exitCode=37') { throw 'missing startup exit code' }
    if ($case -eq 'wrong-path' -and $log -notmatch 'path could not be verified') { throw 'wrong path accepted' }
    if ($case -in @('no-window','not-responding') -and $log -notmatch 'window was not ready') { throw 'headless process reported as ready' }
    if ($case -eq 'activation-denied' -and $log -notmatch 'activation was rejected') { throw 'activation failure ignored' }
    if ($case -eq 'success' -and $log -notmatch 'hwnd=1; responding=True; activationRequested=true') { throw 'visible startup evidence missing' }
    if ($case -eq 'success' -and ($script:sleeps -ne 0 -or $log -notmatch 'restart app ready:')) { throw 'ready app still waits' }
    if ($case -eq 'delayed-ready' -and $script:sleeps -ne 3) { throw 'did not complete immediately when readiness arrived' }
    if ($case -in @('no-ack','wrong-token','wrong-pid','wrong-exe','wrong-version') -and $log -notmatch 'appReady=False') { throw 'invalid readiness accepted' }
    if ($case -eq 'sibling-ack') {
        if ($log -notmatch 'appReady=False' -or -not [IO.File]::Exists($script:replyPath)) { throw 'sibling response was used or removed' }
        Remove-Item -LiteralPath $script:replyPath
    }
    if (@(Get-ChildItem -LiteralPath $WorkRoot -Filter 'progress-restart-*').Count) { throw 'restart handshake not cleaned' }
    if ($script:launches -gt 1) { throw 'duplicate app launched' }
    if ($case -eq 'missing' -and $script:launches -ne 0) { throw 'missing app launched' }
    Write-Output "PASS $case"
}
$tokens = $null
$errors = $null
$null = [Management.Automation.Language.Parser]::ParseFile((Resolve-Path $HelperPath), [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw ($errors -join "`n") }
Write-Output 'PASS Windows PowerShell parser'
