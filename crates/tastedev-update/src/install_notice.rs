//! In-app, conditional guidance; never asserts that a task or connection exists.

/// Prepared payload and per-instance cooperative close confirmation.
pub(crate) fn ready_words(language: &str) -> [&'static str; 5] {
    match language {
        "en" => [
            "Update ready",
            "Restart now",
            "Update: check work before closing",
            "Work finished — close",
            "Save or finish any work in this instance before continuing. Later keeps your app and work open. No process will be forcibly terminated.",
        ],
        "ko" => [
            "업데이트 준비 완료",
            "지금 재시작",
            "업데이트 전 작업 확인",
            "작업 완료 후 종료",
            "이 인스턴스의 미저장 내용과 진행 중인 작업이 있다면 저장하거나 마친 뒤 종료를 승인하세요. ‘나중에’는 현재 앱과 작업을 유지합니다. 강제로 종료하지 않습니다.",
        ],
        "ja" => [
            "更新の準備ができました",
            "今すぐ再起動",
            "終了前に作業を確認",
            "作業完了後に終了",
            "このウィンドウの作業を保存または完了してから終了を承認してください。「後で」はアプリと作業を維持します。強制終了しません。",
        ],
        "zh" => [
            "更新已准备就绪",
            "立即重启",
            "关闭前检查工作",
            "工作完成后关闭",
            "请先保存或完成此实例中的工作，再同意关闭。选择稍后将保留当前应用和工作，不会强制终止。",
        ],
        "zh-hant" => [
            "更新已準備就緒",
            "立即重新啟動",
            "關閉前確認工作",
            "工作完成後關閉",
            "請先儲存或完成此執行個體中的工作，再同意關閉。選擇稍後將保留目前應用程式和工作，不會強制終止。",
        ],
        "de" => [
            "Update bereit",
            "Jetzt neu starten",
            "Arbeit vor dem Schließen prüfen",
            "Arbeit beendet — schließen",
            "Speichern oder beenden Sie Ihre Arbeit vor der Zustimmung. Später lässt App und Arbeit geöffnet. Kein Prozess wird erzwungen beendet.",
        ],
        "es" => [
            "Actualización preparada",
            "Reiniciar ahora",
            "Revise el trabajo antes de cerrar",
            "Trabajo terminado — cerrar",
            "Guarde o termine el trabajo antes de aceptar. Más tarde mantiene la aplicación y el trabajo abiertos. No se fuerza el cierre.",
        ],
        "fr" => [
            "Mise à jour prête",
            "Redémarrer maintenant",
            "Vérifiez le travail avant de fermer",
            "Travail terminé — fermer",
            "Enregistrez ou terminez votre travail avant de confirmer. Plus tard garde l’application et le travail ouverts. Aucun arrêt forcé.",
        ],
        "it" => [
            "Aggiornamento pronto",
            "Riavvia ora",
            "Controlla il lavoro prima di chiudere",
            "Lavoro finito — chiudi",
            "Salva o termina il lavoro prima di confermare. Più tardi mantiene aperti app e lavoro. Nessuna chiusura forzata.",
        ],
        "pt" => [
            "Atualização pronta",
            "Reiniciar agora",
            "Confira o trabalho antes de fechar",
            "Trabalho concluído — fechar",
            "Salve ou conclua o trabalho antes de confirmar. Mais tarde mantém o aplicativo e o trabalho abertos. Nenhum processo será encerrado à força.",
        ],
        "ru" => [
            "Обновление готово",
            "Перезапустить сейчас",
            "Проверьте работу перед закрытием",
            "Работа завершена — закрыть",
            "Сохраните или завершите работу перед подтверждением. Позже сохраняет приложение открытым. Принудительного завершения не будет.",
        ],
        "nl" => [
            "Update gereed",
            "Nu herstarten",
            "Controleer werk vóór sluiten",
            "Werk voltooid — sluiten",
            "Sla werk op of rond het af voordat u bevestigt. Later houdt de app en het werk open. Geen geforceerde beëindiging.",
        ],
        "pl" => [
            "Aktualizacja gotowa",
            "Uruchom ponownie",
            "Sprawdź pracę przed zamknięciem",
            "Praca zakończona — zamknij",
            "Zapisz lub zakończ pracę przed potwierdzeniem. Później pozostawia aplikację i pracę otwarte. Bez wymuszonego zamykania.",
        ],
        "uk" => [
            "Оновлення готове",
            "Перезапустити зараз",
            "Перевірте роботу перед закриттям",
            "Роботу завершено — закрити",
            "Збережіть або завершіть роботу перед підтвердженням. Пізніше залишає програму та роботу відкритими. Примусового завершення не буде.",
        ],
        "tr" => [
            "Güncelleme hazır",
            "Şimdi yeniden başlat",
            "Kapatmadan önce işi kontrol edin",
            "İş tamamlandı — kapat",
            "Onaylamadan önce işi kaydedin veya bitirin. Daha sonra uygulamayı ve işi açık tutar. Zorla sonlandırılmaz.",
        ],
        "cs" => [
            "Aktualizace připravena",
            "Restartovat nyní",
            "Před zavřením zkontrolujte práci",
            "Práce hotova — zavřít",
            "Před potvrzením práci uložte nebo dokončete. Později ponechá aplikaci i práci otevřené. Žádné vynucené ukončení.",
        ],
        "sv" => [
            "Uppdateringen är redo",
            "Starta om nu",
            "Kontrollera arbetet före stängning",
            "Arbetet klart — stäng",
            "Spara eller avsluta arbetet innan du bekräftar. Senare håller appen och arbetet öppna. Ingen tvångsavslutning.",
        ],
        "da" => [
            "Opdatering klar",
            "Genstart nu",
            "Kontrollér arbejdet før lukning",
            "Arbejdet færdigt — luk",
            "Gem eller afslut arbejdet før bekræftelse. Senere holder appen og arbejdet åbne. Ingen tvungen lukning.",
        ],
        "nb" => [
            "Oppdatering klar",
            "Start på nytt nå",
            "Kontroller arbeidet før lukking",
            "Arbeid ferdig — lukk",
            "Lagre eller fullfør arbeidet før bekreftelse. Senere holder appen og arbeidet åpne. Ingen tvangsavslutning.",
        ],
        "fi" => [
            "Päivitys valmis",
            "Käynnistä nyt",
            "Tarkista työ ennen sulkemista",
            "Työ valmis — sulje",
            "Tallenna tai viimeistele työ ennen vahvistusta. Myöhemmin pitää sovelluksen ja työn auki. Ei pakotettua sulkemista.",
        ],
        "hu" => [
            "Frissítés előkészítve",
            "Újraindítás most",
            "Munka ellenőrzése bezárás előtt",
            "Munka kész — bezárás",
            "Jóváhagyás előtt mentse vagy fejezze be a munkát. A Később nyitva hagyja az alkalmazást és a munkát. Nincs kényszerített bezárás.",
        ],
        "ro" => [
            "Actualizare pregătită",
            "Repornește acum",
            "Verificați lucrul înainte de închidere",
            "Lucru terminat — închide",
            "Salvați sau terminați lucrul înainte de confirmare. Mai târziu păstrează aplicația și lucrul deschise. Fără închidere forțată.",
        ],
        "el" => [
            "Η ενημέρωση είναι έτοιμη",
            "Επανεκκίνηση τώρα",
            "Ελέγξτε την εργασία πριν το κλείσιμο",
            "Η εργασία τελείωσε — κλείσιμο",
            "Αποθηκεύστε ή ολοκληρώστε την εργασία πριν επιβεβαιώσετε. Αργότερα διατηρεί την εφαρμογή και την εργασία ανοιχτές. Χωρίς αναγκαστικό τερματισμό.",
        ],
        "vi" => [
            "Bản cập nhật đã sẵn sàng",
            "Khởi động lại ngay",
            "Kiểm tra công việc trước khi đóng",
            "Đã xong việc — đóng",
            "Lưu hoặc hoàn tất công việc trước khi xác nhận. Để sau giữ ứng dụng và công việc đang mở. Không buộc kết thúc.",
        ],
        "id" => [
            "Pembaruan siap",
            "Mulai ulang sekarang",
            "Periksa pekerjaan sebelum menutup",
            "Pekerjaan selesai — tutup",
            "Simpan atau selesaikan pekerjaan sebelum menyetujui. Nanti mempertahankan aplikasi dan pekerjaan tetap terbuka. Tidak ada penghentian paksa.",
        ],
        _ => ready_words("en"),
    }
}
pub(crate) fn text(language: &str) -> &'static str {
    match language {
        "ko" => {
            "진행 중인 작업이 있다면 저장하거나 마친 뒤 이 앱의 모든 창을 직접 닫아 주세요. 업데이트는 창을 강제로 닫지 않고 종료를 기다립니다. 준비되지 않았다면 ‘나중에’를 선택하세요."
        }
        "ja" => {
            "作業中の場合は保存または完了してから、このアプリのすべてのウィンドウを閉じてください。更新は強制終了せずに待機します。準備ができていなければ「後で」を選択してください。"
        }
        "zh" => {
            "如有正在进行的工作，请先保存或完成，然后手动关闭此应用的所有窗口。更新会等待，不会强制关闭窗口。如未准备好，请选择“稍后”。"
        }
        "zh-hant" => {
            "若有進行中的工作，請先儲存或完成，再手動關閉此應用程式的所有視窗。更新會等待，不會強制關閉視窗。若尚未準備好，請選擇「稍後」。"
        }
        "de" => {
            "Falls Sie gerade arbeiten, speichern oder beenden Sie Ihre Arbeit und schließen Sie alle Fenster dieser App selbst. Das Update wartet, ohne Fenster zwangsweise zu schließen. Wählen Sie später, wenn Sie noch nicht bereit sind."
        }
        "es" => {
            "Si tiene trabajo en curso, guárdelo o termínelo y cierre todas las ventanas de esta aplicación. La actualización espera sin forzar el cierre. Elija Más tarde si no está listo."
        }
        "fr" => {
            "Si vous avez du travail en cours, enregistrez-le ou terminez-le, puis fermez toutes les fenêtres de cette application. La mise à jour attend sans forcer la fermeture. Choisissez Plus tard si nécessaire."
        }
        "it" => {
            "Se hai attività in corso, salvale o completale, poi chiudi tutte le finestre dell’app. L’aggiornamento attende senza forzare la chiusura. Scegli Più tardi se non sei pronto."
        }
        "pt" => {
            "Se houver trabalho em andamento, salve ou conclua e feche todas as janelas deste aplicativo. A atualização aguarda sem forçar o fechamento. Escolha Mais tarde se não estiver pronto."
        }
        "ru" => {
            "Если работа ещё идёт, сохраните или завершите её, затем закройте все окна приложения. Обновление ждёт и не закрывает окна принудительно. Если вы не готовы, выберите «Позже»."
        }
        "nl" => {
            "Als u nog werk hebt, sla het op of rond het af en sluit alle vensters van deze app zelf. De update wacht zonder vensters geforceerd te sluiten. Kies Later als u nog niet klaar bent."
        }
        "pl" => {
            "Jeśli trwa praca, zapisz ją lub zakończ, a następnie zamknij wszystkie okna aplikacji. Aktualizacja czeka bez wymuszania zamknięcia. Jeśli nie jesteś gotowy, wybierz Później."
        }
        "uk" => {
            "Якщо робота ще триває, збережіть або завершіть її, а потім закрийте всі вікна застосунку. Оновлення чекає без примусового закриття. Якщо ви не готові, виберіть «Пізніше»."
        }
        "tr" => {
            "Devam eden işiniz varsa kaydedin veya tamamlayın, ardından bu uygulamanın tüm pencerelerini kapatın. Güncelleme zorla kapatmadan bekler. Hazır değilseniz Daha sonra seçeneğini seçin."
        }
        "cs" => {
            "Pokud máte rozpracovanou práci, uložte ji nebo dokončete a zavřete všechna okna aplikace. Aktualizace čeká bez vynuceného zavření. Pokud nejste připraveni, zvolte Později."
        }
        "sv" => {
            "Om du har pågående arbete, spara eller slutför det och stäng sedan alla appens fönster själv. Uppdateringen väntar utan att tvångsstänga fönster. Välj Senare om du inte är redo."
        }
        "da" => {
            "Hvis du har igangværende arbejde, skal du gemme eller afslutte det og derefter selv lukke alle appens vinduer. Opdateringen venter uden at tvangslukke. Vælg Senere, hvis du ikke er klar."
        }
        "nb" => {
            "Hvis du har arbeid som pågår, lagre eller fullfør det og lukk alle appens vinduer selv. Oppdateringen venter uten å tvangslukke vinduer. Velg Senere hvis du ikke er klar."
        }
        "fi" => {
            "Jos työ on kesken, tallenna tai viimeistele se ja sulje sitten kaikki sovelluksen ikkunat itse. Päivitys odottaa sulkematta ikkunoita väkisin. Valitse Myöhemmin, jos et ole valmis."
        }
        "hu" => {
            "Ha folyamatban lévő munkája van, mentse vagy fejezze be, majd zárja be az alkalmazás összes ablakát. A frissítés megvárja ezt, nem kényszeríti az ablakok bezárását. Ha nem áll készen, válassza a Később lehetőséget."
        }
        "ro" => {
            "Dacă aveți lucru în curs, salvați-l sau terminați-l, apoi închideți toate ferestrele aplicației. Actualizarea așteaptă fără a forța închiderea. Alegeți Mai târziu dacă nu sunteți pregătit."
        }
        "el" => {
            "Αν έχετε εργασία σε εξέλιξη, αποθηκεύστε ή ολοκληρώστε την και κλείστε όλα τα παράθυρα της εφαρμογής. Η ενημέρωση περιμένει χωρίς αναγκαστικό κλείσιμο. Επιλέξτε Αργότερα αν δεν είστε έτοιμοι."
        }
        "vi" => {
            "Nếu đang làm việc, hãy lưu hoặc hoàn tất rồi tự đóng tất cả cửa sổ của ứng dụng. Bản cập nhật sẽ chờ, không buộc đóng cửa sổ. Chọn Để sau nếu chưa sẵn sàng."
        }
        "id" => {
            "Jika ada pekerjaan yang sedang berlangsung, simpan atau selesaikan, lalu tutup sendiri semua jendela aplikasi ini. Pembaruan menunggu tanpa menutup paksa. Pilih Nanti jika belum siap."
        }
        _ => {
            "If you have work in progress, save or finish it, then close all windows of this app yourself. The update waits without forcing windows to close. Choose Later if you are not ready."
        }
    }
}
