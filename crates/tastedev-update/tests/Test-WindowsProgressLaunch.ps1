param([Parameter(Mandatory)][string]$WorkRoot)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../src/windows_progress.ps1')
$null=New-Item -ItemType Directory -Path $WorkRoot -Force
$progressState=Join-Path $WorkRoot "it's status.json"
$progressScript=Join-Path $WorkRoot "it's viewer.ps1"
$progressSource='# Test fixture only. No real viewer process is started.'
$script:case='success'
$script:checks=0; $script:clock=0
function Write-Log {param($text)}
function Start-Sleep {param($Milliseconds)}
function Get-Date { $script:clock++; [datetime]::new(2026,1,1).AddSeconds($script:clock*16) }
function Test-Path {param($LiteralPath) if($LiteralPath -eq ($progressState+'.choice')){return $false}; $script:checks++; return $script:case -eq 'success' -and $script:checks -gt 1}
function Start-Process {
    param($FilePath,$ArgumentList,$WindowStyle,[switch]$PassThru,$ErrorAction)
    if($WindowStyle -ne 'Hidden' -or -not $PassThru -or $ArgumentList -notcontains '-STA') { throw 'unsafe viewer launch' }
    $decoded=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($ArgumentList[-1]))
    if($decoded -notmatch "it''s viewer.ps1' -StatePath '.*it''s status.json'") { throw 'path quoting lost' }
    if($script:case -eq 'denied'){throw 'access denied'}
    $p=[pscustomobject]@{Id=123;HasExited=($script:case -eq 'early-exit');ExitCode=7}
    $p | Add-Member ScriptMethod Refresh {}
    $p | Add-Member ScriptMethod Dispose {}
    return $p
}
foreach($case in @('success','denied','early-exit','timeout')) {
    $script:case=$case; $script:checks=0; $script:clock=0
    $failed=$false
    try {Start-UpdateProgress}catch{$failed=$true}
    if($failed -ne ($case -ne 'success')){throw "incorrect viewer handoff: $case"}
    Write-Output "PASS viewer readiness $case"
}
$bytes=[IO.File]::ReadAllBytes($progressScript)
if($bytes[0] -ne 239 -or $bytes[1] -ne 187 -or $bytes[2] -ne 191){throw 'PowerShell 5 viewer BOM missing'}
Write-Output 'PASS viewer UTF-8 BOM'
