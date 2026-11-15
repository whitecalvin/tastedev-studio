param([Parameter(Mandatory)][string]$WorkRoot)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../src/windows_instances.ps1')
$null=New-Item -ItemType Directory -Path $WorkRoot -Force
$app='C:/Program Files/TEST/test.exe'; $updateVersion='1.2.3'
function Write-Log {param($text)}
function Get-AppInstances {
    if($script:case -eq 'unknown'){return [pscustomobject]@{Id=42;PathVerified=$false}}
    [pscustomobject]@{Id=42;PathVerified=$true}
    [pscustomobject]@{Id=43;PathVerified=$true}
}
function Get-Process {param($Id,$ErrorAction) [pscustomobject]@{StartTime=([datetime]'2026-10-23T00:00:00Z').AddSeconds($Id)}}
function Start-Sleep {
    param($Milliseconds)
    $script:reads++
    $p=$progressState+'.close-request.json'
    $request=[IO.File]::ReadAllText($p)|ConvertFrom-Json
    if($request.commit){throw 'commit before consent'}
    if($script:case -eq 'unknown'){Microsoft.PowerShell.Utility\Start-Sleep -Milliseconds 250;return}
    foreach($id in 42,43){
        $start=$request.targets.($id.ToString())
        $answer=if($script:case -eq 'stale' -and $script:reads -eq 1){'wrong-start'}else{$start}
        [IO.File]::WriteAllText($p+'.'+$id+'.ack', $request.token+':'+$answer)
    }
    if($script:case -eq 'cancel'){[IO.File]::WriteAllText($p+'.cancel',$request.token+':cancel')}
}
foreach($case in @('accept','cancel','stale','unknown')) {
    $script:case=$case; $script:reads=0
    $progressState=Join-Path $WorkRoot ($case+'.json')
    $failed=$false
    try{Request-ExitConsent -TimeoutSeconds 1}catch{$failed=$true}
    if($failed -ne ($case -in @('cancel','unknown'))){throw "incorrect consent result: $case"}
    $state=[IO.File]::ReadAllText($progressState+'.close-request.json')|ConvertFrom-Json
    if($state.commit -ne ($case -in @('accept','stale'))){throw "wrong commit: $case"}
    if($case -eq 'stale' -and $script:reads -lt 2){throw 'accepted reused PID/stale ack'}
    Write-Output "PASS cooperative consent $case"
}
