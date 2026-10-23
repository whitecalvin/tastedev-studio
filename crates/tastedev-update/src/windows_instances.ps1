# Each instance explicitly consents in its own app UI before any instance is
# asked to use its normal exit route. No process termination/WM_CLOSE broadcast.
function Request-ExitConsent {
    param([ValidateRange(1,600)][int]$TimeoutSeconds = 600)
    $path = $progressState + '.close-request.json'
    $token = [guid]::NewGuid().ToString('N')
    $deadline = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + $TimeoutSeconds
    $targets = @{}
    Write-Log 'requesting in-app save/work confirmation from every instance'
    while ($true) {
        $instances = @(Get-AppInstances)
        $allReady = $true
        $targets = @{}
        foreach ($instance in $instances) {
            if (-not $instance.PathVerified) { $allReady = $false; continue }
            try {
                $process = Get-Process -Id $instance.Id -ErrorAction Stop
                $start = $process.StartTime.ToUniversalTime().Ticks.ToString()
            } catch { $allReady = $false; continue }
            $targets[$instance.Id.ToString()] = $start
            $ack = $path + '.' + $instance.Id + '.ack'
            if (-not [IO.File]::Exists($ack) -or [IO.File]::ReadAllText($ack) -cne ($token + ':' + $start)) { $allReady = $false }
        }
        if ([IO.File]::Exists($path + '.cancel') -and [IO.File]::ReadAllText($path + '.cancel').StartsWith($token + ':')) {
            throw 'update restart cancelled; existing instances and work were kept'
        }
        if ([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() -ge $deadline) { throw 'update consent timed out; no forced closure' }
        $state = @{token=$token; expires=$deadline; exe=$app; version=$updateVersion; targets=$targets; commit=$allReady}
        $temp = $path + '.new'
        [IO.File]::WriteAllText($temp, ($state | ConvertTo-Json -Depth 5 -Compress), [Text.UTF8Encoding]::new($false))
        if ([IO.File]::Exists($path)) { [IO.File]::Replace($temp, $path, [NullString]::Value) }
        else { [IO.File]::Move($temp, $path) }
        if ($allReady) { Write-Log 'all instances consented; normal app exit requested'; return }
        Start-Sleep -Milliseconds 250
    }
}

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
        if ($progressState -and [IO.File]::Exists($progressState + '.close-request.json.cancel')) {
            $request = Get-Content -LiteralPath ($progressState + '.close-request.json') -Raw | ConvertFrom-Json
            if ([IO.File]::ReadAllText($progressState + '.close-request.json.cancel').StartsWith($request.token + ':')) { throw 'update restart cancelled; work preserved' }
        }
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
