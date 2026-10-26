param([Parameter(Mandatory)][string]$StatePath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
# Translation rows: waiting | installing | restarting | complete | failed | guidance | close.
$translations = @{
    en=@('Waiting for app windows to close','Installing update','Restarting the app','Update complete','Update needs attention','Save or finish any work in this instance before continuing. Later keeps your app and work open. No process will be forcibly terminated.','Close status window')
    ko=@('앱 창이 종료되기를 기다리는 중','업데이트 설치 중','앱을 다시 시작하는 중','업데이트 완료','업데이트 확인 필요','이 인스턴스의 미저장 내용과 진행 중인 작업이 있다면 저장하거나 마친 뒤 종료를 승인하세요. ''나중에''는 현재 앱과 작업을 유지합니다. 강제로 종료하지 않습니다.','상태 창 닫기')
    ja=@('アプリの終了を待っています','更新をインストール中','アプリを再起動中','更新完了','更新の確認が必要です','このウィンドウの作業を保存または完了してから終了を承認してください。「後で」はアプリと作業を維持します。強制終了しません。','状態ウィンドウを閉じる')
    zh=@('等待应用窗口关闭','正在安装更新','正在重新启动应用','更新完成','更新需要处理','请先保存或完成此实例中的工作，再同意关闭。选择稍后将保留当前应用和工作，不会强制终止。','关闭状态窗口')
    'zh-hant'=@('等待應用程式視窗關閉','正在安裝更新','正在重新啟動應用程式','更新完成','更新需要處理','請先儲存或完成此執行個體中的工作，再同意關閉。選擇稍後將保留目前應用程式和工作，不會強制終止。','關閉狀態視窗')
    de=@('Warten auf das Schließen der App','Update wird installiert','App wird neu gestartet','Update abgeschlossen','Update erfordert Aufmerksamkeit','Speichern oder beenden Sie Ihre Arbeit vor der Zustimmung. Später lässt App und Arbeit geöffnet. Kein Prozess wird erzwungen beendet.','Statusfenster schließen')
    es=@('Esperando el cierre de la aplicación','Instalando actualización','Reiniciando la aplicación','Actualización completada','La actualización requiere atención','Guarde o termine el trabajo antes de aceptar. Más tarde mantiene la aplicación y el trabajo abiertos. No se fuerza el cierre.','Cerrar ventana de estado')
fr=@('En attente de la fermeture de l''application','Installation de la mise à jour','Redémarrage de l''application','Mise à jour terminée','La mise à jour nécessite votre attention','Enregistrez ou terminez votre travail avant de confirmer. Plus tard garde l''application et le travail ouverts. Aucun arrêt forcé.','Fermer la fenêtre d''état')
    it=@('In attesa della chiusura dell''app','Installazione aggiornamento','Riavvio dell''app','Aggiornamento completato','L''aggiornamento richiede attenzione','Salva o termina il lavoro prima di confermare. Più tardi mantiene aperti app e lavoro. Nessuna chiusura forzata.','Chiudi finestra di stato')
    pt=@('Aguardando o fechamento do aplicativo','Instalando atualização','Reiniciando o aplicativo','Atualização concluída','A atualização requer atenção','Salve ou conclua o trabalho antes de confirmar. Mais tarde mantém o aplicativo e o trabalho abertos. Nenhum processo será encerrado à força.','Fechar janela de status')
    ru=@('Ожидание закрытия окон приложения','Установка обновления','Перезапуск приложения','Обновление завершено','Обновление требует внимания','Сохраните или завершите работу перед подтверждением. Позже сохраняет приложение открытым. Принудительного завершения не будет.','Закрыть окно состояния')
    nl=@('Wachten tot de appvensters sluiten','Update installeren','App opnieuw starten','Update voltooid','Update vereist aandacht','Sla werk op of rond het af voordat u bevestigt. Later houdt de app en het werk open. Geen geforceerde beëindiging.','Statusvenster sluiten')
    pl=@('Oczekiwanie na zamknięcie okien aplikacji','Instalowanie aktualizacji','Ponowne uruchamianie aplikacji','Aktualizacja zakończona','Aktualizacja wymaga uwagi','Zapisz lub zakończ pracę przed potwierdzeniem. Później pozostawia aplikację i pracę otwarte. Bez wymuszonego zamykania.','Zamknij okno stanu')
    uk=@('Очікування закриття вікон програми','Встановлення оновлення','Перезапуск програми','Оновлення завершено','Оновлення потребує уваги','Збережіть або завершіть роботу перед підтвердженням. Пізніше залишає програму та роботу відкритими. Примусового завершення не буде.','Закрити вікно стану')
    tr=@('Uygulama pencerelerinin kapanması bekleniyor','Güncelleme yükleniyor','Uygulama yeniden başlatılıyor','Güncelleme tamamlandı','Güncelleme ilgilenmenizi gerektiriyor','Onaylamadan önce işi kaydedin veya bitirin. Daha sonra uygulamayı ve işi açık tutar. Zorla sonlandırılmaz.','Durum penceresini kapat')
    cs=@('Čekání na zavření oken aplikace','Instalace aktualizace','Opětovné spuštění aplikace','Aktualizace dokončena','Aktualizace vyžaduje pozornost','Před potvrzením práci uložte nebo dokončete. Později ponechá aplikaci i práci otevřené. Žádné vynucené ukončení.','Zavřít stavové okno')
    sv=@('Väntar på att appfönstren stängs','Installerar uppdatering','Startar om appen','Uppdateringen är klar','Uppdateringen kräver åtgärd','Spara eller avsluta arbetet innan du bekräftar. Senare håller appen och arbetet öppna. Ingen tvångsavslutning.','Stäng statusfönstret')
    da=@('Venter på at appens vinduer lukkes','Installerer opdatering','Genstarter appen','Opdatering fuldført','Opdateringen kræver handling','Gem eller afslut arbejdet før bekræftelse. Senere holder appen og arbejdet åbne. Ingen tvungen lukning.','Luk statusvindue')
    nb=@('Venter på at appvinduene lukkes','Installerer oppdatering','Starter appen på nytt','Oppdatering fullført','Oppdateringen krever handling','Lagre eller fullfør arbeidet før bekreftelse. Senere holder appen og arbeidet åpne. Ingen tvangsavslutning.','Lukk statusvindu')
    fi=@('Odotetaan sovelluksen ikkunoiden sulkemista','Asennetaan päivitystä','Käynnistetään sovellusta uudelleen','Päivitys valmis','Päivitys vaatii huomiota','Tallenna tai viimeistele työ ennen vahvistusta. Myöhemmin pitää sovelluksen ja työn auki. Ei pakotettua sulkemista.','Sulje tilaikkuna')
    hu=@('Várakozás az alkalmazás ablakainak bezárására','Frissítés telepítése','Alkalmazás újraindítása','Frissítés kész','A frissítés figyelmet igényel','Jóváhagyás előtt mentse vagy fejezze be a munkát. A Később nyitva hagyja az alkalmazást és a munkát. Nincs kényszerített bezárás.','Állapotablak bezárása')
    ro=@('Se așteaptă închiderea ferestrelor aplicației','Se instalează actualizarea','Se repornește aplicația','Actualizare finalizată','Actualizarea necesită atenție','Salvați sau terminați lucrul înainte de confirmare. Mai târziu păstrează aplicația și lucrul deschise. Fără închidere forțată.','Închide fereastra de stare')
    el=@('Αναμονή για κλείσιμο παραθύρων','Εγκατάσταση ενημέρωσης','Επανεκκίνηση εφαρμογής','Η ενημέρωση ολοκληρώθηκε','Η ενημέρωση απαιτεί προσοχή','Αποθηκεύστε ή ολοκληρώστε την εργασία πριν επιβεβαιώσετε. Αργότερα διατηρεί την εφαρμογή και την εργασία ανοιχτές. Χωρίς αναγκαστικό τερματισμό.','Κλείσιμο παραθύρου κατάστασης')
    vi=@('Đang chờ đóng các cửa sổ ứng dụng','Đang cài đặt bản cập nhật','Đang khởi động lại ứng dụng','Cập nhật hoàn tất','Bản cập nhật cần được xử lý','Lưu hoặc hoàn tất công việc trước khi xác nhận. Để sau giữ ứng dụng và công việc đang mở. Không buộc kết thúc.','Đóng cửa sổ trạng thái')
    id=@('Menunggu jendela aplikasi ditutup','Memasang pembaruan','Memulai ulang aplikasi','Pembaruan selesai','Pembaruan memerlukan perhatian','Simpan atau selesaikan pekerjaan sebelum menyetujui. Nanti mempertahankan aplikasi dan pekerjaan tetap terbuka. Tidak ada penghentian paksa.','Tutup jendela status')
}
$restartTranslations = @{
    en=@('Restart now','Later','Installation is complete. Start the updated app now or leave it closed until later.')
    ko=@('지금 재시작','나중에','설치가 완료되었습니다. 업데이트된 앱을 지금 실행하거나 나중에 직접 실행할 수 있습니다.')
    ja=@('今すぐ再起動','後で','インストールが完了しました。更新したアプリを今すぐ起動するか、後で起動できます。')
    zh=@('立即重启','稍后','安装已完成。现在启动更新后的应用，或稍后手动启动。')
    'zh-hant'=@('立即重新啟動','稍後','安裝已完成。現在啟動更新後的應用程式，或稍後手動啟動。')
    de=@('Jetzt neu starten','Später','Installation abgeschlossen. Starten Sie die aktualisierte App jetzt oder später manuell.')
    es=@('Reiniciar ahora','Más tarde','Instalación completada. Inicie la aplicación actualizada ahora o más tarde manualmente.')
    fr=@('Redémarrer maintenant','Plus tard','Installation terminée. Lancez maintenant l''application mise à jour ou ouvrez-la plus tard.')
    it=@('Riavvia ora','Più tardi','Installazione completata. Avvia ora l''app aggiornata o aprila manualmente più tardi.')
    pt=@('Reiniciar agora','Mais tarde','Instalação concluída. Abra o aplicativo atualizado agora ou manualmente mais tarde.')
    ru=@('Перезапустить сейчас','Позже','Установка завершена. Запустите обновлённое приложение сейчас или позже вручную.')
    nl=@('Nu herstarten','Later','Installatie voltooid. Start de bijgewerkte app nu of open deze later handmatig.')
    pl=@('Uruchom ponownie','Później','Instalacja zakończona. Uruchom zaktualizowaną aplikację teraz lub później ręcznie.')
    uk=@('Перезапустити зараз','Пізніше','Установлення завершено. Запустіть оновлену програму зараз або пізніше вручну.')
    tr=@('Şimdi yeniden başlat','Daha sonra','Kurulum tamamlandı. Güncellenen uygulamayı şimdi veya daha sonra elle açın.')
    cs=@('Restartovat nyní','Později','Instalace dokončena. Spusťte aktualizovanou aplikaci nyní nebo později ručně.')
    sv=@('Starta om nu','Senare','Installationen är klar. Starta den uppdaterade appen nu eller öppna den manuellt senare.')
    da=@('Genstart nu','Senere','Installationen er fuldført. Start den opdaterede app nu eller åbn den manuelt senere.')
    nb=@('Start på nytt nå','Senere','Installasjonen er fullført. Start den oppdaterte appen nå eller åpne den manuelt senere.')
    fi=@('Käynnistä nyt','Myöhemmin','Asennus on valmis. Käynnistä päivitetty sovellus nyt tai avaa se myöhemmin itse.')
    hu=@('Újraindítás most','Később','A telepítés kész. Indítsa el a frissített alkalmazást most, vagy nyissa meg később kézzel.')
    ro=@('Repornește acum','Mai târziu','Instalarea s-a încheiat. Porniți aplicația actualizată acum sau deschideți-o manual mai târziu.')
    el=@('Επανεκκίνηση τώρα','Αργότερα','Η εγκατάσταση ολοκληρώθηκε. Ανοίξτε την ενημερωμένη εφαρμογή τώρα ή χειροκίνητα αργότερα.')
    vi=@('Khởi động lại ngay','Để sau','Đã cài đặt xong. Mở ứng dụng đã cập nhật ngay hoặc mở thủ công sau.')
    id=@('Mulai ulang sekarang','Nanti','Pemasangan selesai. Buka aplikasi yang diperbarui sekarang atau secara manual nanti.')
}
# Skin::light/dark roles: surface, text, muted, inset, divider, accent, danger.
$palettes = @{
    light=@('#FFFFFF','#1D2330','#5B6475','#F6F7F9','#C3C8D2','#2563B0','#B8372A')
    dark=@('#2B2D30','#DFE1E5','#A2A5AD','#1E1F22','#474A4F','#1F63A8','#F0707A')
}
[xml]$xaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" Title="TASTEDEV Update" Width="520" MinWidth="320" SizeToContent="Height" WindowStartupLocation="CenterScreen" ResizeMode="CanMinimize" FontFamily="Segoe UI" FontSize="13" ShowActivated="False">
 <Border Padding="20"><StackPanel>
  <TextBlock Name="Brand" FontWeight="SemiBold" FontSize="16" TextWrapping="Wrap" Margin="0,0,0,16"/>
  <TextBlock Name="Phase" FontWeight="SemiBold" FontSize="14" TextWrapping="Wrap" Margin="0,0,0,12"/>
  <ProgressBar Name="Bar" Height="6" IsIndeterminate="True" Margin="0,0,0,12"/>
  <TextBlock Name="Guidance" TextWrapping="Wrap" Margin="0,0,0,12"/>
  <TextBox Name="Detail" IsReadOnly="True" TextWrapping="Wrap" BorderThickness="0" Padding="10" MaxHeight="120" VerticalScrollBarVisibility="Auto" Visibility="Collapsed"/>
  <TextBlock Name="Elapsed" Margin="0,12,0,12"/>
  <StackPanel Orientation="Horizontal" HorizontalAlignment="Right">
   <Button Name="RestartNow" MinHeight="34" Padding="12,4" Margin="0,0,8,0" Visibility="Collapsed" Cursor="Arrow"/>
   <Button Name="CloseStatus" MinHeight="34" Padding="12,4" Cursor="Arrow"/>
  </StackPanel>
 </StackPanel></Border>
</Window>
'@
$window = [Windows.Markup.XamlReader]::Load([Xml.XmlNodeReader]::new($xaml))
$brand = $window.FindName('Brand'); $phaseLabel = $window.FindName('Phase')
$bar = $window.FindName('Bar'); $guidance = $window.FindName('Guidance')
$detail = $window.FindName('Detail'); $elapsed = $window.FindName('Elapsed'); $close = $window.FindName('CloseStatus')
$restart = $window.FindName('RestartNow')
function Send-RestartChoice([string]$Choice) {
    # Atomic create: first click wins. Closing the window means Later.
    $path = $StatePath + '.choice'
    try {
        $file = [IO.File]::Open($path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
        $writer = [IO.StreamWriter]::new($file, [Text.UTF8Encoding]::new($false))
        try { $writer.Write($Choice) } finally { $writer.Dispose() }
        $restart.IsEnabled=$false; $close.IsEnabled=$false
    } catch { if (-not [IO.File]::Exists($path)) { throw } }
}
$restart.Add_Click({ Send-RestartChoice 'now' })
$close.Add_Click({
    if ($script:lastState -and $script:lastState.phase -eq 'awaiting_restart') { Send-RestartChoice 'later' }
    $window.Close()
})
$watch = [Diagnostics.Stopwatch]::StartNew()
$script:lastState = $null
$timer = [Windows.Threading.DispatcherTimer]::new()
$viewerLease = [IO.File]::Open((Join-Path (Split-Path -Parent $StatePath) '.update-progress.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::ReadWrite)
$viewerLease.Lock(0,1)
$timer.Interval = [TimeSpan]::FromMilliseconds(250)
$updateView = {
    try {
        if (Test-Path -LiteralPath $StatePath) {
            $stream = [IO.File]::Open($StatePath, [IO.FileMode]::Open, [IO.FileAccess]::Read, ([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
            $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::UTF8)
            try { $script:lastState = $reader.ReadToEnd() | ConvertFrom-Json }
            finally { $reader.Dispose() }
        }
        $s = $script:lastState
        if (-not $s) { return }
        $words = $translations[$s.language]
        if (-not $words) { $words = $translations.en }
        $dark = $false
        try { $dark = (Get-ItemPropertyValue 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Themes/Personalize' AppsUseLightTheme) -eq 0 } catch { }
        $colors = if ($dark) { $palettes.dark } else { $palettes.light }
        $window.Background=$colors[0]; $window.Foreground=$colors[1]
        $guidance.Foreground=$colors[2]; $elapsed.Foreground=$colors[2]
        $detail.Background=$colors[3]; $detail.Foreground=$colors[1]
        $close.Background=$colors[3]; $close.Foreground=$colors[1]; $close.BorderBrush=$colors[4]
        $bar.Foreground=$colors[5]; $bar.Background=$colors[3]
        $brand.Text=$s.product + '  ' + $s.version
        $window.Title=$s.product + ' Update'
        $phase = $s.phase
        if ($phase -notin @('complete','failed')) {
            $owner = $null
            try { $owner = Get-Process -Id $s.owner -ErrorAction Stop } catch { }
            if (-not $owner -or $owner.StartTime.ToUniversalTime().Ticks.ToString() -ne $s.ownerStart) {
                $phase = 'failed'
                $s.detail = 'The update helper stopped. See update-log.txt.'
            }
        }
        $index = switch($phase) { 'waiting' {0} 'installing' {1} 'restarting' {2} 'complete' {3} 'awaiting_restart' {3} default {4} }
        $phaseLabel.Text=$words[$index]
        $phaseLabel.Foreground=if($phase -eq 'failed'){$colors[6]}else{$colors[1]}
        $guidance.Text=if($phase -eq 'waiting'){$words[5]}else{''}
        $close.Content=$words[6]
        $choiceWords = $restartTranslations[$s.language]
        if (-not $choiceWords) { $choiceWords = $restartTranslations.en }
        $restart.Content=$choiceWords[0]
        $restart.Visibility=if($phase -eq 'awaiting_restart'){'Visible'}else{'Collapsed'}
        $restart.Background=$colors[5]; $restart.Foreground='#FFFFFF'
        if ($phase -eq 'awaiting_restart') {
            $close.Content=$choiceWords[1]
            $guidance.Text=$choiceWords[2]
        }
        $detail.Text=$s.detail
        $detail.Visibility=if($s.detail){'Visible'}else{'Collapsed'}
        $bar.IsIndeterminate=$phase -notin @('complete','failed','awaiting_restart')
        $bar.Value=if($phase -in @('complete','awaiting_restart')){100}else{0}
        $elapsed.Text=$watch.Elapsed.ToString('hh\:mm\:ss')
        if ($phase -eq 'complete') {
            $timer.Stop()
            $window.Close()
        }
    } catch {
        # Never silently leave a stale Waiting screen. Retry on the next tick,
        # but surface the concrete state-read/render failure and retain evidence.
        $problem=$_.Exception.Message
        $failureWords=if($script:lastState){$translations[$script:lastState.language]}else{$null}
        $phaseLabel.Text=if($failureWords){$failureWords[4]}else{$translations.en[4]}
        $bar.IsIndeterminate=$false
        $detail.Text=$problem; $detail.Visibility='Visible'
        try { Add-Content -LiteralPath ($StatePath + '.viewer-log.txt') -Value ((Get-Date -Format o) + ' ' + $problem) -Encoding UTF8 } catch { }
    }
}
$timer.Add_Tick($updateView)
$window.Add_Loaded({
    & $updateView
    [IO.File]::WriteAllText($StatePath + '.ready', 'ready')
})
$window.Add_Closing({
    if ($script:lastState -and $script:lastState.phase -eq 'awaiting_restart' -and -not [IO.File]::Exists($StatePath + '.choice')) { Send-RestartChoice 'later' }
})
$window.Add_Closed({$timer.Stop(); $viewerLease.Dispose()})
$timer.Start()
$null = $window.ShowDialog()
