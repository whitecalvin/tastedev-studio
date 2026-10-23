param([Parameter(Mandatory)][string]$StatePath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
# Translation rows: waiting | installing | restarting | complete | failed | guidance | close.
$translations = @{
    en=@('Waiting for app windows to close','Installing update','Restarting the app','Update complete','Update needs attention','If you have work in progress, save or finish it, then close all windows of this app. No windows will be closed automatically.','Close status window')
    ko=@('앱 창이 종료되기를 기다리는 중','업데이트 설치 중','앱을 다시 시작하는 중','업데이트 완료','업데이트 확인 필요','진행 중인 작업이 있다면 저장하거나 마친 뒤 이 앱의 모든 창을 직접 닫아 주세요. 창을 강제로 닫지 않습니다.','상태 창 닫기')
    ja=@('アプリの終了を待っています','更新をインストール中','アプリを再起動中','更新完了','更新の確認が必要です','作業中の場合は保存または完了し、このアプリのすべてのウィンドウを閉じてください。強制的には閉じません。','状態ウィンドウを閉じる')
    zh=@('等待应用窗口关闭','正在安装更新','正在重新启动应用','更新完成','更新需要处理','如有正在进行的工作，请保存或完成后关闭此应用的所有窗口。不会强制关闭窗口。','关闭状态窗口')
    'zh-hant'=@('等待應用程式視窗關閉','正在安裝更新','正在重新啟動應用程式','更新完成','更新需要處理','如有進行中的工作，請儲存或完成後關閉此應用程式的所有視窗。不會強制關閉視窗。','關閉狀態視窗')
    de=@('Warten auf das Schließen der App','Update wird installiert','App wird neu gestartet','Update abgeschlossen','Update erfordert Aufmerksamkeit','Speichern oder beenden Sie laufende Arbeiten und schließen Sie alle Fenster dieser App. Kein Fenster wird erzwungen geschlossen.','Statusfenster schließen')
    es=@('Esperando el cierre de la aplicación','Instalando actualización','Reiniciando la aplicación','Actualización completada','La actualización requiere atención','Guarde o termine el trabajo en curso y cierre todas las ventanas de esta aplicación. No se cerrarán a la fuerza.','Cerrar ventana de estado')
fr=@('En attente de la fermeture de l''application','Installation de la mise à jour','Redémarrage de l''application','Mise à jour terminée','La mise à jour nécessite votre attention','Enregistrez ou terminez le travail en cours, puis fermez toutes les fenêtres de cette application. Aucune fermeture forcée.','Fermer la fenêtre d''état')
    it=@('In attesa della chiusura dell''app','Installazione aggiornamento','Riavvio dell''app','Aggiornamento completato','L''aggiornamento richiede attenzione','Salva o termina il lavoro in corso e chiudi tutte le finestre di questa app. Nessuna finestra verrà chiusa forzatamente.','Chiudi finestra di stato')
    pt=@('Aguardando o fechamento do aplicativo','Instalando atualização','Reiniciando o aplicativo','Atualização concluída','A atualização requer atenção','Salve ou conclua o trabalho em andamento e feche todas as janelas deste aplicativo. Nenhuma janela será fechada à força.','Fechar janela de status')
    ru=@('Ожидание закрытия окон приложения','Установка обновления','Перезапуск приложения','Обновление завершено','Обновление требует внимания','Сохраните или завершите текущую работу и закройте все окна приложения. Принудительного закрытия не будет.','Закрыть окно состояния')
    nl=@('Wachten tot de appvensters sluiten','Update installeren','App opnieuw starten','Update voltooid','Update vereist aandacht','Sla lopend werk op of rond het af en sluit alle vensters van deze app. Er worden geen vensters geforceerd gesloten.','Statusvenster sluiten')
    pl=@('Oczekiwanie na zamknięcie okien aplikacji','Instalowanie aktualizacji','Ponowne uruchamianie aplikacji','Aktualizacja zakończona','Aktualizacja wymaga uwagi','Zapisz lub zakończ pracę i zamknij wszystkie okna tej aplikacji. Żadne okno nie zostanie zamknięte siłą.','Zamknij okno stanu')
    uk=@('Очікування закриття вікон програми','Встановлення оновлення','Перезапуск програми','Оновлення завершено','Оновлення потребує уваги','Збережіть або завершіть роботу та закрийте всі вікна програми. Примусового закриття не буде.','Закрити вікно стану')
    tr=@('Uygulama pencerelerinin kapanması bekleniyor','Güncelleme yükleniyor','Uygulama yeniden başlatılıyor','Güncelleme tamamlandı','Güncelleme ilgilenmenizi gerektiriyor','Devam eden işi kaydedin veya bitirin ve bu uygulamanın tüm pencerelerini kapatın. Pencereler zorla kapatılmaz.','Durum penceresini kapat')
    cs=@('Čekání na zavření oken aplikace','Instalace aktualizace','Opětovné spuštění aplikace','Aktualizace dokončena','Aktualizace vyžaduje pozornost','Uložte nebo dokončete práci a zavřete všechna okna této aplikace. Žádné okno nebude zavřeno násilně.','Zavřít stavové okno')
    sv=@('Väntar på att appfönstren stängs','Installerar uppdatering','Startar om appen','Uppdateringen är klar','Uppdateringen kräver åtgärd','Spara eller avsluta pågående arbete och stäng alla fönster i appen. Inga fönster tvångsstängs.','Stäng statusfönstret')
    da=@('Venter på at appens vinduer lukkes','Installerer opdatering','Genstarter appen','Opdatering fuldført','Opdateringen kræver handling','Gem eller afslut igangværende arbejde, og luk alle vinduer i appen. Ingen vinduer tvangslukkes.','Luk statusvindue')
    nb=@('Venter på at appvinduene lukkes','Installerer oppdatering','Starter appen på nytt','Oppdatering fullført','Oppdateringen krever handling','Lagre eller fullfør pågående arbeid og lukk alle vinduer i appen. Ingen vinduer tvangslukkes.','Lukk statusvindu')
    fi=@('Odotetaan sovelluksen ikkunoiden sulkemista','Asennetaan päivitystä','Käynnistetään sovellusta uudelleen','Päivitys valmis','Päivitys vaatii huomiota','Tallenna tai viimeistele keskeneräinen työ ja sulje sovelluksen kaikki ikkunat. Ikkunoita ei suljeta väkisin.','Sulje tilaikkuna')
    hu=@('Várakozás az alkalmazás ablakainak bezárására','Frissítés telepítése','Alkalmazás újraindítása','Frissítés kész','A frissítés figyelmet igényel','Mentse vagy fejezze be a munkát, majd zárja be az alkalmazás összes ablakát. Nem zárunk be ablakot kényszerítve.','Állapotablak bezárása')
    ro=@('Se așteaptă închiderea ferestrelor aplicației','Se instalează actualizarea','Se repornește aplicația','Actualizare finalizată','Actualizarea necesită atenție','Salvați sau terminați lucrul în curs și închideți toate ferestrele aplicației. Nu vor fi închise forțat.','Închide fereastra de stare')
    el=@('Αναμονή για κλείσιμο παραθύρων','Εγκατάσταση ενημέρωσης','Επανεκκίνηση εφαρμογής','Η ενημέρωση ολοκληρώθηκε','Η ενημέρωση απαιτεί προσοχή','Αποθηκεύστε ή ολοκληρώστε την εργασία και κλείστε όλα τα παράθυρα της εφαρμογής. Δεν θα κλείσουν αναγκαστικά.','Κλείσιμο παραθύρου κατάστασης')
    vi=@('Đang chờ đóng các cửa sổ ứng dụng','Đang cài đặt bản cập nhật','Đang khởi động lại ứng dụng','Cập nhật hoàn tất','Bản cập nhật cần được xử lý','Hãy lưu hoặc hoàn tất công việc rồi đóng mọi cửa sổ của ứng dụng. Không cửa sổ nào bị buộc đóng.','Đóng cửa sổ trạng thái')
    id=@('Menunggu jendela aplikasi ditutup','Memasang pembaruan','Memulai ulang aplikasi','Pembaruan selesai','Pembaruan memerlukan perhatian','Simpan atau selesaikan pekerjaan lalu tutup semua jendela aplikasi ini. Tidak ada jendela yang ditutup paksa.','Tutup jendela status')
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
  <Button Name="CloseStatus" HorizontalAlignment="Right" MinHeight="34" Padding="12,4" Cursor="Arrow"/>
 </StackPanel></Border>
</Window>
'@
$window = [Windows.Markup.XamlReader]::Load([Xml.XmlNodeReader]::new($xaml))
$brand = $window.FindName('Brand'); $phaseLabel = $window.FindName('Phase')
$bar = $window.FindName('Bar'); $guidance = $window.FindName('Guidance')
$detail = $window.FindName('Detail'); $elapsed = $window.FindName('Elapsed'); $close = $window.FindName('CloseStatus')
$close.Add_Click({ $window.Close() })
$watch = [Diagnostics.Stopwatch]::StartNew()
$script:doneAt = $null
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
        $index = switch($phase) { 'waiting' {0} 'installing' {1} 'restarting' {2} 'complete' {3} default {4} }
        $phaseLabel.Text=$words[$index]
        $phaseLabel.Foreground=if($phase -eq 'failed'){$colors[6]}else{$colors[1]}
        $guidance.Text=if($phase -eq 'waiting'){$words[5]}else{''}
        $close.Content=$words[6]
        $detail.Text=$s.detail
        $detail.Visibility=if($s.detail){'Visible'}else{'Collapsed'}
        $bar.IsIndeterminate=$phase -notin @('complete','failed')
        $bar.Value=if($phase -eq 'complete'){100}else{0}
        $elapsed.Text=$watch.Elapsed.ToString('hh\:mm\:ss')
        if ($phase -eq 'complete') {
            if ($null -eq $script:doneAt) { $script:doneAt=$watch.ElapsedMilliseconds }
            if ($watch.ElapsedMilliseconds - $script:doneAt -ge 5000) { $window.Close() }
        }
    } catch { # Partial/unavailable state never replaces the last valid display.
    }
}
$timer.Add_Tick($updateView)
$window.Add_Loaded({
    & $updateView
    [IO.File]::WriteAllText($StatePath + '.ready', 'ready')
})
$window.Add_Closed({$timer.Stop(); $viewerLease.Dispose()})
$timer.Start()
$null = $window.ShowDialog()
