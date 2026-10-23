# The installer result and the restart result are independent. Never reinstall
# or launch a second copy merely because startup verification failed.
function Restart-App {
    param([string]$Executable, [int]$ObserveMilliseconds = 5000, [switch]$Recovery)
    $child = $null
    try {
        if (-not (Test-Path -LiteralPath $Executable -PathType Leaf)) {
            throw "restart executable is missing: $Executable"
        }
        $workingDirectory = Split-Path -Parent $Executable
        Write-Log "restart requested: executable=$Executable; workingDirectory=$workingDirectory"
        # The updater itself is hidden. Explicitly request a normal app window
        # and do not inherit an installer/cache directory as the app's cwd.
        $child = Start-Process -FilePath $Executable -WorkingDirectory $workingDirectory -WindowStyle Normal -PassThru -ErrorAction Stop
        if (-not $child) { throw 'restart returned no process' }
        Write-Log ('restart process created: pid=' + $child.Id)
        $clock = [Diagnostics.Stopwatch]::StartNew()
        do {
            $child.Refresh()
            if ($child.HasExited) {
                throw ('restart process exited during startup: pid=' + $child.Id + '; exitCode=' + $child.ExitCode)
            }
            Start-Sleep -Milliseconds 250
        } while ($clock.ElapsedMilliseconds -lt $ObserveMilliseconds)
        $child.Refresh()
        if ($child.HasExited) {
            throw ('restart process exited during startup: pid=' + $child.Id + '; exitCode=' + $child.ExitCode)
        }
        $matches = @(Get-AppInstances | Where-Object { $_.Id -eq $child.Id -and $_.PathVerified -ne $false })
        if ($matches.Count -ne 1) { throw 'restart process executable path could not be verified' }
        Write-Log ('restart confirmed: pid=' + $child.Id + '; executable=' + $Executable + '; observedMs=' + $clock.ElapsedMilliseconds)
        if (-not $Recovery -and (Get-Command Set-UpdatePhase -ErrorAction SilentlyContinue)) { Set-UpdatePhase 'complete' }
        return $true
    } catch {
        $nativeCode = ''
        if ($_.Exception.PSObject.Properties['NativeErrorCode']) { $nativeCode = '; nativeErrorCode=' + $_.Exception.NativeErrorCode }
        Write-Log ('restart failed: ' + $_.Exception.GetType().FullName + ': ' + $_.Exception.Message + $nativeCode)
        if (-not $Recovery -and (Get-Command Set-UpdatePhase -ErrorAction SilentlyContinue)) { Set-UpdatePhase 'failed' $_.Exception.Message }
        return $false
    } finally {
        if ($child -is [IDisposable]) { $child.Dispose() }
    }
}
