import {additionalLanguages} from './international.ts';
const rows=`AI Analysis|KI-Analyse|Análisis de IA|Analyse IA|Analisi IA|Análise de IA|AI 分析|AI 分析|AI 分析
AI conversation|KI-Unterhaltung|Conversación con IA|Conversation IA|Conversazione IA|Conversa com IA|AI 会話|AI 对话|AI 對話
Analysis history|Analyseverlauf|Historial de análisis|Historique des analyses|Cronologia analisi|Histórico de análises|分析履歴|分析历史|分析歷程
Analysis request|Analyseanfrage|Solicitud de análisis|Demande d'analyse|Richiesta di analisi|Solicitação de análise|分析リクエスト|分析请求|分析要求
Analyze|Analysieren|Analizar|Analyser|Analizza|Analisar|分析|分析|分析
Analyze Failure|Fehler analysieren|Analizar fallo|Analyser l'échec|Analizza errore|Analisar falha|失敗を分析|分析失败|分析失敗
Analyze Retest Failure|Retest-Fehler analysieren|Analizar fallo de repetición|Analyser l'échec du nouveau test|Analizza errore del nuovo test|Analisar falha do novo teste|再テストの失敗を分析|分析重新测试失败|分析重新測試失敗
Analyze evidence and suggest a fix|Nachweise analysieren und Korrektur vorschlagen|Analizar evidencias y proponer solución|Analyser les preuves et proposer un correctif|Analizza prove e proponi correzione|Analisar evidências e sugerir correção|証跡を分析して修正を提案|分析证据并提出修复建议|分析證據並提出修正建議
Ask about this project|Frage zu diesem Projekt|Pregunta sobre este proyecto|Question sur ce projet|Domanda su questo progetto|Pergunte sobre este projeto|このプロジェクトについて質問|询问此项目|詢問此專案
Project assistant|Projektassistent|Asistente del proyecto|Assistant du projet|Assistente del progetto|Assistente do projeto|プロジェクトアシスタント|项目助手|專案助理
Open AI assistant|KI-Assistent öffnen|Abrir asistente de IA|Ouvrir l'assistant IA|Apri assistente IA|Abrir assistente de IA|AI アシスタントを開く|打开 AI 助手|開啟 AI 助理
New conversation|Neue Unterhaltung|Nueva conversación|Nouvelle conversation|Nuova conversazione|Nova conversa|新しい会話|新对话|新對話
Send|Senden|Enviar|Envoyer|Invia|Enviar|送信|发送|傳送
Current file|Aktuelle Datei|Archivo actual|Fichier actuel|File corrente|Arquivo atual|現在のファイル|当前文件|目前檔案
Selected code|Ausgewählter Code|Código seleccionado|Code sélectionné|Codice selezionato|Código selecionado|選択したコード|选中的代码|選取的程式碼
Current project|Aktuelles Projekt|Proyecto actual|Projet actuel|Progetto corrente|Projeto atual|現在のプロジェクト|当前项目|目前專案
Context|Kontext|Contexto|Contexte|Contesto|Contexto|コンテキスト|上下文|內容脈絡
Explain a function or find related code|Funktion erklären oder zugehörigen Code suchen|Explicar función o buscar código relacionado|Expliquer une fonction ou trouver du code lié|Spiega una funzione o trova codice correlato|Explicar função ou encontrar código relacionado|関数を説明または関連コードを検索|解释函数或查找相关代码|解釋函式或尋找相關程式碼
Failure analysis|Fehleranalyse|Análisis de fallos|Analyse des échecs|Analisi degli errori|Análise de falhas|失敗分析|失败分析|失敗分析
Observed failure|Beobachteter Fehler|Fallo observado|Échec observé|Errore osservato|Falha observada|観測された失敗|观察到的失败|觀察到的失敗
Root cause candidates|Mögliche Ursachen|Posibles causas raíz|Causes racines possibles|Possibili cause principali|Possíveis causas raiz|根本原因の候補|根本原因候选|根本原因候選
Related source|Zugehöriger Quellcode|Código fuente relacionado|Code source lié|Sorgente correlato|Código relacionado|関連ソース|相关源代码|相關原始碼
Fix proposal|Korrekturvorschlag|Propuesta de corrección|Proposition de correctif|Proposta di correzione|Proposta de correção|修正案|修复提案|修正提案
Proposed change|Vorgeschlagene Änderung|Cambio propuesto|Modification proposée|Modifica proposta|Alteração proposta|変更案|建议更改|建議變更
Proposed diff|Vorgeschlagener Diff|Diferencias propuestas|Différences proposées|Diff proposto|Diferenças propostas|提案された差分|建议差异|建議差異
Close proposal|Vorschlag schließen|Cerrar propuesta|Fermer la proposition|Chiudi proposta|Fechar proposta|提案を閉じる|关闭提案|關閉提案
Apply|Anwenden|Aplicar|Appliquer|Applica|Aplicar|適用|应用|套用
Reject|Ablehnen|Rechazar|Rejeter|Rifiuta|Rejeitar|却下|拒绝|拒絕
Expected impact:|Erwartete Auswirkung:|Impacto esperado:|Impact attendu :|Impatto previsto:|Impacto esperado:|予想される影響：|预期影响：|預期影響：
Suggested tests:|Empfohlene Tests:|Pruebas sugeridas:|Tests suggérés :|Test suggeriti:|Testes sugeridos:|推奨テスト：|建议测试：|建議測試：
Uncertainty:|Unsicherheit:|Incertidumbre:|Incertitude :|Incertezza:|Incerteza:|不確実性：|不确定性：|不確定性：
Changed files:|Geänderte Dateien:|Archivos modificados:|Fichiers modifiés :|File modificati:|Arquivos alterados:|変更ファイル：|更改的文件：|變更的檔案：
None applied|Nichts angewendet|Nada aplicado|Rien d'appliqué|Nessuna modifica applicata|Nada aplicado|未適用|未应用|未套用
Saved Disk Diff|Gespeicherter Disk-Diff|Diferencias guardadas en disco|Différences enregistrées sur disque|Diff salvato su disco|Diferenças salvas no disco|保存済みディスク差分|已保存磁盘差异|已儲存磁碟差異
Actual Git Diff|Tatsächlicher Git-Diff|Diferencias reales de Git|Différences Git réelles|Diff Git effettivo|Diferenças reais do Git|実際の Git 差分|实际 Git 差异|實際 Git 差異
Refresh Disk Diff|Disk-Diff aktualisieren|Actualizar diferencias del disco|Actualiser les différences sur disque|Aggiorna diff su disco|Atualizar diferenças do disco|ディスク差分を更新|刷新磁盘差异|重新整理磁碟差異
Compare proposal|Vorschlag vergleichen|Comparar propuesta|Comparer la proposition|Confronta proposta|Comparar proposta|提案を比較|比较提案|比較提案
Validate Locally|Lokal prüfen|Validar localmente|Valider localement|Convalida localmente|Validar localmente|ローカル検証|本地验证|本機驗證
Validate and Remote Retest|Prüfen und remote erneut testen|Validar y repetir prueba remota|Valider et retester à distance|Convalida e ripeti test remoto|Validar e testar novamente remotamente|検証とリモート再テスト|验证并远程重新测试|驗證並遠端重新測試
Revert AI Changes|KI-Änderungen zurücknehmen|Revertir cambios de IA|Annuler les modifications IA|Ripristina modifiche IA|Reverter alterações de IA|AI の変更を元に戻す|还原 AI 更改|還原 AI 變更
Cancel Retest|Retest abbrechen|Cancelar repetición|Annuler le nouveau test|Annulla nuovo test|Cancelar novo teste|再テストをキャンセル|取消重新测试|取消重新測試
Attempt History · maximum|Versuchsverlauf · maximal|Historial de intentos · máximo|Historique des tentatives · maximum|Cronologia tentativi · massimo|Histórico de tentativas · máximo|試行履歴・最大|尝试历史·上限|嘗試歷程·上限
Fix attempts · maximum|Korrekturversuche · maximal|Intentos de corrección · máximo|Tentatives de correction · maximum|Tentativi di correzione · massimo|Tentativas de correção · máximo|修正試行・最大|修复尝试·上限|修正嘗試·上限
Proposal / Diff / Revert|Vorschlag / Diff / Zurücknehmen|Propuesta / Diferencias / Revertir|Proposition / Diff / Annuler|Proposta / Diff / Ripristino|Proposta / Diferenças / Reverter|提案 / 差分 / 復元|提案 / 差异 / 还原|提案 / 差異 / 還原
New Schedule|Neue Planung|Nueva programación|Nouvelle planification|Nuova pianificazione|Novo agendamento|新規スケジュール|新建计划|新增排程
Schedules|Zeitpläne|Programaciones|Planifications|Pianificazioni|Agendamentos|スケジュール|计划|排程
Schedule settings|Planungseinstellungen|Configuración de programación|Paramètres de planification|Impostazioni pianificazione|Configurações de agendamento|スケジュール設定|计划设置|排程設定
Schedule History|Planungsverlauf|Historial de programación|Historique de planification|Cronologia pianificazione|Histórico de agendamento|スケジュール履歴|计划历史|排程歷程
Save Schedule|Planung speichern|Guardar programación|Enregistrer la planification|Salva pianificazione|Salvar agendamento|スケジュールを保存|保存计划|儲存排程
Enable Schedule|Planung aktivieren|Activar programación|Activer la planification|Abilita pianificazione|Ativar agendamento|スケジュールを有効化|启用计划|啟用排程
Disable Schedule|Planung deaktivieren|Desactivar programación|Désactiver la planification|Disabilita pianificazione|Desativar agendamento|スケジュールを無効化|禁用计划|停用排程
Delete Disabled Schedule|Deaktivierte Planung löschen|Eliminar programación desactivada|Supprimer la planification désactivée|Elimina pianificazione disabilitata|Excluir agendamento desativado|無効なスケジュールを削除|删除已禁用计划|刪除已停用排程
Run Now|Jetzt ausführen|Ejecutar ahora|Exécuter maintenant|Esegui ora|Executar agora|今すぐ実行|立即运行|立即執行
Trigger type|Auslösertyp|Tipo de activador|Type de déclencheur|Tipo di attivazione|Tipo de gatilho|トリガーの種類|触发类型|觸發類型
Timezone|Zeitzone|Zona horaria|Fuseau horaire|Fuso orario|Fuso horário|タイムゾーン|时区|時區
Cron expression|Cron-Ausdruck|Expresión cron|Expression cron|Espressione cron|Expressão cron|Cron 式|Cron 表达式|Cron 運算式
Cron (5 fields)|Cron (5 Felder)|Cron (5 campos)|Cron (5 champs)|Cron (5 campi)|Cron (5 campos)|Cron（5 フィールド）|Cron（5 个字段）|Cron（5 個欄位）
Interval|Intervall|Intervalo|Intervalle|Intervallo|Intervalo|間隔|间隔|間隔
Interval seconds (minimum60)|Intervall in Sekunden (mindestens 60)|Intervalo en segundos (mínimo 60)|Intervalle en secondes (minimum 60)|Intervallo in secondi (minimo 60)|Intervalo em segundos (mínimo 60)|間隔秒数（最小 60）|间隔秒数（至少 60）|間隔秒數（至少 60）
One-time (ISO timestamp)|Einmalig (ISO-Zeitstempel)|Una vez (marca de tiempo ISO)|Ponctuel (horodatage ISO)|Una tantum (timestamp ISO)|Uma vez (data e hora ISO)|一回限り（ISO 時刻）|一次性（ISO 时间戳）|單次（ISO 時間戳記）
Execution time (ISO with offset or Z)|Ausführungszeit (ISO mit Offset oder Z)|Hora de ejecución (ISO con zona o Z)|Heure d'exécution (ISO avec décalage ou Z)|Ora esecuzione (ISO con offset o Z)|Horário de execução (ISO com deslocamento ou Z)|実行時刻（オフセットまたは Z 付き ISO）|执行时间（带偏移或 Z 的 ISO）|執行時間（含偏移或 Z 的 ISO）
Manual|Manuell|Manual|Manuel|Manuale|Manual|手動|手动|手動
Next Run|Nächste Ausführung|Próxima ejecución|Prochaine exécution|Prossima esecuzione|Próxima execução|次回実行|下次运行|下次執行
Last Trigger|Letzter Auslöser|Último activador|Dernier déclenchement|Ultima attivazione|Último gatilho|前回のトリガー|上次触发|上次觸發
Never|Nie|Nunca|Jamais|Mai|Nunca|なし|从未|從未
Latest result|Letztes Ergebnis|Último resultado|Dernier résultat|Ultimo risultato|Último resultado|最新の結果|最新结果|最新結果
Continuous testing|Kontinuierliches Testen|Pruebas continuas|Tests continus|Test continui|Testes contínuos|継続的テスト|持续测试|持續測試
Sync saved Protocol|Gespeichertes Protocol synchronisieren|Sincronizar protocolo guardado|Synchroniser le protocole enregistré|Sincronizza protocollo salvato|Sincronizar protocolo salvo|保存した Protocol を同期|同步已保存协议|同步已儲存協定
Protocol Test|Protocol-Test|Prueba del protocolo|Test du protocole|Test del protocollo|Teste do protocolo|Protocol テスト|协议测试|協定測試
Protocol Task|Protocol-Aufgabe|Tarea del protocolo|Tâche du protocole|Attività del protocollo|Tarefa do protocolo|Protocol タスク|协议任务|協定工作
Source Run / Test|Quelllauf / Test|Ejecución origen / Prueba|Exécution source / Test|Esecuzione origine / Test|Execução de origem / Teste|元の実行 / テスト|源运行 / 测试|來源執行 / 測試
Issue Candidate|Issue-Kandidat|Incidencia candidata|Ticket candidat|Issue candidata|Issue candidata|Issue 候補|候选问题|候選議題
Issue Candidates|Issue-Kandidaten|Incidencias candidatas|Tickets candidats|Issue candidate|Issues candidatas|Issue 候補|候选问题|候選議題
Project issues|Projekt-Issues|Incidencias del proyecto|Tickets du projet|Issue del progetto|Issues do projeto|プロジェクトの Issue|项目问题|專案議題
Create Candidate|Kandidaten erstellen|Crear candidato|Créer un candidat|Crea candidato|Criar candidato|候補を作成|创建候选|建立候選
Create Issue Candidate|Issue-Kandidaten erstellen|Crear incidencia candidata|Créer un ticket candidat|Crea issue candidata|Criar issue candidata|Issue 候補を作成|创建候选问题|建立候選議題
Dismiss Candidate|Kandidaten verwerfen|Descartar candidato|Écarter le candidat|Scarta candidato|Dispensar candidato|候補を破棄|放弃候选|捨棄候選
Linked Issues|Verknüpfte Issues|Incidencias vinculadas|Tickets liés|Issue collegate|Issues vinculadas|リンクした Issue|已关联问题|已連結議題
Title|Titel|Título|Titre|Titolo|Título|タイトル|标题|標題
Body / Review|Inhalt / Prüfung|Cuerpo / Revisión|Corps / Relecture|Testo / Revisione|Corpo / Revisão|本文 / レビュー|正文 / 审核|本文 / 審核
Labels (existing GitHub labels, optional)|Labels (bestehende GitHub-Labels, optional)|Etiquetas existentes de GitHub (opcional)|Étiquettes GitHub existantes (facultatif)|Etichette GitHub esistenti (facoltativo)|Rótulos existentes do GitHub (opcional)|既存の GitHub ラベル（任意）|标签（已有 GitHub 标签，可选）|標籤（現有 GitHub 標籤，選填）
Save Review|Prüfung speichern|Guardar revisión|Enregistrer la relecture|Salva revisione|Salvar revisão|レビューを保存|保存审核|儲存審核
Search Duplicates|Duplikate suchen|Buscar duplicados|Rechercher les doublons|Cerca duplicati|Pesquisar duplicatas|重複を検索|搜索重复项|搜尋重複項目
Possible duplicates|Mögliche Duplikate|Posibles duplicados|Doublons possibles|Possibili duplicati|Possíveis duplicatas|重複の候補|可能的重复项|可能的重複項目
Search before creating.|Vor dem Erstellen suchen.|Busca antes de crear.|Recherchez avant de créer.|Cerca prima di creare.|Pesquise antes de criar.|作成前に検索してください。|创建前请先搜索。|建立前請先搜尋。
Review and Create GitHub Issue|Prüfen und GitHub-Issue erstellen|Revisar y crear incidencia de GitHub|Relire et créer un ticket GitHub|Rivedi e crea issue GitHub|Revisar e criar issue no GitHub|確認して GitHub Issue を作成|审核并创建 GitHub 问题|審核並建立 GitHub 議題
Link Existing #|Bestehendes verknüpfen #|Vincular existente #|Lier un ticket existant #|Collega esistente #|Vincular existente #|既存にリンク #|关联现有 #|連結現有 #
Reconcile Uncertain Create|Unklare Erstellung abgleichen|Reconciliar creación incierta|Vérifier la création incertaine|Verifica creazione incerta|Reconciliar criação incerta|不明な作成結果を確認|核对不确定的创建结果|核對不確定的建立結果
GitHub repository not configured|GitHub-Repository nicht konfiguriert|Repositorio GitHub no configurado|Dépôt GitHub non configuré|Repository GitHub non configurato|Repositório GitHub não configurado|GitHub リポジトリ未設定|未配置 GitHub 仓库|未設定 GitHub 儲存庫
Add run configuration|Ausführungskonfiguration hinzufügen|Añadir configuración de ejecución|Ajouter une configuration d'exécution|Aggiungi configurazione esecuzione|Adicionar configuração de execução|実行構成を追加|添加运行配置|新增執行設定
Edit run configuration|Ausführungskonfiguration bearbeiten|Editar configuración de ejecución|Modifier la configuration d'exécution|Modifica configurazione esecuzione|Editar configuração de execução|実行構成を編集|编辑运行配置|編輯執行設定
Delete run configuration?|Ausführungskonfiguration löschen?|¿Eliminar configuración de ejecución?|Supprimer la configuration d'exécution ?|Eliminare configurazione esecuzione?|Excluir configuração de execução?|実行構成を削除しますか？|删除运行配置？|刪除執行設定？
Delete configuration|Konfiguration löschen|Eliminar configuración|Supprimer la configuration|Elimina configurazione|Excluir configuração|構成を削除|删除配置|刪除設定
Save configuration|Konfiguration speichern|Guardar configuración|Enregistrer la configuration|Salva configurazione|Salvar configuração|構成を保存|保存配置|儲存設定
Configuration|Konfiguration|Configuración|Configuration|Configurazione|Configuração|構成|配置|設定
Run Configurations|Ausführungskonfigurationen|Configuraciones de ejecución|Configurations d'exécution|Configurazioni esecuzione|Configurações de execução|実行構成|运行配置|執行設定
Executable|Programm|Ejecutable|Exécutable|Eseguibile|Executável|実行ファイル|可执行文件|執行檔
Arguments (JSON array)|Argumente (JSON-Array)|Argumentos (matriz JSON)|Arguments (tableau JSON)|Argomenti (array JSON)|Argumentos (array JSON)|引数（JSON 配列）|参数（JSON 数组）|引數（JSON 陣列）
Environment (JSON object)|Umgebung (JSON-Objekt)|Entorno (objeto JSON)|Environnement (objet JSON)|Ambiente (oggetto JSON)|Ambiente (objeto JSON)|環境変数（JSON オブジェクト）|环境变量（JSON 对象）|環境變數（JSON 物件）
Working directory|Arbeitsverzeichnis|Directorio de trabajo|Répertoire de travail|Directory di lavoro|Diretório de trabalho|作業ディレクトリ|工作目录|工作目錄
Timeout (seconds)|Zeitlimit (Sekunden)|Tiempo límite (segundos)|Délai (secondes)|Timeout (secondi)|Tempo limite (segundos)|タイムアウト（秒）|超时（秒）|逾時（秒）
Development|Entwicklung|Desarrollo|Développement|Sviluppo|Desenvolvimento|開発|开发|開發
Development Server|Entwicklungsserver|Servidor de desarrollo|Serveur de développement|Server di sviluppo|Servidor de desenvolvimento|開発サーバー|开发服务器|開發伺服器
Open shell|Shell öffnen|Abrir shell|Ouvrir un shell|Apri shell|Abrir shell|シェルを開く|打开 Shell|開啟 Shell
Terminal screen|Terminalanzeige|Pantalla del terminal|Écran du terminal|Schermata terminale|Tela do terminal|ターミナル画面|终端屏幕|終端機畫面
Clear terminal|Terminal leeren|Limpiar terminal|Effacer le terminal|Pulisci terminale|Limpar terminal|ターミナルをクリア|清空终端|清除終端機
Clear output|Ausgabe leeren|Limpiar salida|Effacer la sortie|Pulisci output|Limpar saída|出力をクリア|清空输出|清除輸出
Close terminal|Terminal schließen|Cerrar terminal|Fermer le terminal|Chiudi terminale|Fechar terminal|ターミナルを閉じる|关闭终端|關閉終端機
Focus terminal|Terminal fokussieren|Enfocar terminal|Activer le terminal|Attiva terminale|Focar terminal|ターミナルにフォーカス|聚焦终端|聚焦終端機
Stop terminal process|Terminalprozess stoppen|Detener proceso del terminal|Arrêter le processus du terminal|Ferma processo terminale|Parar processo do terminal|ターミナルプロセスを停止|停止终端进程|停止終端機處理程序
Loading terminal…|Terminal wird geladen…|Cargando terminal…|Chargement du terminal…|Caricamento terminale…|Carregando terminal…|ターミナルを読み込み中…|正在加载终端…|正在載入終端機…
Loading configurations…|Konfigurationen werden geladen…|Cargando configuraciones…|Chargement des configurations…|Caricamento configurazioni…|Carregando configurações…|構成を読み込み中…|正在加载配置…|正在載入設定…
Task output|Aufgabenausgabe|Salida de tarea|Sortie de tâche|Output attività|Saída da tarefa|タスク出力|任务输出|工作輸出
Studio & task output|Studio- und Aufgabenausgabe|Salida de Studio y tareas|Sortie Studio et tâches|Output Studio e attività|Saída do Studio e tarefas|Studio とタスクの出力|Studio 和任务输出|Studio 與工作輸出
Process|Prozess|Proceso|Processus|Processo|Processo|プロセス|进程|處理程序
Exit|Exit-Code|Salida|Sortie|Uscita|Saída|終了コード|退出码|結束碼
Load folder|Ordner laden|Cargar carpeta|Charger un dossier|Carica cartella|Carregar pasta|フォルダーを読み込む|加载文件夹|載入資料夾
Reconnect Folder|Ordner erneut verbinden|Reconectar carpeta|Reconnecter le dossier|Ricollega cartella|Reconectar pasta|フォルダーを再接続|重新连接文件夹|重新連接資料夾
Disconnect folder|Ordner trennen|Desconectar carpeta|Déconnecter le dossier|Scollega cartella|Desconectar pasta|フォルダーを切断|断开文件夹|中斷資料夾連接
Request access|Zugriff anfordern|Solicitar acceso|Demander l'accès|Richiedi accesso|Solicitar acesso|アクセスを要求|请求访问权限|要求存取權限
Refresh Explorer|Explorer aktualisieren|Actualizar explorador|Actualiser l'explorateur|Aggiorna Esplora file|Atualizar explorador|エクスプローラーを更新|刷新资源管理器|重新整理檔案總管
Refresh expanded folders|Geöffnete Ordner aktualisieren|Actualizar carpetas expandidas|Actualiser les dossiers développés|Aggiorna cartelle espanse|Atualizar pastas expandidas|展開したフォルダーを更新|刷新展开的文件夹|重新整理展開的資料夾
Show ignored folders|Ignorierte Ordner anzeigen|Mostrar carpetas ignoradas|Afficher les dossiers ignorés|Mostra cartelle ignorate|Mostrar pastas ignoradas|除外フォルダーを表示|显示忽略的文件夹|顯示忽略的資料夾
Workspace files|Arbeitsbereichsdateien|Archivos del espacio de trabajo|Fichiers de l'espace de travail|File dell'area di lavoro|Arquivos do espaço de trabalho|ワークスペースのファイル|工作区文件|工作區檔案
Workspace root|Arbeitsbereichsroot|Raíz del espacio de trabajo|Racine de l'espace de travail|Radice dell'area di lavoro|Raiz do espaço de trabalho|ワークスペースのルート|工作区根目录|工作區根目錄
New file|Neue Datei|Nuevo archivo|Nouveau fichier|Nuovo file|Novo arquivo|新規ファイル|新建文件|新增檔案
New folder|Neuer Ordner|Nueva carpeta|Nouveau dossier|Nuova cartella|Nova pasta|新規フォルダー|新建文件夹|新增資料夾
Rename selected entry|Ausgewählten Eintrag umbenennen|Renombrar elemento seleccionado|Renommer l'élément sélectionné|Rinomina elemento selezionato|Renomear item selecionado|選択項目の名前を変更|重命名选中项|重新命名選取項目
Delete selected entry|Ausgewählten Eintrag löschen|Eliminar elemento seleccionado|Supprimer l'élément sélectionné|Elimina elemento selezionato|Excluir item selecionado|選択項目を削除|删除选中项|刪除選取項目
Empty folder|Leerer Ordner|Carpeta vacía|Dossier vide|Cartella vuota|Pasta vazia|空のフォルダー|空文件夹|空資料夾
Empty workspace|Leerer Arbeitsbereich|Espacio de trabajo vacío|Espace de travail vide|Area di lavoro vuota|Espaço de trabalho vazio|空のワークスペース|空工作区|空工作區
Reading folder…|Ordner wird gelesen…|Leyendo carpeta…|Lecture du dossier…|Lettura cartella…|Lendo pasta…|フォルダーを読み取り中…|正在读取文件夹…|正在讀取資料夾…
Checking folder access…|Ordnerzugriff wird geprüft…|Comprobando acceso a carpeta…|Vérification de l'accès au dossier…|Verifica accesso cartella…|Verificando acesso à pasta…|フォルダーアクセスを確認中…|正在检查文件夹访问权限…|正在檢查資料夾存取權限…
Dismiss file notification|Dateimeldung schließen|Descartar notificación de archivo|Fermer la notification de fichier|Chiudi notifica file|Dispensar notificação de arquivo|ファイル通知を閉じる|关闭文件通知|關閉檔案通知
Read-only Git diff|Schreibgeschützter Git-Diff|Diferencias Git de solo lectura|Différences Git en lecture seule|Diff Git in sola lettura|Diferenças Git somente leitura|読み取り専用 Git 差分|只读 Git 差异|唯讀 Git 差異
Unborn branch|Branch ohne Commit|Rama sin commits|Branche sans commit|Branch senza commit|Branch sem commit|コミットのないブランチ|尚无提交的分支|尚無提交的分支
Detached HEAD|Losgelöster HEAD|HEAD separado|HEAD détachée|HEAD scollegato|HEAD separado|分離した HEAD|分离的 HEAD|分離的 HEAD
Repository not detected|Repository nicht erkannt|Repositorio no detectado|Dépôt non détecté|Repository non rilevato|Repositório não detectado|リポジトリを検出できません|未检测到仓库|未偵測到儲存庫
Only staged changes are committed.|Nur vorgemerkte Änderungen werden committet.|Solo se confirman cambios preparados.|Seules les modifications indexées sont validées.|Si esegue il commit solo delle modifiche in staging.|Somente alterações preparadas são confirmadas.|ステージ済み変更のみコミットされます。|仅提交已暂存更改。|僅提交已暫存變更。
History is unavailable.|Verlauf nicht verfügbar.|Historial no disponible.|Historique indisponible.|Cronologia non disponibile.|Histórico indisponível.|履歴を利用できません。|历史记录不可用。|歷程紀錄無法使用。
Showing the latest 50 commits.|Die letzten 50 Commits werden angezeigt.|Se muestran los últimos 50 commits.|Affichage des 50 derniers commits.|Visualizzazione degli ultimi 50 commit.|Exibindo os últimos 50 commits.|最新 50 件のコミットを表示。|显示最近 50 次提交。|顯示最近 50 次提交。
This folder is not a Git repository.|Dieser Ordner ist kein Git-Repository.|Esta carpeta no es un repositorio Git.|Ce dossier n'est pas un dépôt Git.|Questa cartella non è un repository Git.|Esta pasta não é um repositório Git.|このフォルダーは Git リポジトリではありません。|此文件夹不是 Git 仓库。|此資料夾不是 Git 儲存庫。
Binary diff is not supported.|Binärer Diff wird nicht unterstützt.|No se admiten diferencias binarias.|Les différences binaires ne sont pas prises en charge.|Diff binario non supportato.|Diferenças binárias não são suportadas.|バイナリ差分は未対応です。|不支持二进制差异。|不支援二進位差異。
Refresh Disk Diff|Disk-Diff aktualisieren|Actualizar diferencias del disco|Actualiser les différences sur disque|Aggiorna diff su disco|Atualizar diferenças do disco|ディスク差分を更新|刷新磁盘差异|重新整理磁碟差異
Tasks|Aufgaben|Tareas|Tâches|Attività|Tarefas|タスク|任务|工作
Protocol tests|Protocol-Tests|Pruebas del protocolo|Tests du protocole|Test del protocollo|Testes do protocolo|Protocol テスト|协议测试|協定測試
Test definitions|Testdefinitionen|Definiciones de pruebas|Définitions des tests|Definizioni test|Definições de testes|テスト定義|测试定义|測試定義
Definition files|Definitionsdateien|Archivos de definición|Fichiers de définition|File di definizione|Arquivos de definição|定義ファイル|定义文件|定義檔案
Initialize TASTEDEV|TASTEDEV initialisieren|Inicializar TASTEDEV|Initialiser TASTEDEV|Inizializza TASTEDEV|Inicializar TASTEDEV|TASTEDEV を初期化|初始化 TASTEDEV|初始化 TASTEDEV
Open TASTEDEV project definition|TASTEDEV-Projektdefinition öffnen|Abrir definición del proyecto TASTEDEV|Ouvrir la définition du projet TASTEDEV|Apri definizione progetto TASTEDEV|Abrir definição do projeto TASTEDEV|TASTEDEV プロジェクト定義を開く|打开 TASTEDEV 项目定义|開啟 TASTEDEV 專案定義
Loading Protocol…|Protocol wird geladen…|Cargando protocolo…|Chargement du protocole…|Caricamento protocollo…|Carregando protocolo…|Protocol を読み込み中…|正在加载协议…|正在載入協定…
Reload|Neu laden|Recargar|Recharger|Ricarica|Recarregar|再読み込み|重新加载|重新載入
Destination|Ziel|Destino|Destination|Destinazione|Destino|保存先|目标|目的地
Effective requirements|Wirksame Anforderungen|Requisitos efectivos|Exigences effectives|Requisiti effettivi|Requisitos efetivos|有効な要件|有效要求|有效需求
Project requirements|Projektanforderungen|Requisitos del proyecto|Exigences du projet|Requisiti del progetto|Requisitos do projeto|プロジェクト要件|项目要求|專案需求
Not required|Nicht erforderlich|No requerido|Non requis|Non richiesto|Não necessário|不要|不需要|不需要
Invalid plan|Ungültiger Plan|Plan no válido|Plan invalide|Piano non valido|Plano inválido|無効な計画|无效计划|無效計畫
Preparing…|Wird vorbereitet…|Preparando…|Préparation…|Preparazione…|Preparando…|準備中…|正在准备…|正在準備…
Run on Agent|Auf Agent ausführen|Ejecutar en agente|Exécuter sur l'agent|Esegui su agente|Executar no agente|エージェントで実行|在代理上运行|在代理程式上執行
Register agent|Agent registrieren|Registrar agente|Enregistrer un agent|Registra agente|Registrar agente|エージェントを登録|注册代理|註冊代理程式
Register offline|Offline registrieren|Registrar sin conexión|Enregistrer hors ligne|Registra offline|Registrar offline|オフライン登録|离线注册|離線註冊
Remove registration|Registrierung entfernen|Eliminar registro|Retirer l'enregistrement|Rimuovi registrazione|Remover registro|登録を削除|移除注册|移除註冊
Shared agent registry|Gemeinsames Agent-Register|Registro compartido de agentes|Registre partagé des agents|Registro agenti condiviso|Registro compartilhado de agentes|共有エージェント登録|共享代理注册表|共用代理程式登錄
Declared capabilities|Deklarierte Fähigkeiten|Capacidades declaradas|Capacités déclarées|Capacità dichiarate|Recursos declarados|申告された機能|声明的能力|宣告的功能
Agent identity and declared capabilities|Agent-Identität und Fähigkeiten|Identidad y capacidades declaradas del agente|Identité et capacités déclarées de l'agent|Identità e capacità dichiarate dell'agente|Identidade e recursos declarados do agente|エージェントの識別情報と申告機能|代理身份和声明能力|代理程式身分與宣告功能
Any OS|Beliebiges Betriebssystem|Cualquier sistema operativo|Tout système d'exploitation|Qualsiasi sistema operativo|Qualquer sistema operacional|任意の OS|任意操作系统|任意作業系統
Any architecture|Beliebige Architektur|Cualquier arquitectura|Toute architecture|Qualsiasi architettura|Qualquer arquitetura|任意のアーキテクチャ|任意架构|任意架構
Node requirement|Node-Anforderung|Requisito de Node|Exigence Node|Requisito Node|Requisito de Node|Node 要件|Node 要求|Node 需求
Node version|Node-Version|Versión de Node|Version Node|Versione Node|Versão do Node|Node バージョン|Node 版本|Node 版本
CPU cores|CPU-Kerne|Núcleos de CPU|Cœurs CPU|Core CPU|Núcleos de CPU|CPU コア数|CPU 核心|CPU 核心
Memory (MiB)|Arbeitsspeicher (MiB)|Memoria (MiB)|Mémoire (MiB)|Memoria (MiB)|Memória (MiB)|メモリ（MiB）|内存（MiB）|記憶體（MiB）
Docker required|Docker erforderlich|Se requiere Docker|Docker requis|Docker richiesto|Docker necessário|Docker が必要|需要 Docker|需要 Docker
Connect Core|Core verbinden|Conectar Core|Connecter Core|Collega Core|Conectar Core|Core に接続|连接 Core|連接 Core
Disconnect Core|Core trennen|Desconectar Core|Déconnecter Core|Scollega Core|Desconectar Core|Core を切断|断开 Core|中斷 Core
Core connection|Core-Verbindung|Conexión con Core|Connexion Core|Connessione Core|Conexão com Core|Core 接続|Core 连接|Core 連接
Core details|Core-Details|Detalles de Core|Détails Core|Dettagli Core|Detalhes do Core|Core の詳細|Core 详情|Core 詳細資料
Core session|Core-Sitzung|Sesión de Core|Session Core|Sessione Core|Sessão do Core|Core セッション|Core 会话|Core 工作階段
App session|App-Sitzung|Sesión de aplicación|Session de l'application|Sessione applicazione|Sessão do aplicativo|アプリセッション|应用会话|應用程式工作階段
Studio token|Studio-Token|Token de Studio|Jeton Studio|Token Studio|Token do Studio|Studio トークン|Studio 令牌|Studio 權杖
Job name|Jobname|Nombre del trabajo|Nom du travail|Nome attività|Nome do trabalho|ジョブ名|作业名称|作業名稱
Job queue|Job-Warteschlange|Cola de trabajos|File des travaux|Coda attività|Fila de trabalhos|ジョブキュー|作业队列|作業佇列
Queue job|Job einreihen|Encolar trabajo|Mettre le travail en file|Accoda attività|Enfileirar trabalho|ジョブをキューに追加|作业入队|將作業加入佇列
Queue retry|Wiederholung einreihen|Encolar reintento|Mettre la nouvelle tentative en file|Accoda nuovo tentativo|Enfileirar nova tentativa|再試行をキューに追加|重试入队|將重試加入佇列
Cancel job|Job abbrechen|Cancelar trabajo|Annuler le travail|Annulla attività|Cancelar trabalho|ジョブをキャンセル|取消作业|取消作業
Priority (0–100)|Priorität (0–100)|Prioridad (0–100)|Priorité (0–100)|Priorità (0–100)|Prioridade (0–100)|優先度（0–100）|优先级（0–100）|優先順序（0–100）
Select task|Aufgabe wählen|Seleccionar tarea|Sélectionner une tâche|Seleziona attività|Selecionar tarefa|タスクを選択|选择任务|選取工作
Select test|Test wählen|Seleccionar prueba|Sélectionner un test|Seleziona test|Selecionar teste|テストを選択|选择测试|選取測試
Agent matching|Agent-Zuordnung|Asignación de agente|Association d'agent|Abbinamento agente|Correspondência de agente|エージェント割り当て|代理匹配|代理程式配對
Match|Zuordnen|Asignar|Associer|Abbina|Associar|割り当て|匹配|配對
Assign next compatible job|Nächsten kompatiblen Job zuweisen|Asignar siguiente trabajo compatible|Affecter le prochain travail compatible|Assegna prossima attività compatibile|Atribuir próximo trabalho compatível|次の互換ジョブを割り当て|分配下一个兼容作业|指派下一個相容作業
Request cancellation|Abbruch anfordern|Solicitar cancelación|Demander l'annulation|Richiedi annullamento|Solicitar cancelamento|キャンセルを要求|请求取消|要求取消
Cancel test|Test abbrechen|Cancelar prueba|Annuler le test|Annulla test|Cancelar teste|テストをキャンセル|取消测试|取消測試
Retry test|Test wiederholen|Reintentar prueba|Réessayer le test|Riprova test|Repetir teste|テストを再試行|重试测试|重試測試
Run history|Ausführungsverlauf|Historial de ejecuciones|Historique d'exécution|Cronologia esecuzioni|Histórico de execuções|実行履歴|运行历史|執行歷程
Run detail|Ausführungsdetails|Detalle de ejecución|Détail d'exécution|Dettagli esecuzione|Detalhe de execução|実行の詳細|运行详情|執行詳細資料
Run / Job|Ausführung / Job|Ejecución / Trabajo|Exécution / Travail|Esecuzione / Attività|Execução / Trabalho|実行 / ジョブ|运行 / 作业|執行 / 作業
Run / Test|Ausführung / Test|Ejecución / Prueba|Exécution / Test|Esecuzione / Test|Execução / Teste|実行 / テスト|运行 / 测试|執行 / 測試
Open Run|Ausführung öffnen|Abrir ejecución|Ouvrir l'exécution|Apri esecuzione|Abrir execução|実行を開く|打开运行|開啟執行
Pipeline steps|Pipeline-Schritte|Pasos de canalización|Étapes du pipeline|Passaggi pipeline|Etapas do pipeline|パイプラインステップ|流水线步骤|管線步驟
Test Result|Testergebnis|Resultado de prueba|Résultat du test|Risultato test|Resultado do teste|テスト結果|测试结果|測試結果
Step log|Schrittprotokoll|Registro de paso|Journal d'étape|Log passaggio|Log da etapa|ステップログ|步骤日志|步驟日誌
Start / Duration|Start / Dauer|Inicio / Duración|Début / Durée|Inizio / Durata|Início / Duração|開始 / 所要時間|开始 / 耗时|開始 / 耗時
Order|Reihenfolge|Orden|Ordre|Ordine|Ordem|順序|顺序|順序
Level|Stufe|Nivel|Niveau|Livello|Nível|レベル|级别|等級
Method|Methode|Método|Méthode|Metodo|Método|メソッド|方法|方法
Captured|Erfasst|Capturado|Capturé|Acquisito|Capturado|取得日時|捕获时间|擷取時間
Size|Größe|Tamaño|Taille|Dimensione|Tamanho|サイズ|大小|大小
Source|Quelle|Origen|Source|Origine|Origem|ソース|来源|來源
Base revision|Basisrevision|Revisión base|Révision de base|Revisione base|Revisão base|ベースリビジョン|基础修订|基礎修訂
Branch / revision|Branch / Revision|Rama / Revisión|Branche / Révision|Branch / Revisione|Branch / Revisão|ブランチ / リビジョン|分支 / 修订|分支 / 修訂
Manifest checksum|Manifest-Prüfsumme|Suma de comprobación del manifiesto|Somme de contrôle du manifeste|Checksum manifesto|Checksum do manifesto|マニフェストのチェックサム|清单校验和|資訊清單總和檢查碼
Preparing source…|Quellcode wird vorbereitet…|Preparando código fuente…|Préparation du code source…|Preparazione sorgente…|Preparando código…|ソースを準備中…|正在准备源代码…|正在準備原始碼…
Remote test uses Git revision|Remote-Test verwendet Git-Revision|Prueba remota usa revisión Git|Test distant avec révision Git|Test remoto usa revisione Git|Teste remoto usa revisão Git|リモートテストは Git リビジョンを使用|远程测试使用 Git 修订|遠端測試使用 Git 修訂
Remote test uses workspace snapshot|Remote-Test verwendet Arbeitsbereichssnapshot|Prueba remota usa instantánea del espacio de trabajo|Test distant avec instantané de l'espace de travail|Test remoto usa snapshot dell'area di lavoro|Teste remoto usa snapshot do espaço de trabalho|リモートテストはワークスペースのスナップショットを使用|远程测试使用工作区快照|遠端測試使用工作區快照
Browser evidence|Browser-Nachweise|Evidencias del navegador|Preuves navigateur|Prove browser|Evidências do navegador|ブラウザーの証跡|浏览器证据|瀏覽器證據
Evidence content|Nachweisinhalte|Contenido de evidencia|Contenu des preuves|Contenuto prove|Conteúdo das evidências|証跡の内容|证据内容|證據內容
Export|Exportieren|Exportar|Exporter|Esporta|Exportar|エクスポート|导出|匯出
View|Ansehen|Ver|Voir|Visualizza|Ver|表示|查看|檢視
Open|Öffnen|Abrir|Ouvrir|Apri|Abrir|開く|打开|開啟
Open full screenshot|Vollständigen Screenshot öffnen|Abrir captura completa|Ouvrir la capture complète|Apri screenshot completo|Abrir captura completa|スクリーンショット全体を開く|打开完整截图|開啟完整擷取畫面
Loading verified artifact…|Verifiziertes Artefakt wird geladen…|Cargando artefacto verificado…|Chargement de l'artefact vérifié…|Caricamento artefatto verificato…|Carregando artefato verificado…|検証済み成果物を読み込み中…|正在加载已验证产物…|正在載入已驗證產物…
Retry load|Erneut laden|Reintentar carga|Réessayer le chargement|Riprova caricamento|Repetir carregamento|読み込みを再試行|重试加载|重試載入
Error|Fehler|Error|Erreur|Errore|Erro|エラー|错误|錯誤
Warning|Warnung|Advertencia|Avertissement|Avviso|Aviso|警告|警告|警告
Failure|Fehler|Fallo|Échec|Errore|Falha|失敗|失败|失敗
Not run|Nicht ausgeführt|No ejecutado|Non exécuté|Non eseguito|Não executado|未実行|未运行|未執行
Not started|Nicht gestartet|No iniciado|Non démarré|Non avviato|Não iniciado|未開始|未开始|未開始
Ready|Bereit|Listo|Prêt|Pronto|Pronto|準備完了|就绪|就緒
not assigned|nicht zugewiesen|sin asignar|non affecté|non assegnato|não atribuído|未割り当て|未分配|未指派
not finished|nicht beendet|sin finalizar|non terminé|non terminato|não concluído|未終了|未结束|未結束
not reported|nicht gemeldet|no informado|non signalé|non riportato|não informado|未報告|未报告|未回報
In progress|In Bearbeitung|En curso|En cours|In corso|Em andamento|実行中|进行中|進行中
Execution in progress.|Ausführung läuft.|Ejecución en curso.|Exécution en cours.|Esecuzione in corso.|Execução em andamento.|実行中です。|正在执行。|正在執行。
Browser test passed|Browser-Test bestanden|Prueba del navegador aprobada|Test navigateur réussi|Test browser superato|Teste do navegador aprovado|ブラウザーテスト成功|浏览器测试通过|瀏覽器測試通過
Available with permission|Mit Genehmigung verfügbar|Disponible con permiso|Disponible avec autorisation|Disponibile con permesso|Disponível com permissão|許可があれば利用可能|经许可可用|經許可可用
Filesystem|Dateisystem|Sistema de archivos|Système de fichiers|File system|Sistema de arquivos|ファイルシステム|文件系统|檔案系統
Desktop runtime|Desktop-Laufzeit|Entorno de escritorio|Environnement de bureau|Runtime desktop|Runtime desktop|デスクトップ環境|桌面运行时|桌面執行環境
Web runtime|Web-Laufzeit|Entorno web|Environnement web|Runtime web|Runtime web|Web 環境|Web 运行时|Web 執行環境
Unsupported runtime|Nicht unterstützte Laufzeit|Entorno no compatible|Environnement non pris en charge|Runtime non supportato|Runtime não suportado|未対応の環境|不支持的运行时|不支援的執行環境
Runtime policy|Laufzeitrichtlinie|Política de ejecución|Politique d'exécution|Politica runtime|Política de execução|実行ポリシー|运行时策略|執行環境原則
Working in your browser|Arbeiten im Browser|Trabajando en el navegador|Travail dans le navigateur|Lavoro nel browser|Trabalhando no navegador|ブラウザーで作業中|在浏览器中工作|在瀏覽器中工作
Working on your computer|Arbeiten auf Ihrem Computer|Trabajando en tu equipo|Travail sur votre ordinateur|Lavoro sul tuo computer|Trabalhando no seu computador|このコンピューターで作業中|在此计算机上工作|在此電腦上工作
Project metadata stays in this browser|Projektmetadaten bleiben in diesem Browser|Los metadatos permanecen en este navegador|Les métadonnées restent dans ce navigateur|I metadati restano in questo browser|Os metadados ficam neste navegador|プロジェクト情報はこのブラウザーに保存|项目元数据保留在此浏览器|專案中繼資料保留在此瀏覽器
Project metadata stays on this computer|Projektmetadaten bleiben auf diesem Computer|Los metadatos permanecen en este equipo|Les métadonnées restent sur cet ordinateur|I metadati restano su questo computer|Os metadados ficam neste computador|プロジェクト情報はこのコンピューターに保存|项目元数据保留在此计算机|專案中繼資料保留在此電腦
Page not found|Seite nicht gefunden|Página no encontrada|Page introuvable|Pagina non trovata|Página não encontrada|ページが見つかりません|未找到页面|找不到頁面
This page does not exist.|Diese Seite existiert nicht.|Esta página no existe.|Cette page n'existe pas.|Questa pagina non esiste.|Esta página não existe.|このページは存在しません。|此页面不存在。|此頁面不存在。`;
export const development=Object.fromEntries(additionalLanguages.map((language,index)=>[language,Object.fromEntries(rows.split('\n').map(row=>{const cells=row.split('|');if(cells.length!==9)throw new Error('Invalid development translation: '+cells[0]);return[cells[0],cells[index+1]];}))]));
