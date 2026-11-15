param([string]$HelperPath = (Join-Path $PSScriptRoot '../src/windows_instances.ps1'))
$ErrorActionPreference = 'Stop'
. $HelperPath
$app = 'C:/Apps/' + [char]0xD55C + [char]0xAE00 + ' SSH/tastessh.exe'
$stillMessage = 'the app is still running'
$script:mode = 'same-install'
$script:reads = 0
function Write-Log { param($text) }
function Get-Process {
    [CmdletBinding()]
    param($Name, $Id)
    if ($null -ne $Id) {
        if ($script:mode -eq 'exited') {
            $record = [Management.Automation.ErrorRecord]::new([ArgumentException]::new('exited'), 'NoProcessFoundForGivenId', [Management.Automation.ErrorCategory]::ObjectNotFound, $Id)
            $PSCmdlet.ThrowTerminatingError($record)
        }
        if ($script:mode -eq 'recovered') { return [pscustomobject]@{Id=$Id; Path=$app; HasExited=$false} }
        return [pscustomobject]@{Id=$Id; Path=$null; HasExited=$false}
    }
    $script:reads++
    switch ($script:mode) {
        'same-install' { [pscustomobject]@{Id=42; Path=$app}; [pscustomobject]@{Id=43; Path='C:/Other/tastessh.exe'} }
        'drain' { if ($script:reads -le 3) { [pscustomobject]@{Id=42; Path=$app}; [pscustomobject]@{Id=44; Path=$app} } }
        default { [pscustomobject]@{Id=42; Path=$null} }
    }
}
if (@(Get-AppInstances).Count -ne 1) { throw 'neighbor install included' }
Write-Output 'PASS exact installation path'
$script:mode='exited'
if (@(Get-AppInstances).Count -ne 0) { throw 'vanished PID treated as error' }
Write-Output 'PASS process exit/path lookup race'
$script:mode='recovered'
if (-not (@(Get-AppInstances)[0].PathVerified)) { throw 'fresh path lookup not used' }
Write-Output 'PASS refreshed process path'
$script:mode='inaccessible'
if (@(Get-AppInstances | Where-Object { $_.PathVerified -eq $false }).Count -ne 1) { throw 'unverifiable live process ignored' }
Write-Output 'PASS inaccessible live PID remains blocker'
function Start-Sleep { param($Milliseconds) }
$script:mode='drain'; $script:reads=0
Wait-AppInstances
if ($script:reads -lt 4) { throw 'installed before all windows exited' }
Write-Output 'PASS multiple instances drain without closing windows'
$script:mode='inaccessible'; $script:clock=0
function Get-Date { $script:clock++; [datetime]::new(2026,1,1).AddSeconds($script:clock*601) }
try { Wait-AppInstances; throw 'timeout not enforced' } catch {
    if ($_.Exception.Message -notmatch 'cannot verify a running application path: pid=42') { throw }
}
Write-Output 'PASS unknown live path timeout fails closed with PID'
if ((Get-Content -LiteralPath $HelperPath -Raw) -match 'Stop-Process|CloseMainWindow|WScript.Shell|\.Popup\(') { throw 'forced close or native popup introduced' }
