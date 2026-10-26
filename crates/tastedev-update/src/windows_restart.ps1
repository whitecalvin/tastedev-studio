# The installer result and the restart result are independent. Never reinstall
# or launch a second copy merely because startup verification failed.
function Restart-App {
    param([string]$Executable, [switch]$Recovery, [int]$StartupTimeoutMilliseconds = 30000)
    $child = $null
    $request = $null
    $reply = $null
    try {
        if (-not (Test-Path -LiteralPath $Executable -PathType Leaf)) {
            throw "restart executable is missing: $Executable"
        }
        $workingDirectory = Split-Path -Parent $Executable
        $token = [Guid]::NewGuid().ToString('N')
        $work = Split-Path -Parent $progressState
        $request = Join-Path $work ('progress-restart-' + $token + '.request.json')
        $expectedVersion = if ($Recovery) { '' } else { $updateVersion }
        $expires = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + 60
        [IO.File]::WriteAllText($request, (@{token=$token;exe=$Executable;version=$expectedVersion;expires=$expires}|ConvertTo-Json -Compress), [Text.UTF8Encoding]::new($false))
        Write-Log "restart requested: executable=$Executable; workingDirectory=$workingDirectory"
        # The updater itself is hidden. Explicitly request a normal app window
        # and do not inherit an installer/cache directory as the app's cwd.
        $previousToken = $env:TASTEDEV_UPDATE_RESTART_TOKEN
        try {
            $env:TASTEDEV_UPDATE_RESTART_TOKEN = $token
            $child = Start-Process -FilePath $Executable -WorkingDirectory $workingDirectory -WindowStyle Normal -PassThru -ErrorAction Stop
        } finally {
            if ($null -eq $previousToken) { Remove-Item Env:TASTEDEV_UPDATE_RESTART_TOKEN -ErrorAction SilentlyContinue }
            else { $env:TASTEDEV_UPDATE_RESTART_TOKEN = $previousToken }
        }
        if (-not $child) { throw 'restart returned no process' }
        $reply = Join-Path $work ('progress-restart-' + $token + '.' + $child.Id + '.ready.json')
        Write-Log ('restart process created: pid=' + $child.Id)
        $clock = [Diagnostics.Stopwatch]::StartNew()
        $windowDetected = $false
        $appReady = $false
        $windowHandle = [IntPtr]::Zero
        do {
            $child.Refresh()
            if ($child.HasExited) {
                throw ('restart process exited during startup: pid=' + $child.Id + '; exitCode=' + $child.ExitCode)
            }
            $windowHandle = $child.MainWindowHandle
            if ($windowHandle -ne [IntPtr]::Zero -and $child.Responding) {
                if (-not $windowDetected) {
                    $windowDetected = $true
                    Write-Log ('restart window detected: pid=' + $child.Id + '; hwnd=' + $windowHandle)
                }
                # A window alone may be a splash screen. Require the new app's
                # UI-loop response for this nonce/PID/path/version, without a dwell.
                if ([IO.File]::Exists($reply)) {
                    try {
                        $ready = [IO.File]::ReadAllText($reply) | ConvertFrom-Json
                        $appReady = $ready.token -ceq $token -and [string]$ready.pid -ceq [string]$child.Id -and
                            [string]::Equals($ready.exe, $Executable, [StringComparison]::OrdinalIgnoreCase) -and
                            ($Recovery -or $ready.version -ceq $expectedVersion)
                    } catch { $appReady = $false }
                }
                if ($appReady) { Write-Log ('restart app ready: pid=' + $child.Id + '; elapsedMs=' + $clock.ElapsedMilliseconds); break }
            }
            if ($clock.ElapsedMilliseconds -ge $StartupTimeoutMilliseconds) {
                throw ('restart window was not ready before timeout: pid=' + $child.Id + '; hwnd=' + $windowHandle + '; responding=' + $child.Responding + '; appReady=' + $appReady)
            }
            Start-Sleep -Milliseconds 100
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
        foreach ($file in @($request, $reply)) {
            if ($file -and [IO.File]::Exists($file)) { Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue }
        }
        if ($child -is [IDisposable]) { $child.Dispose() }
    }
}
