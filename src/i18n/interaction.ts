import {additionalLanguages} from './international.ts';
const rows=`Folder received: {name}. Connecting workspace…|Ordner {name} erhalten. Arbeitsbereich verbinden…|Carpeta recibida: {name}. Conectando…|Dossier reçu : {name}. Connexion…|Cartella ricevuta: {name}. Connessione…|Pasta recebida: {name}. Conectando…|フォルダー取得：{name}。接続中…|已收到文件夹：{name}。正在连接…|已收到資料夾：{name}。正在連接…
Opening {name}…|{name} wird geöffnet…|Abriendo {name}…|Ouverture de {name}…|Apertura di {name}…|Abrindo {name}…|{name}を開いています…|正在打开 {name}…|正在開啟 {name}…
{name} added to Recent Projects. No folders or source files were created.|{name} zu letzten Projekten hinzugefügt. Keine Ordner oder Quelldateien erstellt.|{name} añadido a proyectos recientes. No se crearon carpetas ni archivos.|{name} ajouté aux projets récents. Aucun dossier ni fichier créé.|{name} aggiunto ai progetti recenti. Nessuna cartella o file creato.|{name} adicionado aos projetos recentes. Nenhuma pasta ou arquivo criado.|{name}を最近のプロジェクトに追加しました。フォルダーやファイルは作成していません。|已将 {name} 添加到最近项目。未创建文件夹或源文件。|已將 {name} 新增至最近專案。未建立資料夾或原始檔。
“{name}” has unsaved changes.|„{name}“ hat ungespeicherte Änderungen.|“{name}” tiene cambios sin guardar.|« {name} » contient des modifications non enregistrées.|“{name}” ha modifiche non salvate.|“{name}” tem alterações não salvas.|「{name}」に未保存の変更があります。|“{name}”有未保存更改。|「{name}」有未儲存變更。
Discard unsaved changes in “{name}” and load its current disk content?|Ungespeicherte Änderungen in „{name}“ verwerfen und Disk-Inhalt laden?|¿Descartar cambios sin guardar en “{name}” y cargar el contenido del disco?|Abandonner les modifications de « {name} » et charger le contenu du disque ?|Scartare modifiche in “{name}” e caricare il contenuto su disco?|Descartar alterações em “{name}” e carregar conteúdo do disco?|「{name}」の未保存変更を破棄してディスク内容を読み込みますか？|放弃“{name}”未保存更改并加载磁盘内容？|捨棄「{name}」未儲存變更並載入磁碟內容？
Save changes?|Änderungen speichern?|¿Guardar cambios?|Enregistrer les modifications ?|Salvare modifiche?|Salvar alterações?|変更を保存しますか？|保存更改？|儲存變更？
Reload from disk?|Von Disk neu laden?|¿Recargar del disco?|Recharger depuis le disque ?|Ricaricare dal disco?|Recarregar do disco?|ディスクから再読み込みしますか？|从磁盘重新加载？|從磁碟重新載入？
Save all edited files before leaving this workspace or changing its folder connection?|Alle Dateien vor Verlassen oder Ordnerwechsel speichern?|¿Guardar archivos antes de salir o cambiar carpeta?|Enregistrer tous les fichiers avant de quitter ou changer de dossier ?|Salvare tutti i file prima di uscire o cambiare cartella?|Salvar todos os arquivos antes de sair ou mudar pasta?|ワークスペースから離れるかフォルダーを変更する前にすべて保存しますか？|离开工作区或更改文件夹连接前保存所有编辑文件？|離開工作區或變更資料夾連接前儲存所有編輯檔案？
Approve Create|Erstellung genehmigen|Aprobar creación|Approuver la création|Approva creazione|Aprovar criação|作成を承認|批准创建|核准建立
Approve GitHub Issue Create|GitHub-Issue-Erstellung genehmigen|Aprobar creación de incidencia GitHub|Approuver la création du ticket GitHub|Approva creazione issue GitHub|Aprovar criação de issue GitHub|GitHub Issue 作成を承認|批准创建 GitHub 问题|核准建立 GitHub 議題
Agent ID|Agent-ID|ID del agente|ID de l'agent|ID agente|ID do agente|エージェント ID|代理 ID|代理程式 ID
Job ID|Job-ID|ID del trabajo|ID du travail|ID attività|ID do trabalho|ジョブ ID|作业 ID|作業 ID
Run ID|Ausführungs-ID|ID de ejecución|ID d'exécution|ID esecuzione|ID da execução|実行 ID|运行 ID|執行 ID
OS / Architecture|OS / Architektur|SO / Arquitectura|OS / Architecture|OS / Architettura|SO / Arquitetura|OS / アーキテクチャ|系统 / 架构|系統 / 架構
Last seen|Letzter Kontakt|Último contacto|Dernier contact|Ultimo contatto|Último contato|最終接続|最后在线|最後上線
CPU / Memory|CPU / Speicher|CPU / Memoria|CPU / Mémoire|CPU / Memoria|CPU / Memória|CPU / メモリ|CPU / 内存|CPU / 記憶體
Runtimes|Laufzeiten|Entornos|Environnements|Runtime|Runtimes|実行環境|运行时|執行環境
Browsers|Browser|Navegadores|Navigateurs|Browser|Navegadores|ブラウザー|浏览器|瀏覽器
None declared|Keine definiert|Ninguno declarado|Aucun déclaré|Nessuno dichiarato|Nenhum declarado|未定義|未声明|未宣告
Queued|Eingereiht|En cola|En file|In coda|Na fila|キュー追加日時|入队时间|加入佇列時間
Requirements|Anforderungen|Requisitos|Exigences|Requisiti|Requisitos|要件|要求|需求
Cancellation|Abbruch|Cancelación|Annulation|Annullamento|Cancelamento|キャンセル|取消|取消
Requested; awaiting acknowledgement|Angefordert; wartet auf Bestätigung|Solicitado; esperando confirmación|Demandée ; en attente de confirmation|Richiesto; attesa conferma|Solicitado; aguardando confirmação|要求済み・応答待ち|已请求；等待确认|已要求；等待確認
Not requested|Nicht angefordert|No solicitado|Non demandée|Non richiesto|Não solicitado|未要求|未请求|未要求
Job|Job|Trabajo|Travail|Attività|Trabalho|ジョブ|作业|作業
Exit code|Exit-Code|Código de salida|Code de sortie|Codice uscita|Código de saída|終了コード|退出码|結束碼
Not reported|Nicht gemeldet|No informado|Non signalé|Non riportato|Não informado|未報告|未报告|未回報
Not configured|Nicht konfiguriert|No configurado|Non configuré|Non configurato|Não configurado|未設定|未配置|未設定
Opening file…|Datei wird geöffnet…|Abriendo archivo…|Ouverture du fichier…|Apertura file…|Abrindo arquivo…|ファイルを開いています…|正在打开文件…|正在開啟檔案…
Saving file…|Datei wird gespeichert…|Guardando archivo…|Enregistrement du fichier…|Salvataggio file…|Salvando arquivo…|ファイルを保存中…|正在保存文件…|正在儲存檔案…
Saving files…|Dateien werden gespeichert…|Guardando archivos…|Enregistrement des fichiers…|Salvataggio file…|Salvando arquivos…|ファイルを保存中…|正在保存文件…|正在儲存檔案…
Connecting folder…|Ordner wird verbunden…|Conectando carpeta…|Connexion du dossier…|Connessione cartella…|Conectando pasta…|フォルダーを接続中…|正在连接文件夹…|正在連接資料夾…
Disconnecting…|Verbindung wird getrennt…|Desconectando…|Déconnexion…|Disconnessione…|Desconectando…|切断中…|正在断开…|正在中斷…
Requesting access…|Zugriff wird angefordert…|Solicitando acceso…|Demande d'accès…|Richiesta accesso…|Solicitando acesso…|アクセスを要求中…|正在请求访问权限…|正在要求存取權限…
Closing editor…|Editor wird geschlossen…|Cerrando editor…|Fermeture de l'éditeur…|Chiusura editor…|Fechando editor…|エディターを閉じています…|正在关闭编辑器…|正在關閉編輯器…
Reloading file…|Datei wird neu geladen…|Recargando archivo…|Rechargement du fichier…|Ricaricamento file…|Recarregando arquivo…|ファイルを再読み込み中…|正在重新加载文件…|正在重新載入檔案…
Refreshing Explorer…|Explorer wird aktualisiert…|Actualizando explorador…|Actualisation de l'explorateur…|Aggiornamento Esplora file…|Atualizando explorador…|エクスプローラーを更新中…|正在刷新资源管理器…|正在重新整理檔案總管…
File saved to the connected folder.|Datei im verbundenen Ordner gespeichert.|Archivo guardado en la carpeta conectada.|Fichier enregistré dans le dossier connecté.|File salvato nella cartella collegata.|Arquivo salvo na pasta conectada.|接続したフォルダーに保存しました。|文件已保存至连接的文件夹。|檔案已儲存至連接的資料夾。`;
export const interaction=Object.fromEntries(additionalLanguages.map((language,index)=>[language,Object.fromEntries(rows.split('\n').map(row=>{const cells=row.split('|');if(cells.length!==9)throw new Error('Invalid interaction translation: '+cells[0]);return[cells[0],cells[index+1]];}))]));
