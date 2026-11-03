# 다음 판에서 달라진 것

<!-- 출시 도구가 다음 출시 때 아래 목록을 docs/releases/vX.Y.Z.md 의 "## 이번 판에서 달라진 것" 절로 옮기고 이 파일을 비운다.
     한 줄 = 쓰는 사람이 알아챌 변화 하나("- " 로 시작). **굵게** · `코드` 표시는 사이트에서 떼어 낸다.
     내부 호스트 · IP · 경로 · 계획 번호 · chore/docs/test 류는 적지 않는다(적어도 출시 도구가 뺀다). 비어 있으면 절을 넣지 않는다. -->


## 이번 판에서 달라진 것

- 예약 대상 검토에서 게시된 관계도·Source 신원과 중복 실행 대기 상태를 확인할 수 있습니다.

- 통합함에서 진행 중인 요청의 파일 중복 가능성과 기준 버전·제안 내용 차이, 검토 신원을 함께 확인할 수 있습니다.

- 재개 전 저장된 Run·Job·Source 신원을 검사하고, 불일치 기록은 Core에서 차단합니다. 복구 검토는 Source·기한·다른 노드의 진행이 바뀌면 다시 받아야 합니다.

- 실행 전 의존 순서·병렬 가능 단계·승인·실패 경로를 검토할 수 있으며, 게시 버전이나 Source·시작 노드·시간 제한이 바뀌면 실행 검토를 다시 받아야 합니다.

- 장비별 Agent 작업 공간에 OS와 Source 종류를 연결하고, 승인한 연결과 다른 작업 배정을 차단할 수 있습니다.

- 노드별 실행 준비 진단에서 지정 Agent의 실행 기능과 게시된 작업 요구사항, Source 및 인증·승인 검토 상태를 확인할 수 있습니다.

## What's new [en]

- Scheduled target review shows the published graph and Source identity and active execution overlap.

- The integration inbox shows potential file overlaps, base revision and proposed content differences, and review identities.

- Inspect saved Run, Job and Source identities before resuming; Core blocks inconsistent records and requires renewed review when Source, deadline or other node progress changes.

- Preview dependency order, potential parallel steps, approvals and failure paths; execution review must be renewed when the published version, Source, entry node or timeout changes.

- Bind each device’s Agent workspaces to an OS and Source type, and block assignments that do not match the approved bindings.

- Inspect assigned Agent capabilities, published task requirements, Source, and authentication and approval review status in node execution preflight.

## What's new [de]

- Die Zielprüfung zeigt veröffentlichten Graph, Source-Identität und aktive Überschneidungen.

- Der Integrationseingang zeigt mögliche Dateiüberschneidungen, Unterschiede bei Basisrevision und Inhalt sowie Prüfidentitäten.

- Gespeicherte Run-, Job- und Source-Identitäten werden vor der Fortsetzung geprüft; Abweichungen blockieren die Wiederaufnahme.

- Prüfen Sie Reihenfolge, mögliche Parallelität, Freigaben und Fehlerpfade. Geänderte Versionen, Source, Startknoten oder Zeitlimits erfordern eine neue Prüfung.

- Agent-Arbeitsbereiche lassen sich an OS und Source-Typ binden; abweichende Zuweisungen werden blockiert.

- Die Knotenvorprüfung zeigt Agent-Fähigkeiten, veröffentlichte Aufgabenanforderungen, Source sowie Authentifizierungs- und Freigabestatus.

## What's new [es]

- La revisión del destino muestra el grafo publicado, la identidad Source y las ejecuciones solapadas.

- La bandeja de integración muestra posibles coincidencias de archivos, diferencias de base y contenido, e identidades de revisión.

- Inspecciona las identidades Run, Job y Source antes de reanudar; Core bloquea registros incoherentes y exige nueva revisión si cambia el contexto.

- Revisa dependencias, paralelismo, aprobaciones y rutas de fallo; los cambios de versión, Source, inicio o tiempo exigen nueva revisión.

- Vincula los espacios Agent a un SO y tipo de Source, y bloquea asignaciones fuera de los vínculos aprobados.

- La comprobación de nodos muestra capacidades del Agent asignado, requisitos publicados, Source y estado de autenticación y aprobación.

## What's new [fr]

- La vérification de cible affiche le graphe publié, l’identité Source et les exécutions simultanées.

- La boîte d’intégration affiche les chevauchements possibles, les différences de base et de contenu et les identités de revue.

- Inspectez les identités Run, Job et Source avant reprise ; Core bloque les incohérences et exige une nouvelle revue si le contexte change.

- Vérifiez dépendances, parallélisme, approbations et échecs ; toute modification de version, Source, départ ou délai exige une nouvelle revue.

- Associez les espaces Agent à un OS et un type de Source, et bloquez les affectations non conformes.

- La vérification des nœuds présente les capacités de l’Agent, les exigences publiées, Source et les états d’authentification et d’approbation.

## What's new [it]

- La verifica della destinazione mostra grafo pubblicato, identità Source ed esecuzioni sovrapposte.

- La casella integrazioni mostra possibili sovrapposizioni, differenze di base e contenuto e identità delle revisioni.

- Verifica le identità Run, Job e Source prima di riprendere; Core blocca incoerenze e richiede una nuova revisione se cambia il contesto.

- Verifica dipendenze, parallelismo, approvazioni ed errori; modifiche a versione, Source, avvio o timeout richiedono una nuova revisione.

- Associa gli spazi Agent a un OS e tipo di Source e blocca le assegnazioni non approvate.

- Il controllo dei nodi mostra capacità dell’Agent assegnato, requisiti pubblicati, Source e stato di autenticazione e approvazione.

## What's new [pt]

- A revisão do destino mostra o grafo publicado, a identidade Source e execuções sobrepostas.

- A caixa de integração mostra possíveis sobreposições, diferenças de base e conteúdo e identidades de revisão.

- Inspecione as identidades Run, Job e Source antes de retomar; Core bloqueia inconsistências e exige nova revisão se o contexto mudar.

- Revise dependências, paralelismo, aprovações e falhas; mudanças de versão, Source, início ou prazo exigem nova revisão.

- Vincule espaços Agent a um SO e tipo de Source e bloqueie atribuições fora dos vínculos aprovados.

- A verificação dos nós mostra capacidades do Agent atribuído, requisitos publicados, Source e estado de autenticação e aprovação.

## What's new [ja]

- 予約対象の確認で公開済み関係図・Source の識別情報と重複実行の待機状態を確認できます。

- 統合一覧でファイル重複の可能性、基準リビジョンと提案内容の違い、レビューの識別情報を確認できます。

- 再開前に保存済み Run・Job・Source の識別情報を確認し、不一致を Core で拒否します。Source、期限、他ノードの進捗変更時は再確認が必要です。

- 実行前に依存順序、並列実行の可能性、承認、失敗経路を確認できます。公開版、Source、開始ノード、制限時間の変更時は再確認が必要です。

- 装置ごとの Agent 作業領域に OS と Source 種類を関連付け、承認済みの関連付けに合わない割り当てを拒否できます。

- ノードの実行前確認で、割り当てた Agent の機能、公開済みタスク要件、Source、認証と承認の確認状態を表示します。

## What's new [zh]

- 计划目标审核显示已发布关系图、Source 标识和活动执行重叠。

- 集成收件箱显示文件重叠风险、基准版本和提议内容差异及审查标识。

- 恢复前检查保存的 Run、Job 和 Source 身份，Core 会阻止不一致记录；Source、期限或其他节点进度变化后须重新审核。

- 执行前可预览依赖顺序、潜在并行步骤、审批和失败路径；发布版本、Source、入口节点或超时变更后须重新审核。

- 可为每台设备的 Agent 工作空间绑定操作系统和 Source 类型，并阻止不符合已批准绑定的分配。

- 节点执行前检查可显示指定 Agent 的能力、已发布任务要求、Source 以及认证和审批审核状态。

## What's new [zh-hant]

- 排程目標檢閱顯示已發布關係圖、Source 識別資訊和活動執行重疊。

- 整合收件匣顯示檔案重疊風險、基準版本和提議內容差異及檢閱識別資訊。

- 恢復前檢查儲存的 Run、Job 與 Source 身分，Core 會阻擋不一致記錄；Source、期限或其他節點進度變更後須重新審閱。

- 執行前可預覽相依順序、可能平行步驟、核准與失敗路徑；發佈版本、Source、入口節點或逾時變更後須重新審閱。

- 可為各裝置的 Agent 工作空間綁定作業系統與 Source 類型，並阻擋不符合核准綁定的指派。

- 節點執行前檢查可顯示指定 Agent 的能力、已發佈工作要求、Source，以及驗證與核准審閱狀態。

## What's new [ru]

- Проверка запланированной цели показывает опубликованный граф, идентификатор Source и пересекающиеся запуски.

- В списке интеграции показаны возможные пересечения файлов, различия базовой ревизии и содержимого, а также идентификаторы проверок.

- Проверяйте сохранённые идентификаторы Run, Job и Source перед возобновлением; Core блокирует несогласованные записи.

- Просматривайте зависимости, параллельные этапы, согласования и сбои; изменения версии, Source, начала или срока требуют новой проверки.

- Привяжите рабочие области Agent к ОС и типу Source и блокируйте назначения, не соответствующие согласованным привязкам.

- Предварительная проверка узла показывает возможности Agent, требования задач, Source и состояние проверки аутентификации и согласования.

## What's new [nl]

- Doelcontrole toont de gepubliceerde graaf, Source-identiteit en overlappende uitvoeringen.

- Het integratieoverzicht toont mogelijke bestandsoverlap, verschillen in basisrevisie en voorgestelde inhoud en beoordelingsidentiteiten.

- Controleer opgeslagen Run-, Job- en Source-identiteiten voor hervatten; Core blokkeert inconsistente records.

- Bekijk afhankelijkheden, parallelle stappen, goedkeuringen en foutpaden. Wijzigingen aan versie, Source, start of timeout vereisen herbeoordeling.

- Koppel Agent-werkruimtes aan een OS en Source-type en blokkeer afwijkende toewijzingen.

- De nodecontrole toont Agent-capaciteiten, gepubliceerde taakeisen, Source en de status van authenticatie en goedkeuring.

## What's new [pl]

- Przegląd celu pokazuje opublikowany graf, tożsamość Source i nakładające się uruchomienia.

- Skrzynka integracji pokazuje możliwe nakładanie plików, różnice wersji bazowej i treści oraz identyfikatory przeglądów.

- Sprawdzaj zapisane tożsamości Run, Job i Source przed wznowieniem; Core blokuje niespójne rekordy.

- Przeglądaj zależności, równoległe etapy, zatwierdzenia i błędy; zmiany wersji, Source, startu lub limitu wymagają ponownego przeglądu.

- Powiąż obszary Agent z systemem i typem Source oraz blokuj niezgodne przydziały.

- Kontrola węzła pokazuje możliwości Agent, wymagania opublikowanych zadań, Source oraz stan uwierzytelniania i zatwierdzania.

## What's new [uk]

- Перевірка цілі показує опублікований граф, ідентифікатор Source та одночасні запуски.

- Список інтеграції показує можливі перетини файлів, відмінності базової версії й вмісту та ідентифікатори перевірок.

- Перевіряйте збережені ідентифікатори Run, Job і Source перед відновленням; Core блокує невідповідні записи.

- Переглядайте залежності, паралельні кроки, погодження й збої; зміни версії, Source, початку або строку потребують нового перегляду.

- Прив’язуйте робочі області Agent до ОС і типу Source та блокуйте невідповідні призначення.

- Попередня перевірка вузла показує можливості Agent, вимоги завдань, Source та стан перевірки автентифікації й погодження.

## What's new [tr]

- Planlanan hedef incelemesi yayımlanan grafiği, Source kimliğini ve çakışan çalıştırmaları gösterir.

- Entegrasyon kutusu olası dosya çakışmalarını, temel sürüm ve içerik farklarını ve inceleme kimliklerini gösterir.

- Devam etmeden önce Run, Job ve Source kimliklerini denetleyin; Core tutarsız kayıtları engeller.

- Bağımlılıkları, paralel adımları, onayları ve hata yollarını inceleyin; sürüm, Source, başlangıç veya süre değişirse yeniden inceleyin.

- Agent çalışma alanlarını işletim sistemi ve Source türüne bağlayın; onaylanan bağlara uymayan atamaları engelleyin.

- Düğüm ön kontrolünde atanan Agent yetenekleri, yayımlanan görev gereksinimleri, Source ve kimlik doğrulama ile onay durumu görüntülenir.

## What's new [cs]

- Kontrola cíle ukazuje publikovaný graf, identitu Source a překrývající se běhy.

- Přehled integrací ukazuje možné překryvy souborů, rozdíly základní revize a obsahu i identity kontrol.

- Před pokračováním ověřte uložené identity Run, Job a Source; Core blokuje nekonzistentní záznamy.

- Zobrazte závislosti, souběžné kroky, schválení a chyby. Změny verze, Source, začátku nebo limitu vyžadují nové posouzení.

- Svažte pracovní oblasti Agent s OS a typem Source a blokujte neodpovídající přiřazení.

- Kontrola uzlů zobrazuje schopnosti Agent, požadavky publikovaných úloh, Source a stav ověření a schválení.

## What's new [sv]

- Målgranskningen visar publicerad graf, Source-identitet och överlappande körningar.

- Integrationsinkorgen visar möjliga filöverlappningar, skillnader i basrevision och innehåll samt granskningsidentiteter.

- Kontrollera sparade Run-, Job- och Source-identiteter före återupptagning; Core blockerar inkonsekventa poster.

- Granska beroenden, parallella steg, godkännanden och felvägar. Ändrad version, Source, start eller tidsgräns kräver ny granskning.

- Bind Agent-arbetsområden till OS och Source-typ och blockera avvikande tilldelningar.

- Nodkontrollen visar Agent-funktioner, publicerade uppgiftskrav, Source och status för autentisering och godkännande.

## What's new [da]

- Målgennemgang viser udgivet graf, Source-identitet og overlappende kørsler.

- Integrationsindbakken viser mulige filoverlap, forskelle i basisrevision og indhold samt gennemgangsidentiteter.

- Kontrollér gemte Run-, Job- og Source-identiteter før genoptagelse; Core blokerer uoverensstemmelser.

- Se afhængigheder, parallelle trin, godkendelser og fejlveje. Ændret version, Source, start eller tidsgrænse kræver ny gennemgang.

- Bind Agent-arbejdsområder til OS og Source-type, og blokér afvigende tildelinger.

- Nodekontrollen viser Agent-funktioner, publicerede opgavekrav, Source samt status for godkendelse og autentificering.

## What's new [nb]

- Målgjennomgangen viser publisert graf, Source-identitet og overlappende kjøringer.

- Integrasjonsinnboksen viser mulige filoverlapp, forskjeller i basisrevisjon og innhold samt gjennomgangsidentiteter.

- Kontroller lagrede Run-, Job- og Source-identiteter før gjenopptakelse; Core blokkerer inkonsistente poster.

- Se avhengigheter, parallelle trinn, godkjenninger og feilbaner. Endret versjon, Source, start eller tidsgrense krever ny gjennomgang.

- Bind Agent-arbeidsområder til OS og Source-type og blokker avvikende tildelinger.

- Nodekontrollen viser Agent-funksjoner, publiserte oppgavekrav, Source og status for autentisering og godkjenning.

## What's new [fi]

- Kohteen tarkastus näyttää julkaistun kaavion, Source-tunnisteen ja päällekkäiset suoritukset.

- Integrointinäkymä näyttää mahdolliset tiedostopäällekkäisyydet, pohjaversion ja sisällön erot sekä tarkastustunnisteet.

- Tarkista tallennetut Run-, Job- ja Source-tunnisteet ennen jatkamista; Core estää ristiriitaiset tietueet.

- Esikatsele riippuvuuksia, rinnakkaisia vaiheita, hyväksyntöjä ja virhepolkuja. Version, Sourcen, aloituksen tai aikarajan muutos vaatii uuden tarkistuksen.

- Sido Agentin työtilat käyttöjärjestelmään ja Source-tyyppiin ja estä poikkeavat tehtävämääritykset.

- Solmun esitarkistus näyttää Agentin ominaisuudet, julkaistut tehtävävaatimukset, Sourcen sekä tunnistautumisen ja hyväksynnän tilan.

## What's new [hu]

- A cél ellenőrzése mutatja a közzétett gráfot, a Source-azonosítót és az átfedő futásokat.

- Az integrációs lista mutatja a lehetséges fájlátfedéseket, az alapverzió és tartalom eltéréseit és az ellenőrzések azonosítóit.

- Folytatás előtt ellenőrizze a mentett Run-, Job- és Source-azonosítókat; Core blokkolja az eltérő rekordokat.

- Tekintse át a függőségeket, párhuzamos lépéseket, jóváhagyásokat és hibautakat; módosult verzió, Source, kezdés vagy időkorlát esetén új ellenőrzés kell.

- Kösse az Agent munkaterületeit operációs rendszerhez és Source-típushoz, és tiltsa a nem megfelelő hozzárendeléseket.

- A csomópont ellenőrzése megjeleníti az Agent képességeit, a közzétett feladatkövetelményeket, a Source és a hitelesítés, illetve jóváhagyás állapotát.

## What's new [ro]

- Revizuirea țintei arată graful publicat, identitatea Source și execuțiile suprapuse.

- Lista de integrare arată posibile suprapuneri de fișiere, diferențe de versiune și conținut și identitățile revizuirilor.

- Verificați identitățile Run, Job și Source înainte de reluare; Core blochează înregistrările neconforme.

- Previzualizați dependențe, pași paraleli, aprobări și erori; schimbarea versiunii, Source, începutului sau limitei cere o nouă revizuire.

- Asociați spațiile Agent cu un OS și tip de Source și blocați atribuirile neconforme.

- Verificarea nodurilor arată capacitățile Agent, cerințele publicate, Source și starea autentificării și aprobării.

## What's new [el]

- Ο έλεγχος στόχου δείχνει το δημοσιευμένο γράφημα, την ταυτότητα Source και επικαλυπτόμενες εκτελέσεις.

- Τα εισερχόμενα ενσωμάτωσης δείχνουν πιθανές επικαλύψεις αρχείων, διαφορές βασικής έκδοσης και περιεχομένου και ταυτότητες ελέγχων.

- Ελέγξτε τις αποθηκευμένες ταυτότητες Run, Job και Source πριν τη συνέχιση· το Core αποκλείει ασυνεπείς εγγραφές.

- Προεπισκόπηση εξαρτήσεων, παράλληλων βημάτων, εγκρίσεων και σφαλμάτων. Αλλαγές έκδοσης, Source, αρχής ή ορίου απαιτούν νέο έλεγχο.

- Συνδέστε τους χώρους Agent με OS και τύπο Source και αποκλείστε μη συμβατές αναθέσεις.

- Ο προέλεγχος κόμβων εμφανίζει δυνατότητες Agent, δημοσιευμένες απαιτήσεις εργασιών, Source και κατάσταση ελέγχου ταυτοποίησης και έγκρισης.

## What's new [vi]

- Đánh giá mục tiêu lịch hiển thị đồ thị đã công bố, danh tính Source và lượt chạy trùng.

- Hộp tích hợp hiển thị tệp có thể trùng, khác biệt phiên bản gốc và nội dung đề xuất, cùng danh tính đánh giá.

- Kiểm tra danh tính Run, Job và Source trước khi tiếp tục; Core chặn bản ghi không nhất quán.

- Xem trước phụ thuộc, bước song song, phê duyệt và lỗi; phải xét duyệt lại khi đổi phiên bản, Source, nút đầu hoặc thời hạn.

- Gắn không gian Agent với hệ điều hành và loại Source, đồng thời chặn phân công không khớp liên kết đã duyệt.

- Kiểm tra nút trước khi chạy hiển thị khả năng Agent, yêu cầu tác vụ đã công bố, Source và trạng thái xác thực, xét duyệt.

## What's new [id]

- Tinjauan target terjadwal menampilkan graf terbit, identitas Source, dan eksekusi tumpang tindih.

- Kotak integrasi menampilkan potensi tumpang tindih berkas, perbedaan revisi dasar dan isi usulan, serta identitas tinjauan.

- Periksa identitas Run, Job, dan Source sebelum melanjutkan; Core memblokir catatan yang tidak konsisten.

- Pratinjau dependensi, langkah paralel, persetujuan, dan jalur gagal; perubahan versi, Source, awal, atau batas waktu memerlukan tinjauan ulang.

- Ikat ruang Agent ke OS dan jenis Source, lalu blokir penugasan yang tidak sesuai dengan ikatan yang disetujui.

- Pemeriksaan node menampilkan kemampuan Agent, persyaratan tugas yang dipublikasikan, Source, serta status autentikasi dan persetujuan.
