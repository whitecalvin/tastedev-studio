import {additionalLanguages} from './international.ts';
const rows=` · truncated| · gekürzt| · truncado| · tronqué| · troncato| · truncado|・省略あり|·已截断|·已截斷
% shared terms ·|% gemeinsame Begriffe ·|% términos compartidos ·|% termes partagés ·|% termini comuni ·|% termos compartilhados ·|% 共通語・|% 共同词语·|% 共同詞語·
, attempt|, Versuch|, intento|, tentative|, tentativo|, tentativa|、試行|，尝试|，嘗試
, proposal|, Vorschlag|, propuesta|, proposition|, proposta|, proposta|、提案|，提案|，提案
. Inspect Core storage/queue and reconnect.|. Core-Speicher/Warteschlange prüfen und erneut verbinden.|. Inspecciona almacenamiento/cola de Core y reconecta.|. Inspectez le stockage/la file Core et reconnectez.|. Esamina archivio/coda Core e ricollega.|. Inspecione armazenamento/fila Core e reconecte.|。Core の保存領域とキューを確認して再接続してください。|。检查 Core 存储/队列后重新连接。|。檢查 Core 儲存/佇列後重新連接。
. Manifest checksum:|. Manifest-Prüfsumme:|. Suma de comprobación:|. Somme de contrôle :|. Checksum manifesto:|. Checksum do manifesto:|。マニフェストチェックサム：|。清单校验和：|。資訊清單總和檢查碼：
. Open Runs to inspect this record.|. Ausführungen öffnen, um den Eintrag zu prüfen.|. Abre Ejecuciones para ver este registro.|. Ouvrez Exécutions pour inspecter cet enregistrement.|. Apri Esecuzioni per esaminare il record.|. Abra Execuções para ver este registro.|。実行履歴でこの記録を確認してください。|。打开运行记录查看此记录。|。開啟執行紀錄檢視此紀錄。
. Saved workspace changes are included; unsaved editor changes are excluded.|. Gespeicherte Änderungen enthalten; ungespeicherte ausgeschlossen.|. Incluye cambios guardados; excluye ediciones sin guardar.|. Modifications enregistrées incluses ; non enregistrées exclues.|. Include modifiche salvate; esclude quelle non salvate.|. Inclui alterações salvas; exclui edições não salvas.|。保存した変更を含み、未保存の編集は除外します。|。包含已保存工作区更改，排除编辑器未保存更改。|。包含已儲存工作區變更，排除編輯器未儲存變更。
. This creates a request; it does not execute a command.|. Erstellt eine Anfrage; führt keinen Befehl aus.|. Crea una solicitud; no ejecuta un comando.|. Crée une demande ; n'exécute pas de commande.|. Crea una richiesta; non esegue comandi.|. Cria solicitação; não executa comando.|。リクエストを作成しますが、コマンドは実行しません。|。这会创建请求，不执行命令。|。這會建立要求，不執行命令。
. Unsaved or uncommitted local changes are not included.|. Ungespeicherte oder nicht committete Änderungen ausgeschlossen.|. No incluye cambios sin guardar o sin commit.|. Modifications non enregistrées ou non committées exclues.|. Modifiche non salvate o senza commit escluse.|. Alterações não salvas ou sem commit excluídas.|。未保存または未コミットの変更は含みません。|。不包含未保存或未提交的本地更改。|。不含未儲存或未提交的本機變更。
Cleanup warning:|Bereinigungswarnung:|Advertencia de limpieza:|Avertissement de nettoyage :|Avviso di pulizia:|Aviso de limpeza:|クリーンアップ警告：|清理警告：|清理警告：
Evidence warning:|Nachweiswarnung:|Advertencia de evidencia:|Avertissement de preuve :|Avviso prove:|Aviso de evidência:|証跡の警告：|证据警告：|證據警告：
Execution records for|Ausführungsaufzeichnungen für|Registros de ejecución de|Enregistrements d'exécution pour|Registri di esecuzione per|Registros de execução de|実行記録：|执行记录：|執行紀錄：
Git capability:|Git-Funktion:|Capacidad Git:|Capacité Git :|Funzionalità Git:|Recurso Git:|Git 機能：|Git 能力：|Git 功能：
Git diff|Git-Diff|Diferencias Git|Différences Git|Diff Git|Diferenças Git|Git 差分|Git 差异|Git 差異
Git diff ·|Git-Diff ·|Diferencias Git ·|Différences Git ·|Diff Git ·|Diferenças Git ·|Git 差分・|Git 差异·|Git 差異·
HEAD → Index|HEAD → Index|HEAD → Índice|HEAD → Index|HEAD → Indice|HEAD → Índice|HEAD → インデックス|HEAD → 索引|HEAD → 索引
Index → Working tree|Index → Arbeitsbaum|Índice → Árbol de trabajo|Index → Arbre de travail|Indice → Albero di lavoro|Índice → Árvore de trabalho|インデックス → 作業ツリー|索引 → 工作树|索引 → 工作樹
Live stdout / stderr · latest 128 KiB retained per run|Live stdout / stderr · letzte 128 KiB pro Lauf|stdout / stderr en vivo · últimos 128 KiB por ejecución|stdout / stderr en direct · derniers 128 Kio par exécution|stdout / stderr dal vivo · ultimi 128 KiB per esecuzione|stdout / stderr ao vivo · últimos 128 KiB por execução|ライブ stdout / stderr・実行ごとに最新 128 KiB を保持|实时 stdout / stderr·每次运行保留最新 128 KiB|即時 stdout / stderr·每次執行保留最新 128 KiB
Output destination|Ausgabeziel|Destino de salida|Destination de sortie|Destinazione output|Destino de saída|出力先|输出目标|輸出目的地
Primary failure:|Primärer Fehler:|Fallo principal:|Échec principal :|Errore principale:|Falha principal:|主な失敗：|主要失败：|主要失敗：
Process: Desktop runtime required|Prozess: Desktop-Laufzeit erforderlich|Proceso: requiere entorno de escritorio|Processus : environnement de bureau requis|Processo: runtime desktop richiesto|Processo: runtime desktop necessário|プロセス：デスクトップ環境が必要|进程：需要桌面运行时|處理程序：需要桌面執行環境
Project job request ·|Projekt-Jobanfrage ·|Solicitud de trabajo del proyecto ·|Demande de travail du projet ·|Richiesta attività del progetto ·|Solicitação de trabalho do projeto ·|プロジェクトのジョブ要求・|项目作业请求·|專案作業要求·
Queue a structured task for|Strukturierte Aufgabe einreihen für|Encolar tarea estructurada para|Mettre une tâche structurée en file pour|Accoda attività strutturata per|Enfileirar tarefa estruturada para|構造化タスクをキューに追加：|将结构化任务入队：|將結構化工作加入佇列：
Remote Agent log|Remote-Agent-Protokoll|Registro del agente remoto|Journal de l'agent distant|Log agente remoto|Log do agente remoto|リモートエージェントログ|远程代理日志|遠端代理程式日誌
Run Test:|Test ausführen:|Ejecutar prueba:|Exécuter le test :|Esegui test:|Executar teste:|テスト実行：|运行测试：|執行測試：
Run: Ready|Ausführung: Bereit|Ejecución: Lista|Exécution : prête|Esecuzione: pronta|Execução: pronta|実行：準備完了|运行：就绪|執行：就緒
Scheduler runtime:|Planungslaufzeit:|Entorno del programador:|Environnement du planificateur :|Runtime pianificatore:|Runtime do agendador:|スケジューラー環境：|调度器运行时：|排程器執行環境：
Service process:|Dienstprozess:|Proceso de servicio:|Processus de service :|Processo servizio:|Processo de serviço:|サービスプロセス：|服务进程：|服務處理程序：
Terminal / PTY|Terminal / PTY|Terminal / PTY|Terminal / PTY|Terminale / PTY|Terminal / PTY|ターミナル / PTY|终端 / PTY|終端機 / PTY
bottom panel|unteres Panel|panel inferior|panneau inférieur|pannello inferiore|painel inferior|下部パネル|底部面板|底部面板
primary sidebar|primäre Seitenleiste|barra lateral principal|barre latérale principale|barra laterale principale|barra lateral principal|プライマリサイドバー|主侧边栏|主要側邊欄
secondary panel|sekundäres Panel|panel secundario|panneau secondaire|pannello secondario|painel secundário|セカンダリパネル|次面板|次要面板
bytes|Bytes|bytes|octets|byte|bytes|バイト|字节|位元組
declared. Edit|definiert. Bearbeiten|declarado. Editar|déclaré. Modifier|definito. Modifica|declarado. Editar|定義済み。編集：|已声明。编辑|已宣告。編輯
in Explorer.|im Explorer.|en el explorador.|dans l'explorateur.|in Esplora file.|no explorador.|エクスプローラー内。|在资源管理器中。|在檔案總管中。
input /|Eingabe /|entrada /|entrée /|input /|entrada /|入力 /|输入 /|輸入 /
output tokens|Ausgabetokens|tokens de salida|jetons de sortie|token output|tokens de saída|出力トークン|输出令牌|輸出權杖
logs|Protokolle|registros|journaux|log|logs|ログ|日志|日誌
run|Ausführung|ejecución|exécution|esecuzione|execução|実行|运行|執行
passed · Screenshot|bestanden · Screenshot|aprobado · Captura|réussi · Capture|superato · Screenshot|aprovado · Captura|成功・スクリーンショット|通过·截图|通過·擷取畫面
stdout / stderr · latest 128 KiB retained · separate from Local Terminal|stdout / stderr · letzte 128 KiB · getrennt vom lokalen Terminal|stdout / stderr · últimos 128 KiB · separado del terminal local|stdout / stderr · derniers 128 Kio · séparé du terminal local|stdout / stderr · ultimi 128 KiB · separato dal terminale locale|stdout / stderr · últimos 128 KiB · separado do terminal local|stdout / stderr・最新 128 KiB 保持・ローカルターミナルとは別|stdout / stderr·保留最新 128 KiB·与本地终端分开|stdout / stderr·保留最新 128 KiB·與本機終端機分開
steps ·|Schritte ·|pasos ·|étapes ·|passaggi ·|etapas ·|ステップ・|步骤·|步驟·
· Agent:|· Agent:|· Agente:|· Agent :|· Agente:|· Agente:|・エージェント：|·代理：|·代理程式：
· Console errors|· Konsolenfehler|· Errores de consola|· Erreurs console|· Errori console|· Erros de console|・コンソールエラー|·控制台错误|·主控台錯誤
· Core runtime|· Core-Laufzeit|· Entorno Core|· Environnement Core|· Runtime Core|· Runtime Core|・Core 環境|·Core 运行时|·Core 執行環境
· Duration:|· Dauer:|· Duración:|· Durée :|· Durata:|· Duração:|・所要時間：|·耗时：|·耗時：
· Exit|· Exit-Code|· Salida|· Sortie|· Uscita|· Saída|・終了コード|·退出码|·結束碼
· Network failures|· Netzwerkfehler|· Fallos de red|· Échecs réseau|· Errori di rete|· Falhas de rede|・ネットワーク障害|·网络失败|·網路失敗
· Page errors|· Seitenfehler|· Errores de página|· Erreurs page|· Errori pagina|· Erros de página|・ページエラー|·页面错误|·頁面錯誤
· Read only|· Schreibgeschützt|· Solo lectura|· Lecture seule|· Sola lettura|· Somente leitura|・読み取り専用|·只读|·唯讀
· Trace|· Trace|· Traza|· Trace|· Traccia|· Trace|・トレース|·跟踪|·追蹤
· internal only|· nur intern|· solo interno|· interne uniquement|· solo interno|· somente interno|・内部のみ|·仅内部|·僅內部
· stopped during cleanup or termination|· bei Bereinigung oder Beendigung gestoppt|· detenido al limpiar o terminar|· arrêté au nettoyage ou à la terminaison|· fermato durante pulizia o terminazione|· parado durante limpeza ou término|・クリーンアップまたは終了で停止|·清理或终止时停止|·清理或終止時停止
· task:|· Aufgabe:|· tarea:|· tâche :|· attività:|· tarefa:|・タスク：|·任务：|·工作：
Remove “|„ entfernen:|Quitar “|Retirer « |Rimuovi “|Remover “|削除「|移除“|移除「
” from this project? Files and processes are not changed.|“ aus diesem Projekt entfernen? Dateien und Prozesse bleiben unverändert.|” de este proyecto? No cambia archivos ni procesos.|» de ce projet ? Les fichiers et processus ne sont pas modifiés.|” da questo progetto? File e processi non cambiano.|” deste projeto? Arquivos e processos não mudam.|」をプロジェクトから削除しますか？ファイルとプロセスは変更しません。|”从此项目移除？文件和进程不更改。|」從此專案移除？檔案與處理程序不變更。`;
export const fragments=Object.fromEntries(additionalLanguages.map((language,index)=>[language,Object.fromEntries(rows.split('\n').map(row=>{const cells=row.split('|');if(cells.length!==9)throw new Error('Invalid fragment translation: '+cells[0]);return[cells[0],cells[index+1]];}))]));
