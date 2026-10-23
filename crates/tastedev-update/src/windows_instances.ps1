# No termination or close message is sent to an application. Each window stays
# under its user's normal save/transfer/session/exit safeguards.
function Get-AppInstances {
    $name = [IO.Path]::GetFileNameWithoutExtension($app)
    $matches = @()
    foreach ($process in @(Get-Process -Name $name -ErrorAction SilentlyContinue)) {
        $path = $null
        try { $path = $process.Path } catch { }
        if (-not $path) {
            # Enumeration races with normal app exit. A vanished PID is not an
            # error; an inaccessible LIVE PID must still block installation.
            try {
                $live = Get-Process -Id $process.Id -ErrorAction Stop
                try { if ($live.HasExited) { continue } } catch { }
                try { $path = $live.Path } catch { }
            } catch {
                if ($_.FullyQualifiedErrorId -like 'NoProcessFoundForGivenId*') { continue }
            }
            if (-not $path) {
                $matches += [pscustomobject]@{Id=$process.Id; PathVerified=$false}
                continue
            }
        }
        if ([string]::Equals([IO.Path]::GetFullPath($path), [IO.Path]::GetFullPath($app), [StringComparison]::OrdinalIgnoreCase)) {
            $matches += [pscustomobject]@{Id=$process.Id; PathVerified=$true}
        }
    }
    return $matches
}
function Wait-AppInstances {
    # Consent and conditional guidance belong to the app's themed update UI.
    # The helper only waits; it never opens a native dialog or closes a window.
    $deadline = (Get-Date).AddSeconds(600)
    $lastUnknown = ''
    while ($true) {
        $instances = @(Get-AppInstances)
        if ($instances.Count -eq 0) { break }
        $unknown = @($instances | Where-Object { $_.PathVerified -eq $false })
        $unknownIds = ($unknown | ForEach-Object { $_.Id }) -join ','
        if ($unknownIds -and $unknownIds -ne $lastUnknown) {
            Write-Log ('waiting for inaccessible live application paths: pid=' + $unknownIds)
        }
        $lastUnknown = $unknownIds
        if ((Get-Date) -gt $deadline) {
            if ($unknown.Count) { throw ('cannot verify a running application path: pid=' + $unknownIds) }
            throw $stillMessage
        }
        Start-Sleep -Milliseconds 500
    }
}
