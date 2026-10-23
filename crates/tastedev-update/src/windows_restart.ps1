# The installer result and the restart result are independent. Never reinstall
# or launch a second copy merely because startup verification failed.
function Restart-App {
    param([string]$Executable, [int]$ObserveMilliseconds = 5000, [switch]$Recovery, [int]$StartupTimeoutMilliseconds = 30000)
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
        $windowSince = $null
        $windowHandle = [IntPtr]::Zero
        do {
            $child.Refresh()
            if ($child.HasExited) {
                throw ('restart process exited during startup: pid=' + $child.Id + '; exitCode=' + $child.ExitCode)
            }
            $windowHandle = $child.MainWindowHandle
            if ($windowHandle -ne [IntPtr]::Zero -and $child.Responding) {
                if ($null -eq $windowSince) {
                    $windowSince = $clock.ElapsedMilliseconds
                    Write-Log ('restart window detected: pid=' + $child.Id + '; hwnd=' + $windowHandle)
                }
                if ($clock.ElapsedMilliseconds - $windowSince -ge $ObserveMilliseconds) { break }
            } else { $windowSince = $null }
            if ($clock.ElapsedMilliseconds -ge $StartupTimeoutMilliseconds) {
                throw ('restart window was not ready before timeout: pid=' + $child.Id + '; hwnd=' + $windowHandle + '; responding=' + $child.Responding)
            }
            Start-Sleep -Milliseconds 250
        } while ($true)
        $child.Refresh()
        if ($child.HasExited) {
            throw ('restart process exited during startup: pid=' + $child.Id + '; exitCode=' + $child.ExitCode)
        }
        $matches = @(Get-AppInstances | Where-Object { $_.Id -eq $child.Id -and $_.PathVerified -ne $false })
        if ($matches.Count -ne 1) { throw 'restart process executable path could not be verified' }
        # Only activate the new process from this user-requested update. Do not
        # send keystrokes, terminate another instance, or open a native dialog.
        $shell = New-Object -ComObject WScript.Shell
        try { $activated = $shell.AppActivate([int]$child.Id) }
        finally { if ([Runtime.InteropServices.Marshal]::IsComObject($shell)) { $null = [Runtime.InteropServices.Marshal]::ReleaseComObject($shell) } }
        if (-not $activated) { throw ('restart window activation was rejected: pid=' + $child.Id) }
        Write-Log ('restart confirmed: pid=' + $child.Id + '; executable=' + $Executable + '; hwnd=' + $windowHandle + '; responding=' + $child.Responding + '; activationRequested=true; observedMs=' + $clock.ElapsedMilliseconds)
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
