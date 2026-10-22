# No termination or close message is sent to an application. Each window stays
# under its user's normal save/transfer/session/exit safeguards.
function Get-AppInstances {
    $name = [IO.Path]::GetFileNameWithoutExtension($app)
    $matches = @()
    foreach ($process in @(Get-Process -Name $name -ErrorAction SilentlyContinue)) {
        try { $path = $process.Path } catch { throw 'cannot verify a running application path' }
        if (-not $path) { throw 'cannot verify a running application path' }
        if ([string]::Equals([IO.Path]::GetFullPath($path), [IO.Path]::GetFullPath($app), [StringComparison]::OrdinalIgnoreCase)) {
            $matches += $process
        }
    }
    return $matches
}
function Wait-AppInstances {
    # Consent and conditional guidance belong to the app's themed update UI.
    # The helper only waits; it never opens a native dialog or closes a window.
    $deadline = (Get-Date).AddSeconds(600)
    while (@(Get-AppInstances).Count -gt 0) {
        if ((Get-Date) -gt $deadline) { throw $stillMessage }
        Start-Sleep -Milliseconds 500
    }
}
