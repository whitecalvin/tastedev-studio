param([Parameter(Mandatory)][string]$WorkRoot)
$ErrorActionPreference = 'Stop'
$null = New-Item -ItemType Directory -Path $WorkRoot -Force
$StatePath = Join-Path $WorkRoot 'preview-state.json'
$source = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '../src/windows_progress_view.ps1'))
$tokens=$null; $errors=$null
$null=[Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors)
if ($errors.Count) { throw ($errors -join "`n") }
# Instantiate actual WPF controls without showing or taking focus from any app.
$source = $source.Substring($source.IndexOf("`n") + 1)
$source = $source.Replace('$timer.Start()', '').Replace('$null = $window.ShowDialog()', '')
$script:closeRequests=0
$source = $source.Replace('$window.Close()', '$script:closeRequests++')
. ([scriptblock]::Create($source))
if ($translations.Count -ne 25) { throw 'locale count changed' }
foreach($row in $translations.Values) { if($row.Count -ne 7 -or @($row | Where-Object { -not $_ }).Count) { throw 'incomplete translations' } }
function Get-ItemPropertyValue { param($Path,$Name) if($script:testDark){0}else{1} }
if ($restartTranslations.Count -ne 25) { throw 'restart locale count changed' }
foreach($row in $restartTranslations.Values) { if($row.Count -ne 3 -or @($row | Where-Object { -not $_ }).Count) { throw 'incomplete restart translations' } }
$states = @('waiting','installing','restarting','complete','failed','awaiting_restart')
$count=0
foreach($locale in $translations.Keys) {
    foreach($dark in @($false,$true)) {
        $script:testDark=$dark
        foreach($phase in $states) {
            $state=@{phase=$phase; detail=if($phase -eq 'failed'){'Test diagnostic: access denied (5)'}else{''}; product='TASTESSH'; version='0.2.34'; language=$locale; owner=$PID; ownerStart=(Get-Process -Id $PID).StartTime.ToUniversalTime().Ticks.ToString()}
            [IO.File]::WriteAllText($StatePath,($state|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
            & $updateView
            $index=if($phase -eq 'awaiting_restart'){3}else{[array]::IndexOf($states,$phase)}
            if($phaseLabel.Text -ne $translations[$locale][$index]) { throw "phase text mismatch: $locale/$phase" }
            if(($phase -in @('waiting','awaiting_restart')) -ne [bool]$guidance.Text) { throw 'conditional guidance missing' }
            if($bar.IsIndeterminate -ne ($phase -notin @('complete','failed','awaiting_restart'))) { throw 'incorrect progress state' }
            if(($phase -eq 'awaiting_restart') -ne ($restart.Visibility -eq 'Visible')) { throw 'restart choice visibility incorrect' }
            foreach($width in @(320,520)) {
                $root=$window.Content
                $root.Background=$window.Background
                $root.Measure([Windows.Size]::new($width,[double]::PositiveInfinity))
                $height=[math]::Ceiling($root.DesiredSize.Height)
                $root.Arrange([Windows.Rect]::new(0,0,$width,$height)); $root.UpdateLayout()
                if($height -gt 600) { throw "unbounded layout: $locale/$phase/$width" }
                if($locale -eq 'ko' -and $width -eq 520) {
                    $bitmap=[Windows.Media.Imaging.RenderTargetBitmap]::new($width,$height,96,96,[Windows.Media.PixelFormats]::Pbgra32)
                    $bitmap.Render($root)
                    $encoder=[Windows.Media.Imaging.PngBitmapEncoder]::new()
                    $encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap))
                    $theme=if($dark){'dark'}else{'light'}
                    $stream=[IO.File]::Create((Join-Path $WorkRoot "$theme-$phase.png"))
                    try{$encoder.Save($stream)}finally{$stream.Dispose()}
                }
                $count++
            }
        }
    }
}
# Run the real DispatcherTimer, not only direct rendering calls. Assert the UI
# observes atomic state replacement and stops displaying Waiting after install.
$script:testDark=$false
$state.language='ko'; $state.phase='waiting'
$state.owner=$PID; $state.ownerStart=(Get-Process -Id $PID).StartTime.ToUniversalTime().Ticks.ToString()
[IO.File]::WriteAllText($StatePath,($state|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
& $updateView
function Pump-Dispatcher {
    $frame=[Windows.Threading.DispatcherFrame]::new()
    $stopTimer=[Windows.Threading.DispatcherTimer]::new()
    $stopTimer.Interval=[TimeSpan]::FromMilliseconds(650)
    $stopTimer.Tag=$frame
    $stopTimer.Add_Tick({param($sender,$eventArgs) $sender.Tag.Continue=$false; $sender.Stop()})
    $stopTimer.Start()
    [Windows.Threading.Dispatcher]::PushFrame($frame)
}
$timer.Start()
foreach($newPhase in @('installing','awaiting_restart','restarting','complete')) {
    $beforeClose=$script:closeRequests
    $state.phase=$newPhase
    $next=$StatePath+'.new'
    [IO.File]::WriteAllText($next,($state|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
    [IO.File]::Replace($next,$StatePath,[NullString]::Value)
    Pump-Dispatcher
    $index=if($newPhase -eq 'awaiting_restart'){3}else{[array]::IndexOf($states,$newPhase)}
    if($phaseLabel.Text -ne $translations.ko[$index] -or $script:lastState.phase -ne $newPhase) { throw "timer left stale UI: $newPhase" }
    if($newPhase -eq 'complete' -and ($script:closeRequests -ne $beforeClose+1 -or $timer.IsEnabled)) { throw 'completion did not close immediately on the first timer tick' }
}
$timer.Stop()
Send-RestartChoice 'now'
Send-RestartChoice 'later'
if([IO.File]::ReadAllText($StatePath+'.choice') -cne 'now') { throw 'duplicate choice overwrote first decision' }
if(Test-Path ($StatePath+'.viewer-log.txt')) { throw ('unexpected viewer errors: '+[IO.File]::ReadAllText($StatePath+'.viewer-log.txt')) }
# The helper disappearing must show an attention state instead of spinning forever.
$state.owner=2147483647; $state.phase='installing'; $state.language='en'
[IO.File]::WriteAllText($StatePath,($state|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
& $updateView
if($phaseLabel.Text -ne $translations.en[4] -or $detail.Text -notmatch 'helper stopped') { throw 'orphaned helper not surfaced' }
$peer=[IO.File]::Open((Join-Path $WorkRoot '.update-progress.lock'),[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::ReadWrite)
$locked=$false
try{$peer.Lock(0,1)}catch{$locked=$true}
if(-not $locked){throw 'live viewer did not protect progress state from cleanup'}
$timer.Stop(); $window.Close()
$peer.Lock(0,1); $peer.Dispose()
Write-Output "PASS WPF controls: $count locale/theme/phase/width cases; real timer/atomic state transitions; first choice wins; owner exit; rendered previews"
