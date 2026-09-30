import {additionalLanguages} from './international.ts';
const rows=`Diagnostics are not connected. No analysis has been run.|Diagnose nicht verbunden. Keine Analyse ausgeführt.|Diagnósticos no conectados. Ningún análisis ejecutado.|Diagnostics non connectés. Aucune analyse exécutée.|Diagnostica non collegata. Nessuna analisi eseguita.|Diagnósticos não conectados. Nenhuma análise executada.|診断は未接続です。分析はまだ実行していません。|诊断未连接。尚未运行分析。|診斷未連接。尚未執行分析。
No test provider is connected. No tests have been run.|Kein Testanbieter verbunden. Keine Tests ausgeführt.|Sin proveedor de pruebas. Ninguna prueba ejecutada.|Aucun fournisseur de test connecté. Aucun test exécuté.|Nessun provider test collegato. Nessun test eseguito.|Nenhum provedor de testes conectado. Nenhum teste executado.|テストプロバイダーは未接続です。テストはまだ実行していません。|未连接测试提供者。尚未运行测试。|未連接測試提供者。尚未執行測試。
Agent integration is not connected. No agent sessions have started.|Agent-Integration nicht verbunden. Keine Sitzungen gestartet.|Integración de agente no conectada. Ninguna sesión iniciada.|Intégration agent non connectée. Aucune session démarrée.|Integrazione agente non collegata. Nessuna sessione avviata.|Integração de agente não conectada. Nenhuma sessão iniciada.|エージェント連携は未接続です。セッションはまだ開始していません。|代理集成未连接。尚未开始代理会话。|代理程式整合未連接。尚未開始工作階段。
Workspace log collection is not connected.|Arbeitsbereichsprotokolle nicht verbunden.|Recopilación de registros no conectada.|Collecte des journaux non connectée.|Raccolta log non collegata.|Coleta de logs não conectada.|ワークスペースのログ収集は未接続です。|工作区日志收集未连接。|工作區日誌收集未連接。
Terminal sessions are not connected. Command execution arrives in STEP 4.|Terminalsitzungen nicht verbunden. Befehlsausführung ab STEP 4.|Sesiones de terminal no conectadas. Comandos en STEP 4.|Sessions terminal non connectées. Commandes à STEP 4.|Sessioni terminale non collegate. Comandi in STEP 4.|Sessões de terminal não conectadas. Comandos em STEP 4.|ターミナルは未接続です。コマンド実行は STEP 4 で追加します。|终端会话未连接。命令执行将在 STEP 4 加入。|終端機工作階段未連接。命令執行將在 STEP 4 加入。
No output provider is connected. Task output will appear here.|Kein Ausgabeanbieter verbunden. Aufgabenausgabe erscheint hier.|Sin proveedor de salida. La salida aparecerá aquí.|Aucun fournisseur de sortie connecté. La sortie apparaîtra ici.|Nessun provider output collegato. L'output apparirà qui.|Nenhum provedor de saída conectado. A saída aparecerá aqui.|出力プロバイダーは未接続です。タスク出力はここに表示します。|未连接输出提供者。任务输出将显示在此。|未連接輸出提供者。工作輸出將顯示於此。
Valid|Gültig|Válido|Valide|Valido|Válido|有効|有效|有效
Invalid|Ungültig|No válido|Invalide|Non valido|Inválido|無効|无效|無效
Not Configured|Nicht konfiguriert|No configurado|Non configuré|Non configurato|Não configurado|未設定|未配置|未設定
connected|verbunden|conectado|connecté|collegato|conectado|接続済み|已连接|已連接
disconnected|getrennt|desconectado|déconnecté|scollegato|desconectado|未接続|已断开|已中斷
connecting|Verbindung wird hergestellt|conectando|connexion|connessione|conectando|接続中|连接中|連接中
assigned|zugewiesen|asignado|affecté|assegnato|atribuído|割り当て済み|已分配|已指派
starting|startet|iniciando|démarrage|avvio|iniciando|開始中|启动中|啟動中
stopping|stoppt|deteniendo|arrêt|arresto|parando|停止中|停止中|停止中
exited|beendet|terminado|terminé|terminato|finalizado|終了|已退出|已結束
error|Fehler|error|erreur|errore|erro|エラー|错误|錯誤
draft|Entwurf|borrador|brouillon|bozza|rascunho|下書き|草稿|草稿
reviewed|geprüft|revisado|relu|rivisto|revisado|確認済み|已审核|已審核
creating|wird erstellt|creando|création|creazione|criando|作成中|创建中|建立中
linked|verknüpft|vinculado|lié|collegato|vinculado|リンク済み|已关联|已連結
dismissed|verworfen|descartado|écarté|scartato|dispensado|破棄済み|已放弃|已捨棄
searching|sucht|buscando|recherche|ricerca|pesquisando|検索中|搜索中|搜尋中
analysing|analysiert|analizando|analyse|analisi|analisando|分析中|分析中|分析中
analyzing|analysiert|analizando|analyse|analisi|analisando|分析中|分析中|分析中
manual|manuell|manual|manuel|manuale|manual|手動|手动|手動
cron|Cron|cron|cron|cron|cron|Cron|Cron|Cron
interval|Intervall|intervalo|intervalle|intervallo|intervalo|間隔|间隔|間隔
time|einmalig|una vez|ponctuel|una tantum|uma vez|一回限り|一次性|單次
event|Ereignis|evento|événement|evento|evento|イベント|事件|事件
failure|Fehler|fallo|échec|errore|falha|失敗|失败|失敗
fix|Korrektur|corrección|correctif|correzione|correção|修正|修复|修正
overlap|Überlappung|superposición|chevauchement|sovrapposizione|sobreposição|重複実行|重叠运行|重疊執行
capacity|Kapazität|capacidad|capacité|capacità|capacidade|実行上限|执行容量|執行容量
missed|verpasst|perdido|manqué|perso|perdido|未実行|已错过|已錯過
Rename entry|Eintrag umbenennen|Renombrar elemento|Renommer l'élément|Rinomina elemento|Renomear item|項目の名前を変更|重命名条目|重新命名項目
Create|Erstellen|Crear|Créer|Crea|Criar|作成|创建|建立
Create in {path}.|In {path} erstellen.|Crear en {path}.|Créer dans {path}.|Crea in {path}.|Criar em {path}.|{path}に作成。|在 {path} 中创建。|在 {path} 中建立。
Rename this entry in the connected workspace. Avoid external edits during this operation. Unsaved editor changes are preserved.|Eintrag umbenennen. Externe Änderungen währenddessen vermeiden. Ungespeicherte Änderungen bleiben erhalten.|Renombra el elemento. Evita cambios externos durante la operación. Se preservan ediciones sin guardar.|Renommez l'élément. Évitez les modifications externes pendant l'opération. Les éditions non enregistrées sont préservées.|Rinomina l'elemento. Evita modifiche esterne durante l'operazione. Le modifiche non salvate restano.|Renomeie o item. Evite edições externas durante a operação. Edições não salvas são preservadas.|接続した領域で名前を変更します。操作中は外部編集を避けてください。未保存の編集は保持します。|在已连接工作区重命名。操作期间请避免外部编辑。未保存的编辑会保留。|在已連接工作區重新命名。操作期間請避免外部編輯。未儲存的編輯會保留。
Delete permanently?|Endgültig löschen?|¿Eliminar permanentemente?|Supprimer définitivement ?|Eliminare definitivamente?|Excluir permanentemente?|完全に削除しますか？|永久删除？|永久刪除？
Delete permanently|Endgültig löschen|Eliminar permanentemente|Supprimer définitivement|Elimina definitivamente|Excluir permanentemente|完全に削除|永久删除|永久刪除
Delete “{name}” from disk? This cannot be undone in Studio. {open} open editor(s) will close; {dirty} unsaved document(s) will be discarded.|„{name}“ von Disk löschen? In Studio nicht rückgängig machbar. {open} Editoren schließen; {dirty} ungespeicherte Dokumente verwerfen.|¿Eliminar “{name}” del disco? No se puede deshacer en Studio. Se cerrarán {open} editores y descartarán {dirty} documentos sin guardar.|Supprimer « {name} » du disque ? Irréversible dans Studio. {open} éditeurs seront fermés ; {dirty} documents non enregistrés seront abandonnés.|Eliminare “{name}” dal disco? Non annullabile in Studio. Si chiudono {open} editor e scartano {dirty} documenti non salvati.|Excluir “{name}” do disco? Não pode desfazer no Studio. {open} editores fecham; {dirty} documentos não salvos são descartados.|「{name}」をディスクから削除しますか？Studio では取り消せません。エディター {open} 件を閉じ、未保存の文書 {dirty} 件を破棄します。|从磁盘删除“{name}”？Studio 中无法撤销。将关闭 {open} 个编辑器并放弃 {dirty} 个未保存文档。|從磁碟刪除「{name}」？Studio 中無法復原。將關閉 {open} 個編輯器並捨棄 {dirty} 個未儲存文件。
Delete “{name}” and all its contents from disk? This cannot be undone in Studio. {open} open editor(s) will close; {dirty} unsaved document(s) will be discarded.|„{name}“ mit allen Inhalten löschen? In Studio nicht rückgängig machbar. {open} Editoren schließen; {dirty} ungespeicherte Dokumente verwerfen.|¿Eliminar “{name}” y todo su contenido? No se puede deshacer en Studio. Se cerrarán {open} editores y descartarán {dirty} documentos sin guardar.|Supprimer « {name} » et tout son contenu ? Irréversible dans Studio. {open} éditeurs seront fermés ; {dirty} documents non enregistrés abandonnés.|Eliminare “{name}” e tutto il contenuto? Non annullabile in Studio. Si chiudono {open} editor e scartano {dirty} documenti non salvati.|Excluir “{name}” e todo conteúdo? Não pode desfazer no Studio. {open} editores fecham; {dirty} documentos não salvos descartados.|「{name}」とすべての内容を削除しますか？Studio では取り消せません。エディター {open} 件を閉じ、未保存の文書 {dirty} 件を破棄します。|从磁盘删除“{name}”及全部内容？Studio 中无法撤销。将关闭 {open} 个编辑器并放弃 {dirty} 个未保存文档。|從磁碟刪除「{name}」及全部內容？Studio 中無法復原。將關閉 {open} 個編輯器並捨棄 {dirty} 個未儲存文件。
Saved layout is invalid. Using a temporary layout; saved data is unchanged.|Gespeichertes Layout ungültig. Temporäres Layout; gespeicherte Daten unverändert.|Diseño guardado no válido. Se usa temporal; datos sin cambios.|Disposition enregistrée invalide. Disposition temporaire ; données inchangées.|Layout salvato non valido. Layout temporaneo; dati invariati.|Layout salvo inválido. Layout temporário; dados inalterados.|保存したレイアウトが無効です。一時レイアウトを使用し、保存データは変更しません。|已保存布局无效。使用临时布局，保存数据未更改。|已儲存版面配置無效。使用暫時版面配置，儲存資料未變更。
Layout storage is unavailable.|Layoutspeicher nicht verfügbar.|Almacenamiento de diseño no disponible.|Stockage de disposition indisponible.|Archivio layout non disponibile.|Armazenamento de layout indisponível.|レイアウト保存を利用できません。|布局存储不可用。|版面配置儲存無法使用。
Layout changes are temporary because browser storage is unavailable.|Layoutänderungen sind wegen fehlendem Browserspeicher temporär.|Cambios de diseño temporales por almacenamiento no disponible.|Modifications temporaires car le stockage navigateur est indisponible.|Modifiche layout temporanee per archivio browser non disponibile.|Alterações de layout temporárias pois armazenamento indisponível.|ブラウザーの保存領域が利用できないためレイアウト変更は一時的です。|浏览器存储不可用，布局更改为临时更改。|瀏覽器儲存無法使用，版面配置變更為暫時變更。`;
export const stateMessages=Object.fromEntries(additionalLanguages.map((language,index)=>[language,Object.fromEntries(rows.split('\n').map(row=>{const cells=row.split('|');if(cells.length!==9)throw new Error('Invalid state translation: '+cells[0]);return[cells[0],cells[index+1]];}))]));
