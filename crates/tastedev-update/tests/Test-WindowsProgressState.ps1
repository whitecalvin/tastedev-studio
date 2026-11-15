param([Parameter(Mandatory)][string]$WorkRoot)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../src/windows_progress.ps1')
$null=New-Item -ItemType Directory -Path $WorkRoot -Force
$progressState=Join-Path $WorkRoot 'progress.json'
$updateProduct='TEST'; $updateVersion='1.2.3'; $updateLanguage='ko'
function Write-Log {param($text)}
foreach($phase in @('waiting','installing','awaiting_restart','restarting','complete')) {
    Set-UpdatePhase $phase
    $read=[IO.File]::ReadAllText($progressState)|ConvertFrom-Json
    if($read.phase -cne $phase){throw 'atomic phase publication failed'}
}
$progressState=Join-Path $WorkRoot 'blocked'
$null=New-Item -ItemType Directory -Path $progressState -Force
$caught=$false
try{Set-UpdatePhase 'installing'}catch{$caught=$true}
if(-not $caught){throw 'state publication failed silently; stale UI would survive'}
Write-Output 'PASS atomic phase snapshots and fail-closed publication failure'
