param([Parameter(Mandatory)][string]$WorkRoot)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../src/windows_progress.ps1')
$null=New-Item -ItemType Directory -Path $WorkRoot -Force
$progressState=Join-Path $WorkRoot 'state.json'
$script:records=@()
function Write-Log {param($text) $script:records+= $text}
function Set-UpdatePhase {param($Phase,$Detail) $script:phase=$Phase}
foreach($answer in @('now','later')) {
    [IO.File]::WriteAllText($progressState+'.choice',$answer)
    $actual=Wait-RestartChoice -TimeoutSeconds 1
    if($actual -ne ($answer -eq 'now') -or $script:phase -ne 'awaiting_restart') {throw "incorrect choice: $answer"}
}
[IO.File]::WriteAllText($progressState+'.choice','invalid')
if(Wait-RestartChoice -TimeoutSeconds 1){throw 'invalid choice launched app'}
if(($script:records -join "`n") -notmatch 'timed out; restart deferred'){throw 'missing timeout record'}
Write-Output 'PASS explicit now, later, invalid/timeout deferral and diagnostic records'
