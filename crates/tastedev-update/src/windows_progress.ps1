# A separate, non-modal process owns progress UI so it survives ALL app windows
# exiting. Closing the status window only hides UI; it never closes an app or
# cancels an installer. State and diagnostic logs survive the viewer.
function Set-UpdatePhase([string]$Phase, [string]$Detail = '') {
    try {
        $state = @{phase=$Phase; detail=$Detail; product=$updateProduct; version=$updateVersion; language=$updateLanguage; owner=$PID; ownerStart=(Get-Process -Id $PID).StartTime.ToUniversalTime().Ticks.ToString()}
        $json = $state | ConvertTo-Json -Compress
        $tempState = $progressState + '.new'
        [IO.File]::WriteAllText($tempState, $json, [Text.UTF8Encoding]::new($false))
        if ([IO.File]::Exists($progressState)) { [IO.File]::Replace($tempState, $progressState, [NullString]::Value) }
        else { [IO.File]::Move($tempState, $progressState) }
        Write-Log ('phase=' + $Phase)
    } catch { Write-Log ('progress state failed: ' + $_.Exception.Message) }
}
function Start-UpdateProgress {
    $viewer = $null
    try {
        $ready = $progressState + '.ready'
        if (Test-Path -LiteralPath $ready) { Remove-Item -LiteralPath $ready -Force }
        [IO.File]::WriteAllText($progressScript, $progressSource, [Text.UTF8Encoding]::new($true))
        $command = '& ' + "'" + $progressScript.Replace("'", "''") + "' -StatePath '" + $progressState.Replace("'", "''") + "'"
        $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
        $viewer = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList @('-NoProfile','-NonInteractive','-STA','-ExecutionPolicy','Bypass','-EncodedCommand',$encoded) -WindowStyle Hidden -PassThru -ErrorAction Stop
        Write-Log ('progress viewer started: pid=' + $viewer.Id)
        $deadline = (Get-Date).AddSeconds(15)
        while (-not (Test-Path -LiteralPath $ready)) {
            $viewer.Refresh()
            if ($viewer.HasExited) { throw ('progress viewer exited: ' + $viewer.ExitCode) }
            if ((Get-Date) -gt $deadline) { throw 'progress viewer did not become ready' }
            Start-Sleep -Milliseconds 100
        }
    } catch {
        Write-Log ('progress viewer failed: ' + $_.Exception.Message)
        throw
    } finally {
        if ($viewer) { $viewer.Dispose() }
    }
}
