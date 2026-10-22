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
    if (@(Get-AppInstances).Count -gt 0) {
        $shell = New-Object -ComObject WScript.Shell
        $message = 'Save your work and finish transfers, compression, and terminal commands. Close ALL windows of this installed application yourself. The update will wait without closing any window. Select OK to wait, or Cancel to postpone.'
        if ([Globalization.CultureInfo]::CurrentUICulture.TwoLetterISOLanguageName -eq 'ko') {
            $message = '작업을 저장하고 전송, 압축, 터미널 명령을 정리한 뒤 이 설치본의 모든 창을 직접 닫아 주세요. 업데이트가 창을 강제로 닫지 않습니다. 확인을 누르면 종료를 기다리며, 취소하면 업데이트를 보류합니다.'
        }
        if ($shell.Popup($message, 600, 'TASTEDEV Update', 49) -ne 1) { throw ($stillMessage + ' (postponed)') }
    }
    $deadline = (Get-Date).AddSeconds(600)
    while (@(Get-AppInstances).Count -gt 0) {
        if ((Get-Date) -gt $deadline) { throw $stillMessage }
        Start-Sleep -Milliseconds 500
    }
}
