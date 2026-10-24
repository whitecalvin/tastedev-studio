import type {Language} from './core.ts';
const languages:Language[]=['ko','de','es','fr','it','pt','ja','zh','zh-hant'];
const rows=`Project team|프로젝트 팀|Projektteam|Equipo del proyecto|Équipe du projet|Team del progetto|Equipe do projeto|プロジェクトチーム|项目团队|專案團隊
Team operations|팀 운영|Teambetrieb|Operaciones del equipo|Opérations d’équipe|Operazioni del team|Operações da equipe|チーム運用|团队运作|團隊運作
Team setup|팀 구성|Teameinrichtung|Configuración del equipo|Configuration d’équipe|Configurazione team|Configuração da equipe|チーム構成|团队配置|團隊設定
Device roles only|장비 역할만 구성|Nur Geräterollen|Solo roles de equipos|Rôles des machines uniquement|Solo ruoli dei dispositivi|Somente funções dos dispositivos|機器の役割のみ|仅设备角色|僅裝置角色
Role-based AI team|역할 기반 AI 팀|Rollenbasiertes KI-Team|Equipo IA por roles|Équipe IA par rôles|Team IA per ruoli|Equipe IA por funções|役割別AIチーム|基于角色的 AI 团队|依角色配置的 AI 團隊
Team lead|팀 리더|Teamleitung|Líder del equipo|Responsable d’équipe|Responsabile team|Líder da equipe|チームリーダー|团队负责人|團隊負責人
Independent review|독립 검토|Unabhängige Prüfung|Revisión independiente|Revue indépendante|Revisione indipendente|Revisão independente|独立レビュー|独立审查|獨立審查
Documentation|문서화|Dokumentation|Documentación|Documentation|Documentazione|Documentação|文書化|文档|文件
Devices run Agents. Responsibilities define work. AI profiles define models and tools.|장비는 Agent를 실행하고, 역할은 담당 작업을, AI 구성은 모델과 도구를 정의합니다.|Geräte führen Agents aus. Rollen bestimmen Aufgaben, KI-Profile Modelle und Werkzeuge.|Los equipos ejecutan agentes; los roles definen tareas y los perfiles IA, modelos y herramientas.|Les machines exécutent les agents ; les rôles définissent le travail et les profils IA, les modèles et outils.|I dispositivi eseguono gli agenti; i ruoli definiscono il lavoro e i profili IA, modelli e strumenti.|Dispositivos executam agentes; funções definem tarefas e perfis IA, modelos e ferramentas.|機器でAgentを実行し、役割で担当作業、AI構成でモデルとツールを定義します。|设备运行 Agent，角色定义工作，AI 配置定义模型和工具。|裝置執行 Agent，角色定義工作，AI 設定定義模型與工具。
Add role-based team draft|역할 팀 초안 추가|Teamvorlage hinzufügen|Añadir borrador de equipo|Ajouter une ébauche d’équipe|Aggiungi bozza del team|Adicionar rascunho de equipe|役割別チーム案を追加|添加角色团队草案|新增角色團隊草稿
Not assigned|미배정|Nicht zugewiesen|Sin asignar|Non affecté|Non assegnato|Não atribuído|未割り当て|未分配|未指派
AI configuration missing|AI 구성 필요|KI-Konfiguration fehlt|Falta configuración IA|Configuration IA manquante|Configurazione IA mancante|Configuração IA ausente|AI構成が必要|缺少 AI 配置|缺少 AI 設定
Connect to Core to use durable team operations.|팀 운영 내용을 보존하려면 Core에 연결하세요.|Für dauerhafte Teamdaten mit Core verbinden.|Conecta a Core para conservar las operaciones del equipo.|Connectez Core pour conserver les opérations d’équipe.|Connetti Core per conservare le operazioni del team.|Conecte ao Core para preservar as operações da equipe.|チーム運用を保存するにはCoreに接続してください。|连接 Core 以保存团队运作数据。|連接 Core 以儲存團隊運作資料。
Saved in Core|Core에 저장됨|In Core gespeichert|Guardado en Core|Enregistré dans Core|Salvato in Core|Salvo no Core|Coreに保存済み|已保存到 Core|已儲存至 Core
Core is using memory storage. Changes will not survive restart.|Core가 메모리 저장소를 사용합니다. 재시작하면 변경 내용이 사라집니다.|Core nutzt Arbeitsspeicher. Änderungen gehen beim Neustart verloren.|Core usa memoria. Los cambios se perderán al reiniciar.|Core utilise la mémoire. Les modifications seront perdues au redémarrage.|Core usa la memoria. Le modifiche andranno perse al riavvio.|O Core usa memória. Alterações serão perdidas ao reiniciar.|Coreはメモリ保存です。再起動すると変更が失われます。|Core 使用内存存储，重启后更改将丢失。|Core 使用記憶體儲存，重新啟動後變更將遺失。
Work intent|작업 의도|Arbeitsabsicht|Intención de trabajo|Intention de travail|Intento di lavoro|Intenção de trabalho|作業意図|工作意图|工作意圖
Select|선택|Auswählen|Seleccionar|Sélectionner|Seleziona|Selecionar|選択|选择|選擇
Objective|목표|Ziel|Objetivo|Objectif|Obiettivo|Objetivo|目標|目标|目標
Responsibility|담당 역할|Verantwortung|Responsabilidad|Responsabilité|Responsabilità|Responsabilidade|担当役割|职责|職責
Original request (masked)|원래 요청 (마스킹 적용)|Originalanfrage (maskiert)|Solicitud original (enmascarada)|Demande initiale (masquée)|Richiesta originale (mascherata)|Solicitação original (mascarada)|元の依頼（マスク済み）|原始请求（已脱敏）|原始請求（已遮罩）
Exclusions|제외 범위|Ausschlüsse|Exclusiones|Exclusions|Esclusioni|Exclusões|対象外|排除范围|排除範圍
Allowed paths, one per line|허용 경로 (줄마다 하나)|Erlaubte Pfade, einer je Zeile|Rutas permitidas, una por línea|Chemins autorisés, un par ligne|Percorsi consentiti, uno per riga|Caminhos permitidos, um por linha|許可パス（1行に1つ）|允许路径，每行一个|允許路徑，每行一個
Revision reason|변경 사유|Änderungsgrund|Motivo del cambio|Motif de révision|Motivo della revisione|Motivo da revisão|変更理由|修订原因|修訂原因
Save intent|작업 의도 저장|Absicht speichern|Guardar intención|Enregistrer l’intention|Salva intento|Salvar intenção|作業意図を保存|保存工作意图|儲存工作意圖
Edit intent|작업 의도 편집|Absicht bearbeiten|Editar intención|Modifier l’intention|Modifica intento|Editar intenção|作業意図を編集|编辑工作意图|編輯工作意圖
Mark ready|준비 상태로 승인|Als bereit bestätigen|Confirmar preparación|Confirmer la préparation|Conferma pronto|Confirmar preparação|準備完了を承認|确认准备就绪|確認準備就緒
Use intent in work contract|작업 계약에 사용|Für Arbeitsvertrag verwenden|Usar en contrato de trabajo|Utiliser dans le contrat de travail|Usa nel contratto di lavoro|Usar no contrato de trabalho|作業契約に使用|用于工作契约|用於工作契約
Intent history|작업 의도 이력|Absichtsverlauf|Historial de intenciones|Historique des intentions|Cronologia intenti|Histórico de intenções|作業意図の履歴|工作意图历史|工作意圖歷程
Decision|결정 사항|Entscheidung|Decisión|Décision|Decisione|Decisão|決定事項|决策|決策
Record decision|결정 기록|Entscheidung erfassen|Registrar decisión|Consigner la décision|Registra decisione|Registrar decisão|決定を記録|记录决策|記錄決策
Retry same request|동일 요청 재시도|Dieselbe Anfrage wiederholen|Reintentar la misma solicitud|Réessayer la même demande|Riprova la stessa richiesta|Repetir a mesma solicitação|同じリクエストを再試行|重试同一请求|重試相同請求
Create a work intent first.|먼저 작업 의도를 만드세요.|Zuerst eine Arbeitsabsicht erstellen.|Crea primero una intención de trabajo.|Créez d’abord une intention de travail.|Crea prima un intento di lavoro.|Crie primeiro uma intenção de trabalho.|先に作業意図を作成してください。|请先创建工作意图。|請先建立工作意圖。
Assignment|역할 배정|Zuweisung|Asignación|Affectation|Assegnazione|Atribuição|割り当て|分配|指派
Choose a published responsibility. Device, Agent and AI identities are pinned to that graph revision.|게시한 역할을 선택하세요. 장비·Agent·AI가 해당 그래프 판에 연결됩니다.|Veröffentlichte Rolle wählen. Gerät, Agent und KI bleiben an diese Graphversion gebunden.|Elige un rol publicado. Equipo, agente e IA quedan vinculados a esa revisión.|Choisissez un rôle publié. Machine, agent et IA sont liés à cette version du graphe.|Scegli un ruolo pubblicato. Dispositivo, agente e IA sono legati a quella revisione.|Escolha uma função publicada. Dispositivo, agente e IA ficam vinculados à revisão.|公開済みの役割を選択します。機器・Agent・AIはそのグラフ版に固定されます。|选择已发布职责，设备、Agent 和 AI 将绑定该图版本。|選擇已發布職責，裝置、Agent 與 AI 將綁定該圖版本。
Save assignment|배정 저장|Zuweisung speichern|Guardar asignación|Enregistrer l’affectation|Salva assegnazione|Salvar atribuição|割り当てを保存|保存分配|儲存指派
Open assigned node|배정 노드 열기|Zugewiesenen Knoten öffnen|Abrir nodo asignado|Ouvrir le nœud affecté|Apri nodo assegnato|Abrir nó atribuído|割り当てノードを開く|打开分配的节点|開啟指派節點
Prepare read-only role execution|읽기 전용 역할 실행 준비|Nur-Lese-Rolle vorbereiten|Preparar rol de solo lectura|Préparer le rôle en lecture seule|Prepara ruolo in sola lettura|Preparar função somente leitura|読み取り専用の役割実行を準備|准备执行只读角色|準備執行唯讀角色
Quality gates|품질 검증 관문|Qualitätsprüfungen|Controles de calidad|Contrôles qualité|Controlli qualità|Verificações de qualidade|品質ゲート|质量关卡|品質關卡
Record actual evidence for each gate. Manual review stays distinct from automated Run results. New attempts require new evidence.|관문별 실제 근거를 기록하세요. 수동 검토와 자동 실행 결과는 구분되며 새 시도에는 새 근거가 필요합니다.|Echte Belege je Prüfung erfassen. Manuelle Prüfung und automatische Ergebnisse bleiben getrennt. Neue Versuche brauchen neue Belege.|Registra pruebas reales. Separa revisión manual y resultados automáticos. Cada intento requiere nuevas pruebas.|Consignez les preuves réelles. Séparez revue manuelle et résultats automatiques. Chaque tentative exige de nouvelles preuves.|Registra prove reali. Distingui revisione manuale e risultati automatici. Ogni tentativo richiede nuove prove.|Registre evidências reais. Separe revisão manual e resultados automáticos. Cada tentativa exige novas evidências.|実際の根拠を記録します。手動レビューと自動実行結果は区別され、新しい試行には新しい根拠が必要です。|记录真实证据，区分人工审核与自动运行结果，新尝试需要新证据。|記錄真實證據，區分人工審查與自動執行結果，新嘗試需要新證據。
Category|분류|Kategorie|Categoría|Catégorie|Categoria|Categoria|分類|类别|分類
Evidence type|근거 종류|Belegart|Tipo de prueba|Type de preuve|Tipo di prova|Tipo de evidência|根拠の種類|证据类型|證據類型
Actual Run|실제 실행 기록|Tatsächlicher Lauf|Ejecución real|Exécution réelle|Esecuzione reale|Execução real|実際の実行記録|实际运行|實際執行
Manual review|수동 검토|Manuelle Prüfung|Revisión manual|Revue manuelle|Revisione manuale|Revisão manual|手動レビュー|人工审核|人工審查
Evidence or reuse rationale|근거 또는 재사용 사유|Beleg oder Wiederverwendungsgrund|Prueba o motivo de reutilización|Preuve ou motif de réutilisation|Prova o motivo del riuso|Evidência ou motivo de reutilização|根拠・再利用の理由|证据或复用理由|證據或重用理由
Record reviewed evidence|검토한 근거 기록|Geprüften Beleg erfassen|Registrar prueba revisada|Consigner la preuve vérifiée|Registra prova verificata|Registrar evidência revisada|確認した根拠を記録|记录已审核证据|記錄已審查證據
Project inbox is stored in Core. Sending a handoff does not execute work or contact external services.|프로젝트 수신함은 Core에 저장됩니다. 인계 전송은 작업 실행이나 외부 연락을 수행하지 않습니다.|Der Projekteingang liegt in Core. Übergaben starten keine Arbeit und kontaktieren keine externen Dienste.|El buzón se guarda en Core. Un traspaso no ejecuta tareas ni contacta servicios externos.|La boîte du projet est dans Core. Un transfert ne lance aucun travail ni contact externe.|La posta del progetto è in Core. Un passaggio non esegue lavori né contatta servizi esterni.|A caixa do projeto fica no Core. Uma transferência não executa tarefas nem contata serviços externos.|受信箱はCoreに保存されます。引き継ぎ送信で作業実行や外部連絡は行いません。|项目收件箱保存在 Core，交接不会执行工作或联系外部服务。|專案收件匣儲存在 Core，交接不會執行工作或聯絡外部服務。
New team message|새 팀 메시지|Neue Teamnachricht|Nuevo mensaje al equipo|Nouveau message d’équipe|Nuovo messaggio al team|Nova mensagem da equipe|新しいチームメッセージ|新团队消息|新團隊訊息
Message type|메시지 종류|Nachrichtentyp|Tipo de mensaje|Type de message|Tipo di messaggio|Tipo de mensagem|メッセージの種類|消息类型|訊息類型
Message|메시지|Nachricht|Mensaje|Message|Messaggio|Mensagem|メッセージ|消息|訊息
Send to project inbox|프로젝트 수신함에 보내기|An Projekteingang senden|Enviar al buzón del proyecto|Envoyer à la boîte du projet|Invia alla posta del progetto|Enviar à caixa do projeto|プロジェクト受信箱へ送信|发送到项目收件箱|傳送至專案收件匣
Recipient filter|받는 역할 필터|Empfängerfilter|Filtro de destinatario|Filtre de destinataire|Filtro destinatario|Filtro de destinatário|宛先フィルター|接收方筛选|收件角色篩選
Acknowledged|확인됨|Bestätigt|Confirmado|Accusé de réception|Confermato|Confirmado|確認済み|已确认|已確認
Acknowledge|수신 확인|Empfang bestätigen|Confirmar recepción|Accuser réception|Conferma ricezione|Confirmar recebimento|受信を確認|确认接收|確認接收
Use as rule feedback|규칙 제안에 사용|Als Regel-Feedback nutzen|Usar como comentario de regla|Utiliser pour une règle|Usa come feedback regola|Usar como feedback de regra|ルール提案に使用|用于规则反馈|用於規則回饋
Feedback becomes a rule only after explicit approval. Ready work retains its reviewed rules; revise and mark ready to adopt new rules.|명시적으로 승인한 제안만 규칙이 됩니다. 준비된 작업의 규칙은 유지되며 새 규칙은 작업 의도를 수정·승인해야 반영됩니다.|Nur ausdrücklich genehmigtes Feedback wird zur Regel. Bereite Arbeit behält geprüfte Regeln; neue Regeln erfordern Überarbeitung und Bestätigung.|Solo las propuestas aprobadas se vuelven reglas. El trabajo preparado conserva sus reglas; revisa y confirma para adoptar otras.|Seules les propositions approuvées deviennent des règles. Le travail prêt garde ses règles ; révisez et confirmez pour en adopter de nouvelles.|Solo le proposte approvate diventano regole. Il lavoro pronto mantiene le sue regole; rivedi e conferma per adottarne altre.|Somente propostas aprovadas viram regras. O trabalho preparado mantém suas regras; revise e confirme para adotar novas.|明示的に承認した提案のみルールになります。準備済み作業は既存ルールを保持し、新ルールの反映には意図の改訂と承認が必要です。|只有明确批准的建议才成为规则。已就绪工作保留原规则，采用新规则须修订并确认意图。|只有明確核准的建議才成為規則。已就緒工作保留原規則，採用新規則須修訂並確認意圖。
Propose project rule|프로젝트 규칙 제안|Projektregel vorschlagen|Proponer regla del proyecto|Proposer une règle du projet|Proponi regola del progetto|Propor regra do projeto|プロジェクトルールを提案|提议项目规则|提議專案規則
Scope|적용 범위|Geltungsbereich|Ámbito|Portée|Ambito|Escopo|適用範囲|范围|範圍
Source feedback|근거 피드백|Quellfeedback|Comentario de origen|Commentaire source|Feedback di origine|Feedback de origem|根拠フィードバック|来源反馈|來源回饋
Decision or request|결정 또는 요청|Entscheidung oder Anfrage|Decisión o solicitud|Décision ou demande|Decisione o richiesta|Decisão ou solicitação|決定または依頼|决策或请求|決策或請求
Rule|규칙|Regel|Regla|Règle|Regola|Regra|ルール|规则|規則
Save rule proposal|규칙 제안 저장|Regelvorschlag speichern|Guardar propuesta de regla|Enregistrer la proposition|Salva proposta di regola|Salvar proposta de regra|ルール案を保存|保存规则建议|儲存規則建議
Approve rule|규칙 승인|Regel genehmigen|Aprobar regla|Approuver la règle|Approva regola|Aprovar regra|ルールを承認|批准规则|核准規則
Retire rule|규칙 사용 중지|Regel außer Kraft setzen|Retirar regla|Retirer la règle|Ritira regola|Desativar regra|ルールを無効化|停用规则|停用規則
Rules pinned to selected intent|선택한 작업에 고정된 규칙|Gebundene Regeln dieser Absicht|Reglas fijadas a esta intención|Règles liées à cette intention|Regole fissate a questo intento|Regras fixadas nesta intenção|選択した作業に固定したルール|已绑定到所选意图的规则|已綁定至所選意圖的規則
Inbox|수신함|Posteingang|Buzón|Boîte de réception|Posta in arrivo|Caixa de entrada|受信箱|收件箱|收件匣
Project rules|프로젝트 규칙|Projektregeln|Reglas del proyecto|Règles du projet|Regole del progetto|Regras do projeto|プロジェクトルール|项目规则|專案規則
handoff|인계|Übergabe|Traspaso|Transfert|Passaggio|Transferência|引き継ぎ|交接|交接
request|요청|Anfrage|Solicitud|Demande|Richiesta|Solicitação|依頼|请求|請求
question|질문|Frage|Pregunta|Question|Domanda|Pergunta|質問|问题|問題
not-run|미실행|Nicht ausgeführt|Sin ejecutar|Non exécuté|Non eseguito|Não executado|未実行|未运行|未執行
not-applicable|해당 없음|Nicht zutreffend|No aplicable|Sans objet|Non applicabile|Não aplicável|対象外|不适用|不適用
reused|유효 근거 재사용|Gültige Belege wiederverwendet|Prueba válida reutilizada|Preuve valide réutilisée|Prova valida riutilizzata|Evidência válida reutilizada|有効な根拠を再利用|复用有效证据|重用有效證據
retired|사용 중지|Außer Kraft|Retirada|Retirée|Ritirata|Desativada|無効|已停用|已停用
Graph revision|그래프 판|Graphversion|Revisión del grafo|Version du graphe|Revisione grafo|Revisão do grafo|グラフの版|图版本|圖版本
AI profile|AI 구성|KI-Profil|Perfil IA|Profil IA|Profilo IA|Perfil IA|AI構成|AI 配置|AI 設定
screen|화면 검수|Bildschirmprüfung|Revisión de pantalla|Vérification de l’écran|Verifica schermata|Revisão da tela|画面確認|界面检查|畫面檢查
documentation|문서 검수|Dokumentationsprüfung|Revisión de documentación|Vérification documentaire|Verifica documentazione|Revisão de documentação|文書確認|文档检查|文件檢查
report|결과 보고|Ergebnisbericht|Informe de resultados|Rapport de résultats|Rapporto risultati|Relatório de resultados|結果報告|结果报告|結果報告
tests|테스트|Tests|Pruebas|Tests|Test|Testes|テスト|测试|測試
lint|정적 검사|Statische Prüfung|Análisis estático|Analyse statique|Analisi statica|Análise estática|静的解析|静态检查|靜態檢查
New intent|새 작업 의도|Neue Arbeitsabsicht|Nueva intención|Nouvelle intention|Nuovo intento|Nova intenção|新しい作業意図|新工作意图|新工作意圖
Sender role|보내는 역할|Absenderrolle|Rol remitente|Rôle expéditeur|Ruolo mittente|Função remetente|送信元の役割|发送角色|寄件角色
Recipient role|받는 역할|Empfängerrolle|Rol destinatario|Rôle destinataire|Ruolo destinatario|Função destinatária|宛先の役割|接收角色|收件角色
review|검토|Prüfung|Revisión|Revue|Revisione|Revisão|レビュー|审查|審查
proposed|제안됨|Vorgeschlagen|Propuesta|Proposée|Proposta|Proposta|提案済み|已提议|已提議
approved|승인됨|Genehmigt|Aprobada|Approuvée|Approvata|Aprovada|承認済み|已批准|已核准
Team execution Agent|팀 실행 Agent|Team-Ausführungsagent|Agente de ejecución del equipo|Agent d’exécution d’équipe|Agente di esecuzione del team|Agente de execução da equipe|チーム実行Agent|团队执行 Agent|團隊執行 Agent
Team draft added. Save AI profiles and graph before publishing.|팀 초안을 추가했습니다. AI 구성과 그래프를 저장한 뒤 게시하세요.|Teamvorlage hinzugefügt. KI-Profile und Graph vor Veröffentlichung speichern.|Borrador añadido. Guarda perfiles IA y grafo antes de publicar.|Ébauche ajoutée. Enregistrez profils IA et graphe avant publication.|Bozza aggiunta. Salva profili IA e grafo prima di pubblicare.|Rascunho adicionado. Salve perfis IA e grafo antes de publicar.|チーム案を追加しました。AI構成とグラフを保存してから公開してください。|已添加团队草案，请先保存 AI 配置和图再发布。|已新增團隊草稿，請先儲存 AI 設定和圖再發布。
Device|장비|Gerät|Equipo|Machine|Dispositivo|Dispositivo|機器|设备|裝置
Intent needs review.|작업 의도를 검토하고 준비 상태로 승인하세요.|Arbeitsabsicht prüfen und bestätigen.|Revisa y confirma la intención.|Vérifiez et confirmez l’intention.|Verifica e conferma l’intento.|Revise e confirme a intenção.|作業意図を確認して承認してください。|请审核并确认工作意图。|請審查並確認工作意圖。
Choose an assignment from the published graph.|게시된 그래프에서 담당 역할을 배정하세요.|Rolle aus veröffentlichtem Graph zuweisen.|Asigna un rol del grafo publicado.|Affectez un rôle du graphe publié.|Assegna un ruolo dal grafo pubblicato.|Atribua uma função do grafo publicado.|公開済みグラフで役割を割り当ててください。|请从已发布的图分配角色。|請從已發布的圖指派角色。
Graph, AI profile or intent changed. Review assignment.|그래프·AI 구성·작업 의도가 변경되었습니다. 배정을 다시 검토하세요.|Graph, KI-Profil oder Absicht geändert. Zuweisung prüfen.|Cambió el grafo, perfil IA o intención. Revisa la asignación.|Graphe, profil IA ou intention modifié. Vérifiez l’affectation.|Grafo, profilo IA o intento cambiato. Verifica l’assegnazione.|Grafo, perfil IA ou intenção alterados. Revise a atribuição.|グラフ・AI構成・作業意図が変わりました。割り当てを再確認してください。|图、AI 配置或工作意图已更改，请重新审核分配。|圖、AI 設定或工作意圖已變更，請重新審查指派。
Agent is unavailable.|Agent가 연결되어 있지 않거나 사용할 수 없습니다.|Agent ist nicht verfügbar.|El agente no está disponible.|L’agent est indisponible.|L’agente non è disponibile.|O agente está indisponível.|Agentは接続されていないか利用できません。|Agent 未连接或不可用。|Agent 未連線或無法使用。
Agent is busy.|Agent가 다른 작업을 실행 중입니다.|Agent ist beschäftigt.|El agente está ocupado.|L’agent est occupé.|L’agente è occupato.|O agente está ocupado.|Agentは別の作業を実行中です。|Agent 正在执行其他工作。|Agent 正在執行其他工作。`;
export const teamWorkflowMessages:Partial<Record<Language,Record<string,string>>>=Object.fromEntries(languages.map((lang,index)=>[lang,Object.fromEntries(rows.split('\n').map(row=>{const cells=row.split('|');if(cells.length!==10)throw Error('Invalid team translation row: '+cells[0]);return[cells[0],cells[index+1]];}))]));
