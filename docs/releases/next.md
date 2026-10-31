# 다음 판에서 달라진 것

## 이번 판에서 달라진 것

- 원본 Claude 스킬을 격리 공간에서 실행하고, 변경을 검토·승인한 뒤 Godot 수정 결과를 Agent 테스트로 확인할 수 있습니다. 중단된 원본 세션 재개와 프레임워크 모드 설정을 지원합니다.

- Claude-Code-Game-Studios의 고정 역할·스킬 카탈로그와 게임 엔진별 템플릿 연결을 추가했습니다. 선택한 팀을 노드로 배치하고 원문 프롬프트와 설정 출처를 확인할 수 있습니다.

- 오래 걸린 빌드의 산출물도 승인된 작업·실행 기한 안에서 전달할 수 있습니다.

- 후속 작업·장비 준비 상태·산출물 전달·복구 지점을 함께 확인하고, 놓친 실행과 제한된 재시도 정책 및 TASTEFILES 전달 초안을 설정할 수 있습니다.

- 겹치는 통합 요청의 순서를 관리하고 장비별 실행 정책을 설정할 수 있습니다. 선행 작업 성공 스케줄, 실행 단계·이력 확인, 대기 작업 재배정을 추가했습니다.

- 통합 검토함에서 변경을 검토하고 파일 생성·삭제·이름 변경을 승인해 적용할 수 있습니다. 충돌 해결과 후속 작업의 소스 재검토를 지원합니다.

- 기존 Windows·Linux 배포를 유지하면서 macOS 패키지만 추가하는 출시 명령을 추가했습니다.

- macOS Apple Silicon용 DMG 설치 패키지와 Homebrew 배포 경로를 추가했습니다.


- 첫 실행 시 창을 해당 모니터의 가운데에 배치합니다.
- Windows 업데이트 후 앱 준비가 확인되면 상태 창을 바로 닫도록 고정 대기를 제거했습니다. 여러 창의 미저장 작업 보호는 유지됩니다.


<!-- 출시 도구가 다음 출시 때 아래 목록을 docs/releases/vX.Y.Z.md 의 "## 이번 판에서 달라진 것" 절로 옮기고 이 파일을 비운다.
     한 줄 = 쓰는 사람이 알아챌 변화 하나("- " 로 시작). **굵게** · `코드` 표시는 사이트에서 떼어 낸다.
     내부 호스트 · IP · 경로 · 계획 번호 · chore/docs/test 류는 적지 않는다(적어도 출시 도구가 뺀다). 비어 있으면 절을 넣지 않는다. -->

## What's new [en]

- Run original Claude skills in isolation, review and approve changes, and verify Godot fixes with Agent tests. Resume interrupted native sessions and adjust framework modes.

- Added a pinned Claude-Code-Game-Studios role and skill catalog with game engine template bindings. Place selected teams on the canvas and inspect complete original prompts and configuration sources.

- Outputs from longer builds remain transferable within the approved step and execution deadlines.

- Inspect dependent work, device readiness, artifact delivery and recovery steps, with bounded missed-run/retry policies and TASTEFILES delivery drafts.

- Manage overlapping integrations and device execution policies, trigger schedules after successful dependencies, inspect steps and history, and review queued reassignment.

- Review changes in the integration inbox and approve file creation, deletion and renames, with conflict resolution and Source re-review for dependent work.

- Added a release command to add macOS packages while preserving existing Windows and Linux releases.

- Added DMG packaging and Homebrew distribution for macOS Apple Silicon.


- On first launch, the window is centered on its monitor.
- Removed fixed waits after Windows updates: the status window closes as soon as the app is ready. Protection for unsaved work across multiple windows is preserved.

- Submit tested task changes to the original work and complete it after integration retests, independent review and acceptance.

## What's new [ja]

- 元のClaudeスキルを隔離環境で実行し、変更を確認・承認してからAgentテストでGodotの修正を検証できます。中断したセッションの再開とフレームワークモード設定に対応しました。

- Claude-Code-Game-Studiosの固定された役割・スキルカタログとエンジン別テンプレート連携を追加しました。選択チームのノード配置、元のプロンプト全文、設定の出典を確認できます。

- 長時間のビルドでも、承認されたステップと実行の期限内で成果物を転送できます。

- 後続作業、装置の準備状態、成果物転送、復旧箇所を確認でき、未実行分と再試行の制限付きポリシーやTASTEFILES転送下書きを設定できます。

- 重複する統合と装置の実行ポリシーを管理し、依存先の成功によるスケジュール、ステップと履歴の確認、待機作業の再割り当てに対応しました。

- 統合レビュー一覧で変更を確認し、ファイルの作成・削除・名前変更を承認できます。競合解決と後続作業のソース再確認に対応しました。

- 既存のWindows・Linux配布を維持してmacOSパッケージのみ追加するリリースコマンドを追加しました。

- macOS Apple Silicon 向けの DMG パッケージと Homebrew 配布経路を追加しました。


- 初回起動時にウィンドウを対象モニターの中央に配置します。
- Windows 更新後の固定待機を削除し、アプリの準備完了を確認すると状態ウィンドウをすぐ閉じます。複数ウィンドウの未保存の作業は引き続き保護されます。

- 検証済みの作業変更を元の作業へ提出し、統合後の再テスト・独立レビュー・受け入れ後に完了できます。

## What's new [zh]

- 可在隔离空间运行原始 Claude 技能，审查并批准更改后，通过 Agent 测试验证 Godot 修复。支持恢复中断的原生会话和调整框架模式。

- 新增固定版本的 Claude-Code-Game-Studios 角色与技能目录及游戏引擎模板关联。可放置所选团队节点，并查看完整原始提示词及配置来源。

- 耗时较长的构建也可在已批准的步骤及执行期限内传输产物。

- 可查看后续工作、设备准备状态、产物交付与恢复步骤，并设置受限的错过执行及重试策略和 TASTEFILES 交付草稿。

- 支持管理重叠集成和设备执行策略、依赖成功触发计划、查看步骤和历史，以及审核队列重新分配。

- 在集成审核箱中审核并批准文件创建、删除和重命名，支持冲突解决及后续任务的源码重新审核。

- 新增仅添加macOS软件包的发布命令，保留现有Windows和Linux发布。

- 新增 macOS Apple Silicon 的 DMG 打包和 Homebrew 分发支持。


- 首次启动时，窗口会居中显示在所在显示器上。
- 移除了 Windows 更新后的固定等待；确认应用就绪后立即关闭状态窗口。仍会保护多个窗口中未保存的工作。

- 可向原始工作提交已测试的任务更改，并在集成重测、独立审核和接受后完成原始工作。

## What's new [zh-hant]

- 可在隔離空間執行原始 Claude 技能，審查並核准變更後，透過 Agent 測試驗證 Godot 修正。支援恢復中斷的原生工作階段與調整框架模式。

- 新增固定版本的 Claude-Code-Game-Studios 角色與技能目錄及遊戲引擎範本連結。可放置所選團隊節點，並查看完整原始提示詞與設定來源。

- 耗時較長的建置也可在已核准的步驟及執行期限內傳送產物。

- 可檢視後續工作、裝置準備狀態、產物交付與復原步驟，並設定受限的錯過執行及重試政策和 TASTEFILES 交付草稿。

- 支援管理重疊整合與裝置執行政策、相依成功觸發排程、檢視步驟與歷程，以及審查佇列重新指派。

- 在整合審查匣中審查並核准檔案建立、刪除與重新命名，支援衝突解決及後續工作的原始碼重新審查。

- 新增僅加入macOS套件的發布指令，保留現有Windows與Linux發布。

- 新增 macOS Apple Silicon 的 DMG 打包與 Homebrew 發佈支援。


- 首次啟動時，視窗會置中顯示於所在螢幕。
- 移除了 Windows 更新後的固定等待；確認應用程式就緒後立即關閉狀態視窗。仍會保護多個視窗中未儲存的工作。

- 可向原始工作提交已測試的工作變更，並在整合重測、獨立審查與接受後完成原始工作。

## What's new [de]

- Originale Claude-Skills isoliert ausführen, Änderungen prüfen und genehmigen und Godot-Korrekturen mit Agent-Tests verifizieren. Unterbrochene native Sitzungen fortsetzen und Framework-Modi einstellen.

- Ein versionierter Claude-Code-Game-Studios-Katalog für Rollen und Skills mit Engine-Vorlagen wurde ergänzt. Gewählte Teams lassen sich als Knoten platzieren; vollständige Originalprompts und Konfigurationsquellen sind einsehbar.

- Auch Ergebnisse längerer Builds lassen sich innerhalb der genehmigten Schritt- und Ausführungsfristen übertragen.

- Abhängige Arbeit, Gerätebereitschaft, Artefaktlieferung und Wiederherstellung prüfen sowie begrenzte Nachhol-/Wiederholungsregeln und TASTEFILES-Auslieferungsentwürfe konfigurieren.

- Überlappende Integrationen und Geräterichtlinien verwalten, Zeitpläne nach erfolgreichen Abhängigkeiten auslösen, Schritte und Verlauf prüfen und wartende Arbeit neu zuweisen.

- Änderungen im Integrationspostfach prüfen und Dateierstellung, Löschung und Umbenennung freigeben; mit Konfliktlösung und erneuter Quellprüfung für Folgeaufgaben.

- Neuer Release-Befehl zum Ergänzen von macOS-Paketen unter Beibehaltung vorhandener Windows- und Linux-Veröffentlichungen.

- DMG-Paketierung und Homebrew-Verteilung für macOS Apple Silicon hinzugefügt.


- Beim ersten Start wird das Fenster auf seinem Monitor zentriert.
- Feste Wartezeiten nach Windows-Updates entfallen: Das Statusfenster schließt, sobald die App bereit ist. Ungespeicherte Arbeit in mehreren Fenstern bleibt geschützt.

- Getestete Änderungen beim Originalauftrag einreichen und ihn nach Integrationstests, unabhängiger Prüfung und Annahme abschließen.

## What's new [es]

- Ejecute habilidades originales de Claude en aislamiento, revise y apruebe cambios y verifique correcciones de Godot con pruebas del agente. Reanude sesiones nativas interrumpidas y ajuste los modos del framework.

- Se añadió un catálogo de roles y habilidades de Claude-Code-Game-Studios con versión fija y plantillas por motor. Coloque equipos seleccionados y consulte prompts originales completos y fuentes de configuración.

- Los resultados de compilaciones largas pueden transferirse dentro de los plazos aprobados de etapa y ejecución.

- Consulte trabajo dependiente, preparación de equipos, entrega de artefactos y recuperación, con políticas limitadas de ejecuciones perdidas/reintentos y borradores TASTEFILES.

- Gestione integraciones superpuestas y políticas de equipos, active horarios tras dependencias exitosas, consulte pasos e historial y revise reasignaciones pendientes.

- Revise los cambios en la bandeja de integración y apruebe la creación, eliminación y cambio de nombre de archivos, con resolución de conflictos y revisión de fuentes para tareas dependientes.

- Añadido un comando para agregar paquetes de macOS conservando las versiones publicadas de Windows y Linux.

- Se añadieron paquetes DMG y distribución mediante Homebrew para macOS Apple Silicon.


- Al iniciar por primera vez, la ventana se centra en su monitor.
- Se eliminaron las esperas fijas tras actualizar Windows: la ventana de estado se cierra cuando la aplicación está lista. Se mantiene la protección del trabajo sin guardar en varias ventanas.

- Envíe cambios probados al trabajo original y complételo tras nuevas pruebas, revisión independiente y aceptación.

## What's new [fr]

- Exécutez les compétences Claude d’origine en isolation, examinez et approuvez les changements, puis vérifiez les corrections Godot avec les tests de l’agent. Reprenez les sessions interrompues et réglez les modes du framework.

- Ajout d’un catalogue de rôles et compétences Claude-Code-Game-Studios à version fixe, lié aux modèles de moteurs. Placez les équipes choisies et consultez les prompts complets et les sources de configuration.

- Les résultats des compilations longues restent transférables dans les délais approuvés de l’étape et de l’exécution.

- Consultez les travaux dépendants, la préparation des appareils, la livraison des artefacts et la récupération, avec règles limitées de rattrapage et de nouvelle tentative et brouillons TASTEFILES.

- Gérez les intégrations chevauchantes et les règles des appareils, déclenchez les horaires après une dépendance réussie, consultez les étapes et l’historique et vérifiez les réaffectations en attente.

- Examinez les changements et approuvez les créations, suppressions et renommages, avec résolution des conflits et réexamen des sources des tâches dépendantes.

- Ajout d’une commande de publication pour ajouter les paquets macOS en conservant les versions Windows et Linux existantes.

- Ajout des paquets DMG et de la distribution Homebrew pour macOS Apple Silicon.


- Au premier lancement, la fenêtre est centrée sur son écran.
- Les délais fixes après une mise à jour sous Windows ont été supprimés : la fenêtre d’état se ferme dès que l’application est prête. Le travail non enregistré dans plusieurs fenêtres reste protégé.

- Soumettez les modifications testées au travail original et terminez-le après retests, examen indépendant et acceptation.

## What's new [it]

- Esegui le competenze Claude originali in isolamento, esamina e approva le modifiche e verifica le correzioni Godot con i test dell’agente. Riprendi le sessioni interrotte e regola le modalità del framework.

- Aggiunto un catalogo di ruoli e competenze Claude-Code-Game-Studios a versione fissa con modelli per motore. Posiziona i team scelti e consulta prompt originali completi e fonti della configurazione.

- I risultati delle compilazioni lunghe restano trasferibili entro i limiti approvati di fase ed esecuzione.

- Consulta lavoro dipendente, disponibilità dispositivi, consegna artefatti e ripristino, con regole limitate di recupero/ripetizione e bozze TASTEFILES.

- Gestisci integrazioni sovrapposte e regole dei dispositivi, attiva pianificazioni dopo dipendenze riuscite, consulta passaggi e cronologia e verifica riassegnazioni in coda.

- Verifica le modifiche e approva creazione, eliminazione e rinomina dei file, con risoluzione dei conflitti e nuova verifica delle sorgenti delle attività dipendenti.

- Aggiunto un comando di rilascio per aggiungere pacchetti macOS mantenendo le versioni Windows e Linux esistenti.

- Aggiunti pacchetti DMG e distribuzione tramite Homebrew per macOS Apple Silicon.


- Al primo avvio, la finestra viene centrata sul monitor.
- Eliminate le attese fisse dopo gli aggiornamenti su Windows: la finestra di stato si chiude quando l’app è pronta. Il lavoro non salvato in più finestre resta protetto.

- Invia modifiche testate al lavoro originale e completalo dopo retest, revisione indipendente e accettazione.

## What's new [pt]

- Execute habilidades Claude originais em isolamento, revise e aprove alterações e verifique correções Godot com testes do agente. Retome sessões nativas interrompidas e ajuste os modos do framework.

- Adicionado um catálogo de papéis e habilidades Claude-Code-Game-Studios com versão fixa e modelos por motor. Posicione equipes selecionadas e consulte prompts originais completos e fontes de configuração.

- Resultados de compilações longas podem ser transferidos dentro dos prazos aprovados da etapa e da execução.

- Consulte trabalho dependente, prontidão de dispositivos, entrega de artefatos e recuperação, com políticas limitadas de execuções perdidas/repetições e rascunhos TASTEFILES.

- Gerencie integrações sobrepostas e políticas de dispositivos, dispare agendas após dependências bem-sucedidas, veja etapas e histórico e revise reatribuições na fila.

- Revise alterações e aprove criação, exclusão e renomeação de arquivos, com resolução de conflitos e revisão da fonte para tarefas dependentes.

- Adicionado comando de publicação para incluir pacotes macOS preservando as versões Windows e Linux existentes.

- Adicionados pacotes DMG e distribuição pelo Homebrew para macOS Apple Silicon.


- Na primeira inicialização, a janela é centralizada no seu monitor.
- Removidas as esperas fixas após atualizações no Windows: a janela de estado fecha assim que o aplicativo está pronto. O trabalho não salvo em várias janelas continua protegido.

- Envie alterações testadas ao trabalho original e conclua após retestes, revisão independente e aceitação.

## What's new [ru]

- Запускайте исходные навыки Claude изолированно, проверяйте и одобряйте изменения, а затем подтверждайте исправления Godot тестами агента. Доступны возобновление прерванных сессий и настройка режимов фреймворка.

- Добавлен каталог ролей и навыков Claude-Code-Game-Studios с фиксированной версией и шаблонами игровых движков. Можно размещать выбранные команды и просматривать полные исходные инструкции и источники настроек.

- Результаты длительных сборок можно передавать в пределах утверждённых сроков этапа и выполнения.

- Просматривайте зависимые задачи, готовность устройств, передачу артефактов и восстановление; настраивайте ограниченные повторы, пропущенные запуски и черновики передачи TASTEFILES.

- Управляйте пересекающимися интеграциями и политиками устройств, запускайте расписания после успешных зависимостей, просматривайте этапы и историю и проверяйте переназначение очереди.

- Проверяйте изменения и утверждайте создание, удаление и переименование файлов; доступны разрешение конфликтов и повторная проверка исходников зависимых задач.

- Добавлена команда выпуска пакетов macOS с сохранением существующих выпусков Windows и Linux.

- Добавлены пакеты DMG и распространение через Homebrew для macOS Apple Silicon.


- При первом запуске окно размещается по центру своего монитора.
- Убраны фиксированные задержки после обновления в Windows: окно состояния закрывается, как только приложение готово. Несохранённая работа в нескольких окнах по-прежнему защищена.

- Проверенные изменения можно отправить в исходную задачу и завершить её после повторных тестов, независимой проверки и принятия.

## What's new [nl]

- Voer originele Claude-skills geïsoleerd uit, beoordeel en keur wijzigingen goed en verifieer Godot-oplossingen met Agent-tests. Hervat onderbroken sessies en stel frameworkmodi in.

- Een vastgelegde Claude-Code-Game-Studios-catalogus met rollen, vaardigheden en enginesjablonen is toegevoegd. Plaats geselecteerde teams en bekijk volledige originele prompts en configuratiebronnen.

- Resultaten van langere builds blijven overdraagbaar binnen de goedgekeurde stap- en uitvoeringstermijnen.

- Bekijk afhankelijk werk, apparaatgereedheid, artefactlevering en herstelstappen, met begrensde regels voor gemiste uitvoeringen/herhalingen en TASTEFILES-leveringsconcepten.

- Beheer overlappende integraties en apparaatbeleid, start schema’s na geslaagde afhankelijkheden, bekijk stappen en geschiedenis en beoordeel nieuwe toewijzingen in de wachtrij.

- Bekijk integratiewijzigingen en keur aanmaken, verwijderen en hernoemen goed, met conflictoplossing en herbeoordeling van broncode voor vervolgwerk.

- Een releaseopdracht toegevoegd om macOS-pakketten toe te voegen met behoud van bestaande Windows- en Linux-releases.

- DMG-pakketten en Homebrew-distributie voor macOS Apple Silicon toegevoegd.


- Bij de eerste start wordt het venster op het bijbehorende scherm gecentreerd.
- Vaste wachttijden na Windows-updates zijn verwijderd: het statusvenster sluit zodra de app gereed is. Niet-opgeslagen werk in meerdere vensters blijft beschermd.

- Dien geteste wijzigingen in bij het oorspronkelijke werk en rond het af na hertests, onafhankelijke beoordeling en acceptatie.

## What's new [pl]

- Uruchamiaj oryginalne umiejętności Claude w izolacji, przeglądaj i zatwierdzaj zmiany oraz weryfikuj poprawki Godot testami agenta. Wznawiaj przerwane sesje i ustawiaj tryby frameworka.

- Dodano katalog ról i umiejętności Claude-Code-Game-Studios z przypiętą wersją i szablonami silników. Rozmieść wybrane zespoły i przeglądaj pełne oryginalne instrukcje oraz źródła konfiguracji.

- Wyniki dłuższych kompilacji można przesyłać w zatwierdzonych terminach etapu i wykonania.

- Przeglądaj zadania zależne, gotowość urządzeń, przekazywanie artefaktów i odzyskiwanie oraz ustawiaj ograniczone ponowienia i szkice dostarczania TASTEFILES.

- Zarządzaj nakładającymi się integracjami i zasadami urządzeń, uruchamiaj harmonogramy po udanych zależnościach, przeglądaj kroki i historię oraz zatwierdzaj zmiany przydziałów w kolejce.

- Przeglądaj zmiany i zatwierdzaj tworzenie, usuwanie oraz zmianę nazw plików, z rozwiązywaniem konfliktów i ponownym przeglądem źródeł zależnych zadań.

- Dodano polecenie wydania pakietów macOS z zachowaniem istniejących wydań Windows i Linux.

- Dodano pakiety DMG i dystrybucję przez Homebrew dla macOS Apple Silicon.


- Przy pierwszym uruchomieniu okno jest wyśrodkowane na swoim monitorze.
- Usunięto stałe opóźnienia po aktualizacji w Windows: okno stanu zamyka się, gdy aplikacja jest gotowa. Niezapisana praca w wielu oknach nadal jest chroniona.

- Prześlij przetestowane zmiany do zadania źródłowego i zakończ je po ponownych testach, niezależnym przeglądzie i akceptacji.

## What's new [uk]

- Запускайте оригінальні навички Claude ізольовано, перевіряйте та схвалюйте зміни й підтверджуйте виправлення Godot тестами агента. Відновлюйте перервані сесії та налаштовуйте режими фреймворку.

- Додано каталог ролей і навичок Claude-Code-Game-Studios із зафіксованою версією та шаблонами рушіїв. Можна розміщувати вибрані команди й переглядати повні оригінальні інструкції та джерела налаштувань.

- Результати тривалих збірок можна передавати в межах затверджених строків етапу та виконання.

- Переглядайте залежні завдання, готовність пристроїв, передачу артефактів і відновлення; налаштовуйте обмежені повтори, пропущені запуски та чернетки передачі TASTEFILES.

- Керуйте інтеграціями, що перетинаються, і політиками пристроїв, запускайте розклади після успішних залежностей, переглядайте етапи й історію та перевіряйте перепризначення черги.

- Перевіряйте зміни та схвалюйте створення, видалення й перейменування файлів; доступні розв’язання конфліктів і повторна перевірка джерел залежних завдань.

- Додано команду випуску пакетів macOS зі збереженням наявних випусків Windows і Linux.

- Додано пакети DMG і розповсюдження через Homebrew для macOS Apple Silicon.


- Під час першого запуску вікно розміщується в центрі свого монітора.
- Прибрано фіксовані затримки після оновлення у Windows: вікно стану закривається, щойно програма готова. Незбережена робота в кількох вікнах залишається захищеною.

- Перевірені зміни можна подати до вихідного завдання й завершити його після повторних тестів, незалежного огляду та прийняття.

## What's new [tr]

- Özgün Claude becerilerini yalıtılmış alanda çalıştırın, değişiklikleri inceleyip onaylayın ve Godot düzeltmelerini Agent testleriyle doğrulayın. Kesilen oturumları sürdürün ve çerçeve modlarını ayarlayın.

- Sabit sürümlü Claude-Code-Game-Studios rol ve beceri kataloğu ile oyun motoru şablonları eklendi. Seçili ekipleri yerleştirin ve tam özgün istemleri ve yapılandırma kaynaklarını inceleyin.

- Uzun derlemelerin çıktıları, onaylanan adım ve yürütme süreleri içinde aktarılabilir.

- Bağımlı işleri, cihaz hazırlığını, çıktı teslimini ve kurtarma adımlarını inceleyin; sınırlı kaçırılan çalışma/yeniden deneme ilkeleri ve TASTEFILES teslim taslakları ayarlayın.

- Çakışan entegrasyonları ve cihaz ilkelerini yönetin, başarılı bağımlılıklardan sonra zamanlamaları tetikleyin, adımları ve geçmişi görüntüleyin ve kuyruk yeniden atamalarını inceleyin.

- Entegrasyon değişikliklerini inceleyip dosya oluşturma, silme ve yeniden adlandırmayı onaylayın; çakışma çözümü ve bağımlı işler için kaynak incelemesi desteklenir.

- Mevcut Windows ve Linux sürümlerini koruyarak macOS paketleri ekleyen yayın komutu eklendi.

- macOS Apple Silicon için DMG paketleme ve Homebrew dağıtımı eklendi.


- İlk açılışta pencere, bulunduğu monitörün ortasına yerleştirilir.
- Windows güncellemelerinden sonraki sabit beklemeler kaldırıldı: uygulama hazır olduğunda durum penceresi hemen kapanır. Birden fazla penceredeki kaydedilmemiş çalışmalar korunur.

- Test edilmiş değişiklikleri asıl işe gönderin ve yeniden test, bağımsız inceleme ve kabul sonrasında tamamlayın.

## What's new [cs]

- Spouštějte původní dovednosti Claude izolovaně, kontrolujte a schvalujte změny a ověřujte opravy Godot testy agenta. Obnovujte přerušené relace a nastavujte režimy frameworku.

- Přidán katalog rolí a dovedností Claude-Code-Game-Studios s pevnou verzí a šablonami herních enginů. Umístěte vybrané týmy a prohlížejte úplné původní pokyny a zdroje konfigurace.

- Výsledky delších sestavení lze přenášet v rámci schválených lhůt kroku a běhu.

- Prohlížejte závislé úlohy, připravenost zařízení, doručování artefaktů a obnovu; nastavte omezené opakování a návrhy doručení TASTEFILES.

- Spravujte překrývající se integrace a pravidla zařízení, spouštějte plány po úspěšných závislostech, prohlížejte kroky a historii a kontrolujte změny přiřazení ve frontě.

- Kontrolujte integrační změny a schvalujte vytváření, mazání a přejmenování souborů, s řešením konfliktů a novou kontrolou zdrojů navazujících úloh.

- Přidán příkaz pro doplnění balíčků macOS se zachováním stávajících vydání Windows a Linux.

- Přidány balíčky DMG a distribuce přes Homebrew pro macOS Apple Silicon.


- Při prvním spuštění se okno umístí doprostřed příslušného monitoru.
- Byly odstraněny pevné prodlevy po aktualizaci ve Windows: stavové okno se zavře, jakmile je aplikace připravena. Neuložená práce ve více oknech zůstává chráněna.

- Odešlete otestované změny původní úloze a dokončete ji po opakovaných testech, nezávislé kontrole a přijetí.

## What's new [sv]

- Kör ursprungliga Claude-färdigheter isolerat, granska och godkänn ändringar och verifiera Godot-korrigeringar med agenttester. Återuppta avbrutna sessioner och ställ in ramverkslägen.

- En versionslåst Claude-Code-Game-Studios-katalog med roller, färdigheter och spelmotormallar har lagts till. Placera valda team och granska fullständiga originalinstruktioner och konfigurationskällor.

- Resultat från längre byggen kan överföras inom godkända tidsgränser för steg och körning.

- Granska beroende arbete, enhetsberedskap, artefaktleverans och återställning, med begränsade regler för missade körningar/omförsök och TASTEFILES-leveransutkast.

- Hantera överlappande integrationer och enhetspolicyer, utlös scheman efter lyckade beroenden, granska steg och historik och godkänn omfördelning av köat arbete.

- Granska integrationsändringar och godkänn skapande, borttagning och namnbyte av filer, med konfliktlösning och ny källgranskning för beroende arbete.

- Lade till ett publiceringskommando för macOS-paket som bevarar befintliga Windows- och Linux-versioner.

- Lagt till DMG-paket och Homebrew-distribution för macOS Apple Silicon.


- Vid första starten centreras fönstret på sin bildskärm.
- Fasta väntetider efter Windows-uppdateringar har tagits bort: statusfönstret stängs så snart appen är redo. Osparat arbete i flera fönster skyddas fortfarande.

- Skicka testade ändringar till originalarbetet och slutför det efter omtester, oberoende granskning och godkännande.

## What's new [da]

- Kør originale Claude-færdigheder isoleret, gennemgå og godkend ændringer, og verificer Godot-rettelser med agenttests. Genoptag afbrudte sessioner og indstil frameworktilstande.

- Tilføjet et versionsfast Claude-Code-Game-Studios-katalog med roller, færdigheder og spilmotorskabeloner. Placér valgte teams og se komplette originale instruktioner og konfigurationskilder.

- Resultater fra længere builds kan overføres inden for de godkendte frister for trin og kørsel.

- Se afhængigt arbejde, enhedsberedskab, artefaktlevering og gendannelse med begrænsede regler for mistede kørsler/genforsøg og TASTEFILES-leveringskladder.

- Administrer overlappende integrationer og enhedspolitikker, udløs tidsplaner efter vellykkede afhængigheder, se trin og historik og gennemgå omfordeling i køen.

- Gennemgå integrationsændringer og godkend oprettelse, sletning og omdøbning af filer med konfliktløsning og ny kildegennemgang for afhængigt arbejde.

- Tilføjet en udgivelseskommando til macOS-pakker, som bevarer eksisterende Windows- og Linux-udgivelser.

- Tilføjet DMG-pakker og Homebrew-distribution til macOS Apple Silicon.


- Ved første start centreres vinduet på sin skærm.
- Faste ventetider efter Windows-opdateringer er fjernet: statusvinduet lukkes, så snart appen er klar. Ikke-gemt arbejde i flere vinduer beskyttes stadig.

- Indsend testede ændringer til det oprindelige arbejde, og afslut efter gentest, uafhængig gennemgang og accept.

## What's new [nb]

- Kjør originale Claude-ferdigheter isolert, gjennomgå og godkjenn endringer, og verifiser Godot-rettelser med agenttester. Gjenoppta avbrutte økter og still inn rammeverksmoduser.

- Lagt til en versjonslåst Claude-Code-Game-Studios-katalog med roller, ferdigheter og spillmotormaler. Plasser valgte team og se fullstendige originale instruksjoner og konfigurasjonskilder.

- Resultater fra lengre bygg kan overføres innen godkjente frister for trinn og kjøring.

- Se avhengig arbeid, enhetsberedskap, artefaktlevering og gjenoppretting med begrensede regler for tapte kjøringer/forsøk og TASTEFILES-leveringsutkast.

- Administrer overlappende integrasjoner og enhetspolicyer, utløs tidsplaner etter vellykkede avhengigheter, se trinn og historikk og gjennomgå omfordeling i køen.

- Gjennomgå integrasjonsendringer og godkjenn oppretting, sletting og navneendring av filer med konfliktløsning og ny kildegjennomgang for avhengig arbeid.

- Lagt til en utgivelseskommando for macOS-pakker som bevarer eksisterende Windows- og Linux-utgivelser.

- Lagt til DMG-pakker og Homebrew-distribusjon for macOS Apple Silicon.


- Ved første oppstart sentreres vinduet på sin skjerm.
- Faste ventetider etter Windows-oppdateringer er fjernet: statusvinduet lukkes så snart appen er klar. Ulagret arbeid i flere vinduer er fortsatt beskyttet.

- Send testede endringer til det opprinnelige arbeidet og fullfør etter nye tester, uavhengig gjennomgang og godkjenning.

## What's new [fi]

- Suorita alkuperäiset Claude-taidot eristetysti, tarkista ja hyväksy muutokset ja varmista Godot-korjaukset agenttitesteillä. Jatka keskeytyneitä istuntoja ja säädä kehystiloja.

- Lisätty kiinnitetyn version Claude-Code-Game-Studios-rooli- ja taitoluettelo sekä pelimoottorimallit. Aseta valitut tiimit solmuiksi ja tarkastele alkuperäisiä kehotteita ja asetusten lähteitä.

- Pitkien koontien tulokset voidaan siirtää hyväksyttyjen vaihe- ja suoritusaikarajojen sisällä.

- Tarkastele riippuvaisia töitä, laitteiden valmiutta, artefaktien toimitusta ja palautusta sekä määritä rajatut uusinnat ja TASTEFILES-toimitusluonnokset.

- Hallitse päällekkäisiä integraatioita ja laitekäytäntöjä, käynnistä ajastukset onnistuneiden riippuvuuksien jälkeen, tarkastele vaiheita ja historiaa sekä hyväksy jonon uudelleenmääritykset.

- Tarkista integraatiomuutokset ja hyväksy tiedostojen luonti, poisto ja nimeäminen uudelleen; mukana ristiriitojen ratkaisu ja riippuvien tehtävien lähdetarkistus.

- Lisätty julkaisukomento macOS-pakettien lisäämiseen säilyttäen nykyiset Windows- ja Linux-julkaisut.

- Lisätty DMG-paketointi ja Homebrew-jakelu macOS Apple Siliconille.


- Ensimmäisellä käynnistyskerralla ikkuna keskitetään näytölleen.
- Windows-päivitysten jälkeiset kiinteät odotusajat on poistettu: tilaikkuna sulkeutuu heti sovelluksen ollessa valmis. Tallentamaton työ useissa ikkunoissa on edelleen suojattu.

- Lähetä testatut muutokset alkuperäiseen tehtävään ja viimeistele se uusintatestien, riippumattoman tarkistuksen ja hyväksynnän jälkeen.

## What's new [hu]

- Futtassa az eredeti Claude-készségeket elkülönítve, ellenőrizze és hagyja jóvá a változásokat, majd igazolja a Godot-javításokat ügynökteszttel. Folytathatók a megszakított munkamenetek, és állíthatók a keretrendszer módjai.

- Rögzített verziójú Claude-Code-Game-Studios szerep- és készségkatalógus, valamint játékmotor-sablonok kerültek be. A kiválasztott csapatok elhelyezhetők, a teljes eredeti utasítások és beállításforrások megtekinthetők.

- A hosszabb fordítások eredményei a jóváhagyott lépés- és futási határidőn belül átadhatók.

- Függő feladatok, eszközkészültség, eredményátadás és helyreállítás áttekintése, korlátozott pótlási/újrapróbálási szabályokkal és TASTEFILES-átadási tervezetekkel.

- Átfedő integrációk és eszközszabályok kezelése, ütemezés sikeres függőségek után, lépések és előzmények megtekintése, valamint várakozó feladatok újrakiosztásának ellenőrzése.

- Tekintse át az integrációs változásokat, és hagyja jóvá a fájlok létrehozását, törlését és átnevezését, ütközésfeloldással és a függő feladatok forrásának újraellenőrzésével.

- Új kiadási parancs macOS-csomagok hozzáadásához a meglévő Windows- és Linux-kiadások megőrzésével.

- DMG-csomagolás és Homebrew-terjesztés hozzáadva macOS Apple Siliconhoz.


- Az első indításkor az ablak a saját monitorának közepén jelenik meg.
- Megszűntek a Windows-frissítések utáni rögzített várakozások: az állapotablak bezárul, amint az alkalmazás készen áll. A több ablakban lévő nem mentett munka továbbra is védett.

- A tesztelt módosítások az eredeti feladatba küldhetők, majd újratesztelés, független ellenőrzés és elfogadás után lezárhatók.

## What's new [ro]

- Rulați abilitățile Claude originale izolat, examinați și aprobați modificările și verificați remedierile Godot prin teste Agent. Reluați sesiunile întrerupte și ajustați modurile cadrului.

- A fost adăugat un catalog Claude-Code-Game-Studios cu versiune fixă pentru roluri și abilități, cu șabloane pentru motoare. Plasați echipele selectate și consultați instrucțiunile originale complete și sursele configurației.

- Rezultatele compilărilor lungi pot fi transferate în termenele aprobate pentru etapă și execuție.

- Consultați sarcinile dependente, pregătirea dispozitivelor, livrarea artefactelor și recuperarea, cu politici limitate de reluare și schițe TASTEFILES.

- Gestionați integrările suprapuse și politicile dispozitivelor, declanșați programări după dependențe reușite, consultați pașii și istoricul și revizuiți realocările din coadă.

- Examinați modificările și aprobați crearea, ștergerea și redenumirea fișierelor, cu rezolvarea conflictelor și reevaluarea surselor pentru sarcinile dependente.

- Comandă nouă de publicare pentru adăugarea pachetelor macOS, păstrând versiunile Windows și Linux existente.

- Au fost adăugate pachete DMG și distribuția prin Homebrew pentru macOS Apple Silicon.


- La prima pornire, fereastra este centrată pe monitorul său.
- Au fost eliminate așteptările fixe după actualizările pe Windows: fereastra de stare se închide când aplicația este pregătită. Lucrul nesalvat din mai multe ferestre rămâne protejat.

- Trimiteți modificările testate lucrării originale și finalizați după retestare, verificare independentă și acceptare.

## What's new [el]

- Εκτελέστε τις αρχικές δεξιότητες Claude απομονωμένα, ελέγξτε και εγκρίνετε αλλαγές και επαληθεύστε διορθώσεις Godot με δοκιμές Agent. Συνεχίστε συνεδρίες που διακόπηκαν και ρυθμίστε τις λειτουργίες του πλαισίου.

- Προστέθηκε κατάλογος ρόλων και δεξιοτήτων Claude-Code-Game-Studios με σταθερή έκδοση και πρότυπα μηχανών παιχνιδιών. Τοποθετήστε επιλεγμένες ομάδες και δείτε τις πλήρεις αρχικές οδηγίες και τις πηγές ρυθμίσεων.

- Τα αποτελέσματα μεγάλων μεταγλωττίσεων μεταφέρονται εντός των εγκεκριμένων προθεσμιών βήματος και εκτέλεσης.

- Ελέγξτε εξαρτώμενες εργασίες, ετοιμότητα συσκευών, παράδοση τεχνουργημάτων και ανάκτηση, με περιορισμένες πολιτικές επανάληψης και προσχέδια παράδοσης TASTEFILES.

- Διαχειριστείτε επικαλυπτόμενες ενσωματώσεις και πολιτικές συσκευών, ενεργοποιήστε προγράμματα μετά από επιτυχείς εξαρτήσεις, δείτε βήματα και ιστορικό και ελέγξτε επαναναθέσεις στην ουρά.

- Ελέγξτε τις αλλαγές και εγκρίνετε δημιουργία, διαγραφή και μετονομασία αρχείων, με επίλυση συγκρούσεων και νέο έλεγχο πηγών εξαρτώμενων εργασιών.

- Προστέθηκε εντολή έκδοσης για προσθήκη πακέτων macOS με διατήρηση των υπαρχουσών εκδόσεων Windows και Linux.

- Προστέθηκαν πακέτα DMG και διανομή μέσω Homebrew για macOS Apple Silicon.


- Κατά την πρώτη εκκίνηση, το παράθυρο τοποθετείται στο κέντρο της οθόνης του.
- Καταργήθηκαν οι σταθερές αναμονές μετά τις ενημερώσεις στα Windows: το παράθυρο κατάστασης κλείνει μόλις η εφαρμογή είναι έτοιμη. Η μη αποθηκευμένη εργασία σε πολλά παράθυρα εξακολουθεί να προστατεύεται.

- Υποβάλετε τις δοκιμασμένες αλλαγές στην αρχική εργασία και ολοκληρώστε τη μετά από επανέλεγχο, ανεξάρτητη αναθεώρηση και αποδοχή.

## What's new [vi]

- Chạy kỹ năng Claude gốc trong vùng cách ly, xem xét và phê duyệt thay đổi rồi xác minh bản sửa Godot bằng kiểm thử Agent. Tiếp tục phiên bị gián đoạn và điều chỉnh chế độ khung.

- Đã thêm danh mục vai trò và kỹ năng Claude-Code-Game-Studios được ghim phiên bản cùng mẫu cho công cụ trò chơi. Đặt các nhóm đã chọn và xem đầy đủ lời nhắc gốc cùng nguồn cấu hình.

- Kết quả bản dựng dài vẫn được truyền trong thời hạn bước và thực thi đã phê duyệt.

- Xem công việc phụ thuộc, trạng thái thiết bị, chuyển giao sản phẩm và phục hồi; đặt chính sách chạy bù/thử lại có giới hạn và bản nháp chuyển giao TASTEFILES.

- Quản lý tích hợp chồng chéo và chính sách thiết bị, kích hoạt lịch sau phụ thuộc thành công, xem bước và lịch sử, đồng thời duyệt phân công lại công việc đang chờ.

- Xem xét thay đổi và phê duyệt tạo, xóa, đổi tên tệp, cùng giải quyết xung đột và xem lại mã nguồn cho công việc phụ thuộc.

- Thêm lệnh phát hành để bổ sung gói macOS và giữ nguyên các bản phát hành Windows và Linux hiện có.

- Đã bổ sung gói DMG và phân phối qua Homebrew cho macOS Apple Silicon.


- Khi khởi chạy lần đầu, cửa sổ được căn giữa trên màn hình tương ứng.
- Đã bỏ thời gian chờ cố định sau khi cập nhật trên Windows: cửa sổ trạng thái đóng ngay khi ứng dụng sẵn sàng. Công việc chưa lưu trong nhiều cửa sổ vẫn được bảo vệ.

- Gửi thay đổi đã kiểm thử về công việc gốc và hoàn tất sau khi kiểm thử lại, đánh giá độc lập và chấp thuận.

## What's new [id]

- Jalankan skill Claude asli secara terisolasi, tinjau dan setujui perubahan, lalu verifikasi perbaikan Godot dengan pengujian Agent. Lanjutkan sesi yang terputus dan atur mode framework.

- Menambahkan katalog peran dan keterampilan Claude-Code-Game-Studios dengan versi tetap serta templat mesin game. Tempatkan tim terpilih dan lihat prompt asli lengkap serta sumber konfigurasi.

- Hasil build yang lama tetap dapat ditransfer dalam batas waktu tahap dan eksekusi yang disetujui.

- Tinjau pekerjaan dependen, kesiapan perangkat, pengiriman artefak dan pemulihan, dengan kebijakan eksekusi terlewat/percobaan ulang terbatas dan draf TASTEFILES.

- Kelola integrasi yang bertumpang tindih dan kebijakan perangkat, picu jadwal setelah dependensi berhasil, lihat langkah dan riwayat, serta tinjau penugasan ulang antrean.

- Tinjau perubahan integrasi dan setujui pembuatan, penghapusan serta penggantian nama berkas, dengan penyelesaian konflik dan peninjauan ulang sumber pekerjaan terkait.

- Menambahkan perintah rilis untuk menambah paket macOS sambil mempertahankan rilis Windows dan Linux yang ada.

- Menambahkan paket DMG dan distribusi Homebrew untuk macOS Apple Silicon.


- Saat pertama kali dijalankan, jendela ditempatkan di tengah monitornya.
- Waktu tunggu tetap setelah pembaruan Windows dihapus: jendela status langsung ditutup saat aplikasi siap. Pekerjaan yang belum disimpan di beberapa jendela tetap terlindungi.

- Kirim perubahan teruji ke pekerjaan asli dan selesaikan setelah pengujian ulang, tinjauan independen, serta penerimaan.
