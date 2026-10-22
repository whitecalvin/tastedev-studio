//! In-app, conditional guidance; never asserts that a task or connection exists.
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
