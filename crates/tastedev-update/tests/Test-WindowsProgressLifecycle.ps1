param([Parameter(Mandatory)][string]$WorkRoot)
$ErrorActionPreference='Stop'
$original=[IO.File]::ReadAllText((Join-Path $PSScriptRoot '../src/windows_progress_view.ps1'))
$source=$original.Substring($original.IndexOf("`n")+1).Replace('$timer.Start()','').Replace('$null = $window.ShowDialog()','')
foreach($case in @('now','later','close','complete')) {
    $dir=Join-Path $WorkRoot $case
    $null=New-Item -ItemType Directory -Path $dir -Force
    $StatePath=Join-Path $dir 'progress.json'
    . ([scriptblock]::Create($source))
    $script:closed=$false
    $window.Add_Closed({$script:closed=$true})
    $s=@{phase='awaiting_restart';product='TEST';version='1.2.3';language='ko';detail='';owner=$PID;ownerStart=(Get-Process -Id $PID).StartTime.ToUniversalTime().Ticks.ToString()}
    [IO.File]::WriteAllText($StatePath,($s|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
    & $updateView
    if($case -eq 'now') {
        $restart.RaiseEvent([Windows.RoutedEventArgs]::new([Windows.Controls.Primitives.ButtonBase]::ClickEvent))
    } elseif($case -eq 'later') {
        $close.RaiseEvent([Windows.RoutedEventArgs]::new([Windows.Controls.Primitives.ButtonBase]::ClickEvent))
    } elseif($case -eq 'close') { $window.Close() }
    else {
        # Read/render failure must not silently preserve Waiting, and a later
        # valid terminal snapshot must recover and close the status window.
        [IO.File]::WriteAllText($StatePath,'{bad json')
        & $updateView
        if($detail.Visibility -ne 'Visible' -or $bar.IsIndeterminate -or $phaseLabel.Text -ne $translations.ko[4]) {throw 'stale view after state failure'}
        if(-not [IO.File]::Exists($StatePath+'.viewer-log.txt')){throw 'read failure not logged'}
        $s.phase='complete'
        [IO.File]::WriteAllText($StatePath,($s|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
        & $updateView
        if($phaseLabel.Text -ne $translations.ko[3]){throw 'terminal state did not recover'}
        if(-not $script:closed -or $timer.IsEnabled){throw 'completed status window did not close immediately'}
    }
    if($case -ne 'complete') {
        $expected=if($case -eq 'now'){'now'}else{'later'}
        if([IO.File]::ReadAllText($StatePath+'.choice') -cne $expected){throw "wrong decision: $case"}
    }
    if(-not $script:closed){$window.Close()}
    Write-Output "PASS WPF lifecycle $case"
}
