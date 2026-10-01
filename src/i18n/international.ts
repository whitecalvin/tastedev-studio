import type {Language} from './core.ts';
// Studio terminology. Column order follows the eight additional tastedev-web locales.
const rows=`Language|Sprache|Idioma|Langue|Lingua|Idioma|言語|语言|語言
System language|Systemsprache|Idioma del sistema|Langue du système|Lingua di sistema|Idioma do sistema|システム言語|系统语言|系統語言
Projects|Projekte|Proyectos|Projets|Progetti|Projetos|プロジェクト|项目|專案
Project|Projekt|Proyecto|Projet|Progetto|Projeto|プロジェクト|项目|專案
New Project|Neues Projekt|Nuevo proyecto|Nouveau projet|Nuovo progetto|Novo projeto|新規プロジェクト|新建项目|新增專案
Recent Projects|Zuletzt verwendete Projekte|Proyectos recientes|Projets récents|Progetti recenti|Projetos recentes|最近のプロジェクト|最近的项目|最近的專案
All projects|Alle Projekte|Todos los proyectos|Tous les projets|Tutti i progetti|Todos os projetos|すべてのプロジェクト|所有项目|所有專案
All|Alle|Todos|Tous|Tutti|Todos|すべて|全部|全部
Your starting point. Pick up where you left off.|Setzen Sie Ihre Arbeit dort fort, wo Sie aufgehört haben.|Continúa donde lo dejaste.|Reprenez là où vous en étiez.|Riprendi da dove avevi lasciato.|Continue de onde parou.|前回の作業から再開しましょう。|从上次停止的地方继续。|從上次停止的地方繼續。
Start a project|Projekt starten|Iniciar un proyecto|Démarrer un projet|Avvia un progetto|Iniciar um projeto|プロジェクトを開始|开始项目|開始專案
Register a workspace|Arbeitsbereich registrieren|Registrar espacio de trabajo|Enregistrer un espace de travail|Registra un'area di lavoro|Registrar espaço de trabalho|ワークスペースを登録|注册工作区|註冊工作區
Open Project|Projekt öffnen|Abrir proyecto|Ouvrir un projet|Apri progetto|Abrir projeto|プロジェクトを開く|打开项目|開啟專案
Connect a local folder|Lokalen Ordner verbinden|Conectar carpeta local|Connecter un dossier local|Collega una cartella locale|Conectar pasta local|ローカルフォルダーを接続|连接本地文件夹|連接本機資料夾
Clone Repository|Repository klonen|Clonar repositorio|Cloner un dépôt|Clona repository|Clonar repositório|リポジトリをクローン|克隆仓库|複製儲存庫
Start from a Git repository|Mit einem Git-Repository beginnen|Empezar desde un repositorio Git|Partir d'un dépôt Git|Inizia da un repository Git|Começar de um repositório Git|Git リポジトリから開始|从 Git 仓库开始|從 Git 儲存庫開始
Search projects|Projekte suchen|Buscar proyectos|Rechercher des projets|Cerca progetti|Pesquisar projetos|プロジェクトを検索|搜索项目|搜尋專案
Find a project…|Projekt suchen…|Buscar proyecto…|Rechercher un projet…|Cerca un progetto…|Pesquisar projeto…|プロジェクトを検索…|搜索项目…|搜尋專案…
No matching projects|Keine passenden Projekte|No hay proyectos coincidentes|Aucun projet correspondant|Nessun progetto corrispondente|Nenhum projeto correspondente|一致するプロジェクトなし|没有匹配的项目|沒有相符的專案
No projects yet|Noch keine Projekte|Aún no hay proyectos|Aucun projet pour le moment|Nessun progetto ancora|Ainda não há projetos|プロジェクトはまだありません|暂无项目|尚無專案
A workspace starts with a project.|Ein Arbeitsbereich beginnt mit einem Projekt.|Un espacio de trabajo empieza con un proyecto.|Un espace de travail commence par un projet.|Un'area di lavoro inizia con un progetto.|Um espaço de trabalho começa com um projeto.|ワークスペースはプロジェクトから始まります。|工作区从项目开始。|工作區從專案開始。
Create a new project, open an existing project,|Erstellen Sie ein Projekt, öffnen Sie ein bestehendes Projekt,|Crea un proyecto, abre uno existente,|Créez un projet, ouvrez un projet existant,|Crea un progetto, aprine uno esistente,|Crie um projeto, abra um existente,|新規プロジェクトを作成するか、既存のプロジェクトを開くか、|创建新项目、打开现有项目，|建立新專案、開啟現有專案，
or clone a Git repository to get started.|oder klonen Sie ein Git-Repository.|o clona un repositorio Git para empezar.|ou clonez un dépôt Git pour commencer.|o clona un repository Git per iniziare.|ou clone um repositório Git para começar.|Git リポジトリをクローンして開始してください。|或克隆 Git 仓库以开始。|或複製 Git 儲存庫以開始。
Try a different name or workspace path.|Versuchen Sie einen anderen Namen oder Pfad.|Prueba otro nombre o ruta.|Essayez un autre nom ou chemin.|Prova un altro nome o percorso.|Tente outro nome ou caminho.|別の名前またはパスで検索してください。|请尝试其他名称或工作区路径。|請嘗試其他名稱或工作區路徑。
Clear search|Suche löschen|Borrar búsqueda|Effacer la recherche|Cancella ricerca|Limpar pesquisa|検索をクリア|清除搜索|清除搜尋
Loading your projects…|Projekte werden geladen…|Cargando proyectos…|Chargement des projets…|Caricamento progetti…|Carregando projetos…|プロジェクトを読み込み中…|正在加载项目…|正在載入專案…
Projects couldn’t be loaded|Projekte konnten nicht geladen werden|No se pudieron cargar los proyectos|Impossible de charger les projets|Impossibile caricare i progetti|Não foi possível carregar os projetos|プロジェクトを読み込めませんでした|无法加载项目|無法載入專案
Not opened yet|Noch nicht geöffnet|Aún no abierto|Pas encore ouvert|Non ancora aperto|Ainda não aberto|未使用|尚未打开|尚未開啟
Opened {date}|Geöffnet: {date}|Abierto: {date}|Ouvert : {date}|Aperto: {date}|Aberto: {date}|最終使用：{date}|打开于 {date}|開啟於 {date}
Project name|Projektname|Nombre del proyecto|Nom du projet|Nome del progetto|Nome do projeto|プロジェクト名|项目名称|專案名稱
Required|Erforderlich|Obligatorio|Obligatoire|Obbligatorio|Obrigatório|必須|必填|必填
Optional|Optional|Opcional|Facultatif|Facoltativo|Opcional|任意|可选|選填
My project|Mein Projekt|Mi proyecto|Mon projet|Il mio progetto|Meu projeto|マイプロジェクト|我的项目|我的專案
Repository URL|Repository-URL|URL del repositorio|URL du dépôt|URL del repository|URL do repositório|リポジトリ URL|仓库 URL|儲存庫 URL
Workspace path|Arbeitsbereichspfad|Ruta del espacio de trabajo|Chemin de l'espace de travail|Percorso dell'area di lavoro|Caminho do espaço de trabalho|ワークスペースのパス|工作区路径|工作區路徑
Target workspace|Zielarbeitsbereich|Espacio de trabajo de destino|Espace de travail cible|Area di lavoro di destinazione|Espaço de trabalho de destino|対象ワークスペース|目标工作区|目標工作區
Description|Beschreibung|Descripción|Description|Descrizione|Descrição|説明|描述|描述
What are you working on?|Woran arbeiten Sie?|¿En qué estás trabajando?|Sur quoi travaillez-vous ?|A cosa stai lavorando?|No que você está trabalhando?|どのような作業をしていますか？|您在做什么项目？|您在做什麼專案？
Branch|Branch|Rama|Branche|Branch|Branch|ブランチ|分支|分支
Use repository default|Repository-Standard verwenden|Usar valor predeterminado del repositorio|Utiliser la valeur par défaut du dépôt|Usa il valore predefinito del repository|Usar padrão do repositório|リポジトリの既定値を使用|使用仓库默认值|使用儲存庫預設值
Create Project|Projekt erstellen|Crear proyecto|Créer un projet|Crea progetto|Criar projeto|プロジェクトを作成|创建项目|建立專案
Check clone availability|Klonen prüfen|Comprobar clonación|Vérifier le clonage|Verifica clonazione|Verificar clonagem|クローンの可否を確認|检查克隆可用性|檢查複製可用性
Cancel|Abbrechen|Cancelar|Annuler|Annulla|Cancelar|キャンセル|取消|取消
Close dialog|Dialog schließen|Cerrar diálogo|Fermer la boîte de dialogue|Chiudi finestra|Fechar diálogo|ダイアログを閉じる|关闭对话框|關閉對話框
Dismiss notification|Meldung schließen|Descartar notificación|Fermer la notification|Chiudi notifica|Dispensar notificação|通知を閉じる|关闭通知|關閉通知
Retry|Erneut versuchen|Reintentar|Réessayer|Riprova|Tentar novamente|再試行|重试|重試
Skip to content|Zum Inhalt springen|Saltar al contenido|Aller au contenu|Vai al contenuto|Ir para o conteúdo|本文へ移動|跳转到内容|跳至內容
Main navigation|Hauptnavigation|Navegación principal|Navigation principale|Navigazione principale|Navegação principal|メインナビゲーション|主导航|主導覽
Color theme|Farbschema|Tema de color|Thème de couleur|Tema colore|Tema de cores|配色テーマ|颜色主题|色彩主題
System theme|Systemdesign|Tema del sistema|Thème du système|Tema di sistema|Tema do sistema|システムテーマ|系统主题|系統主題
Light theme|Helles Design|Tema claro|Thème clair|Tema chiaro|Tema claro|ライトテーマ|浅色主题|淺色主題
Dark theme|Dunkles Design|Tema oscuro|Thème sombre|Tema scuro|Tema escuro|ダークテーマ|深色主题|深色主題
Explorer|Explorer|Explorador|Explorateur|Esplora file|Explorador|エクスプローラー|资源管理器|檔案總管
Search|Suche|Buscar|Rechercher|Cerca|Pesquisar|検索|搜索|搜尋
Source Control|Quellcodeverwaltung|Control de código fuente|Contrôle de code source|Controllo versione|Controle de versão|ソース管理|源代码管理|原始碼管理
Run|Ausführen|Ejecutar|Exécuter|Esegui|Executar|実行|运行|執行
Tests|Tests|Pruebas|Tests|Test|Testes|テスト|测试|測試
Agents|Agents|Agentes|Agents|Agenti|Agentes|エージェント|代理|代理程式
Queue|Warteschlange|Cola|File d'attente|Coda|Fila|キュー|队列|佇列
Runs|Ausführungen|Ejecuciones|Exécutions|Esecuzioni|Execuções|実行履歴|运行记录|執行紀錄
Issues|Issues|Incidencias|Tickets|Issue|Issues|Issue|问题|議題
Scheduler|Zeitplanung|Programador|Planificateur|Pianificatore|Agendador|スケジューラー|调度器|排程器
Settings|Einstellungen|Configuración|Paramètres|Impostazioni|Configurações|設定|设置|設定
Primary sidebar|Primäre Seitenleiste|Barra lateral principal|Barre latérale principale|Barra laterale principale|Barra lateral principal|プライマリサイドバー|主侧边栏|主要側邊欄
Secondary panel|Sekundäres Panel|Panel secundario|Panneau secondaire|Pannello secondario|Painel secundário|セカンダリパネル|次面板|次要面板
Bottom panel|Unteres Panel|Panel inferior|Panneau inférieur|Pannello inferiore|Painel inferior|下部パネル|底部面板|底部面板
Return to Project Manager|Zur Projektverwaltung|Volver al gestor de proyectos|Retour au gestionnaire de projets|Torna al gestore progetti|Voltar ao gerenciador de projetos|プロジェクト管理に戻る|返回项目管理器|返回專案管理員
Workspace activities|Arbeitsbereichsaktionen|Actividades del espacio de trabajo|Activités de l'espace de travail|Attività dell'area di lavoro|Atividades do espaço de trabalho|ワークスペースの操作|工作区活动|工作區活動
Appearance & layout|Darstellung und Layout|Apariencia y diseño|Apparence et disposition|Aspetto e layout|Aparência e layout|外観とレイアウト|外观与布局|外觀與版面配置
Skip to editor|Zum Editor springen|Saltar al editor|Aller à l'éditeur|Vai all'editor|Ir para o editor|エディターへ移動|跳转到编辑器|跳至編輯器
Toggle {label}|{label} umschalten|Alternar {label}|Afficher/masquer {label}|Mostra/nascondi {label}|Alternar {label}|{label}を切り替え|切换{label}|切換{label}
Hide {label}|{label} ausblenden|Ocultar {label}|Masquer {label}|Nascondi {label}|Ocultar {label}|{label}を非表示|隐藏{label}|隱藏{label}
Resize bottom panel|Unteres Panel skalieren|Redimensionar panel inferior|Redimensionner le panneau inférieur|Ridimensiona pannello inferiore|Redimensionar painel inferior|下部パネルをサイズ変更|调整底部面板大小|調整底部面板大小
Resize secondary panel|Sekundäres Panel skalieren|Redimensionar panel secundario|Redimensionner le panneau secondaire|Ridimensiona pannello secondario|Redimensionar painel secundário|セカンダリパネルをサイズ変更|调整次面板大小|調整次要面板大小
Bottom panel tabs|Tabs im unteren Panel|Pestañas del panel inferior|Onglets du panneau inférieur|Schede del pannello inferiore|Abas do painel inferior|下部パネルのタブ|底部面板标签|底部面板頁籤
Terminal|Terminal|Terminal|Terminal|Terminale|Terminal|ターミナル|终端|終端機
Output|Ausgabe|Salida|Sortie|Output|Saída|出力|输出|輸出
Problems|Probleme|Problemas|Problèmes|Problemi|Problemas|問題|问题|問題
Agent|Agent|Agente|Agent|Agente|Agente|エージェント|代理|代理程式
Logs|Protokolle|Registros|Journaux|Log|Logs|ログ|日志|日誌
No folder connected|Kein Ordner verbunden|Ninguna carpeta conectada|Aucun dossier connecté|Nessuna cartella collegata|Nenhuma pasta conectada|フォルダー未接続|未连接文件夹|未連接資料夾
No open file|Keine Datei geöffnet|Ningún archivo abierto|Aucun fichier ouvert|Nessun file aperto|Nenhum arquivo aberto|ファイル未選択|未打开文件|未開啟檔案
unsaved|ungespeichert|sin guardar|non enregistré|non salvato|não salvo|未保存|未保存|未儲存
Open files|Geöffnete Dateien|Archivos abiertos|Fichiers ouverts|File aperti|Arquivos abertos|開いているファイル|打开的文件|開啟的檔案
No open editors|Keine Editoren geöffnet|Ningún editor abierto|Aucun éditeur ouvert|Nessun editor aperto|Nenhum editor aberto|エディター未選択|未打开编辑器|未開啟編輯器
Unsaved changes|Ungespeicherte Änderungen|Cambios sin guardar|Modifications non enregistrées|Modifiche non salvate|Alterações não salvas|未保存の変更|未保存的更改|未儲存的變更
Close {name}|{name} schließen|Cerrar {name}|Fermer {name}|Chiudi {name}|Fechar {name}|{name}を閉じる|关闭 {name}|關閉 {name}
Editor area|Editorbereich|Área del editor|Zone d'édition|Area editor|Área do editor|エディター領域|编辑区域|編輯區域
Select a file in Explorer|Datei im Explorer auswählen|Selecciona un archivo en el explorador|Sélectionnez un fichier dans l'explorateur|Seleziona un file in Esplora file|Selecione um arquivo no explorador|エクスプローラーでファイルを選択|在资源管理器中选择文件|在檔案總管中選取檔案
Save file|Datei speichern|Guardar archivo|Enregistrer le fichier|Salva file|Salvar arquivo|ファイルを保存|保存文件|儲存檔案
Save file (Ctrl+S)|Datei speichern (Ctrl+S)|Guardar archivo (Ctrl+S)|Enregistrer le fichier (Ctrl+S)|Salva file (Ctrl+S)|Salvar arquivo (Ctrl+S)|ファイルを保存 (Ctrl+S)|保存文件 (Ctrl+S)|儲存檔案 (Ctrl+S)
Save all files|Alle Dateien speichern|Guardar todos los archivos|Enregistrer tous les fichiers|Salva tutti i file|Salvar todos os arquivos|すべてのファイルを保存|保存所有文件|儲存所有檔案
Save|Speichern|Guardar|Enregistrer|Salva|Salvar|保存|保存|儲存
Save all|Alle speichern|Guardar todo|Tout enregistrer|Salva tutto|Salvar tudo|すべて保存|全部保存|全部儲存
Don't Save|Nicht speichern|No guardar|Ne pas enregistrer|Non salvare|Não salvar|保存しない|不保存|不儲存
Name|Name|Nombre|Nom|Nome|Nome|名前|名称|名稱
Connect Folder|Ordner verbinden|Conectar carpeta|Connecter un dossier|Collega cartella|Conectar pasta|フォルダーを接続|连接文件夹|連接資料夾
Your workspace|Ihr Arbeitsbereich|Tu espacio de trabajo|Votre espace de travail|La tua area di lavoro|Seu espaço de trabalho|ワークスペース|您的工作区|您的工作區
Choose a file in Explorer to start editing.|Wählen Sie eine Datei im Explorer.|Elige un archivo en el explorador para editar.|Choisissez un fichier dans l'explorateur.|Scegli un file in Esplora file per modificarlo.|Escolha um arquivo no explorador para editar.|エクスプローラーでファイルを選択して編集を開始してください。|在资源管理器中选择文件以开始编辑。|在檔案總管中選取檔案以開始編輯。
Connect a folder to browse and edit local files.|Verbinden Sie einen Ordner zum Bearbeiten lokaler Dateien.|Conecta una carpeta para editar archivos locales.|Connectez un dossier pour modifier les fichiers locaux.|Collega una cartella per modificare file locali.|Conecte uma pasta para editar arquivos locais.|フォルダーを接続してローカルファイルを編集してください。|连接文件夹以浏览和编辑本地文件。|連接資料夾以瀏覽和編輯本機檔案。
Loading editor…|Editor wird geladen…|Cargando editor…|Chargement de l'éditeur…|Caricamento editor…|Carregando editor…|エディターを読み込み中…|正在加载编辑器…|正在載入編輯器…
Loading diff editor…|Diff-Editor wird geladen…|Cargando editor de diferencias…|Chargement de l'éditeur de différences…|Caricamento editor diff…|Carregando editor de diferenças…|差分エディターを読み込み中…|正在加载差异编辑器…|正在載入差異編輯器…
Connected|Verbunden|Conectado|Connecté|Collegato|Conectado|接続済み|已连接|已連接
Disconnected|Getrennt|Desconectado|Déconnecté|Scollegato|Desconectado|未接続|已断开|已中斷
Connecting…|Verbindung wird hergestellt…|Conectando…|Connexion…|Connessione…|Conectando…|接続中…|正在连接…|正在連接…
Checking access…|Zugriff wird geprüft…|Comprobando acceso…|Vérification de l'accès…|Verifica accesso…|Verificando acesso…|アクセスを確認中…|正在检查访问权限…|正在檢查存取權限…
Unsupported|Nicht unterstützt|No compatible|Non pris en charge|Non supportato|Não suportado|未対応|不支持|不支援
Permission Denied|Zugriff verweigert|Permiso denegado|Accès refusé|Permesso negato|Permissão negada|アクセス拒否|权限被拒绝|權限遭拒
Access Required|Zugriff erforderlich|Acceso necesario|Accès requis|Accesso richiesto|Acesso necessário|アクセス許可が必要|需要访问权限|需要存取權限
Request Access|Zugriff anfordern|Solicitar acceso|Demander l'accès|Richiedi accesso|Solicitar acesso|アクセス許可を要求|请求访问权限|要求存取權限
Disconnect|Trennen|Desconectar|Déconnecter|Scollega|Desconectar|切断|断开连接|中斷連接
Refresh|Aktualisieren|Actualizar|Actualiser|Aggiorna|Atualizar|更新|刷新|重新整理
New File|Neue Datei|Nuevo archivo|Nouveau fichier|Nuovo file|Novo arquivo|新規ファイル|新建文件|新增檔案
New Folder|Neuer Ordner|Nueva carpeta|Nouveau dossier|Nuova cartella|Nova pasta|新規フォルダー|新建文件夹|新增資料夾
Rename|Umbenennen|Renombrar|Renommer|Rinomina|Renomear|名前を変更|重命名|重新命名
Delete|Löschen|Eliminar|Supprimer|Elimina|Excluir|削除|删除|刪除
Remove|Entfernen|Quitar|Retirer|Rimuovi|Remover|削除|移除|移除
Reload file from disk|Datei von Disk neu laden|Recargar archivo del disco|Recharger le fichier depuis le disque|Ricarica file dal disco|Recarregar arquivo do disco|ディスクから再読み込み|从磁盘重新加载文件|從磁碟重新載入檔案
Discard and reload|Verwerfen und neu laden|Descartar y recargar|Abandonner et recharger|Scarta e ricarica|Descartar e recarregar|破棄して再読み込み|放弃并重新加载|捨棄並重新載入
Repository|Repository|Repositorio|Dépôt|Repository|Repositório|リポジトリ|仓库|儲存庫
Refresh Git|Git aktualisieren|Actualizar Git|Actualiser Git|Aggiorna Git|Atualizar Git|Git を更新|刷新 Git|重新整理 Git
Changes|Änderungen|Cambios|Modifications|Modifiche|Alterações|変更|更改|變更
Staged Changes|Vorgemerkte Änderungen|Cambios preparados|Modifications indexées|Modifiche in staging|Alterações preparadas|ステージ済み変更|已暂存更改|已暫存變更
Conflicts|Konflikte|Conflictos|Conflits|Conflitti|Conflitos|競合|冲突|衝突
Stage All|Alles vormerken|Preparar todo|Tout indexer|Stage di tutto|Preparar tudo|すべてステージ|全部暂存|全部暫存
Unstage All|Alles zurücknehmen|Retirar todo de preparación|Tout désindexer|Rimuovi tutto dallo staging|Retirar tudo da preparação|すべてステージ解除|全部取消暂存|全部取消暫存
Stage|Vormerken|Preparar|Indexer|Stage|Preparar|ステージ|暂存|暫存
Unstage|Zurücknehmen|Retirar de preparación|Désindexer|Rimuovi dallo staging|Retirar da preparação|ステージ解除|取消暂存|取消暫存
Commit|Commit|Commit|Commit|Commit|Commit|コミット|提交|提交
Commit message|Commit-Nachricht|Mensaje de commit|Message de commit|Messaggio di commit|Mensagem de commit|コミットメッセージ|提交信息|提交訊息
Describe your staged changes|Vorgemerkte Änderungen beschreiben|Describe los cambios preparados|Décrivez les modifications indexées|Descrivi le modifiche in staging|Descreva as alterações preparadas|ステージ済み変更を説明|描述已暂存更改|描述已暫存變更
Commit staged changes|Vorgemerkte Änderungen committen|Confirmar cambios preparados|Valider les modifications indexées|Commit delle modifiche in staging|Confirmar alterações preparadas|ステージ済み変更をコミット|提交已暂存更改|提交已暫存變更
History|Verlauf|Historial|Historique|Cronologia|Histórico|履歴|历史记录|歷程紀錄
Available|Verfügbar|Disponible|Disponible|Disponibile|Disponível|利用可能|可用|可用
Unavailable|Nicht verfügbar|No disponible|Indisponible|Non disponibile|Indisponível|利用不可|不可用|無法使用
No repository|Kein Repository|Sin repositorio|Aucun dépôt|Nessun repository|Sem repositório|リポジトリなし|无仓库|無儲存庫
No commits yet.|Noch keine Commits.|Aún no hay commits.|Aucun commit pour le moment.|Nessun commit ancora.|Ainda não há commits.|コミットはまだありません。|暂无提交。|尚無提交。
Desktop runtime required|Desktop-Laufzeit erforderlich|Se requiere entorno de escritorio|Environnement de bureau requis|Runtime desktop richiesto|Runtime desktop necessário|デスクトップ環境が必要|需要桌面运行时|需要桌面執行環境
Read only|Schreibgeschützt|Solo lectura|Lecture seule|Sola lettura|Somente leitura|読み取り専用|只读|唯讀
Close diff|Diff schließen|Cerrar diferencias|Fermer les différences|Chiudi diff|Fechar diferenças|差分を閉じる|关闭差异|關閉差異
No|Keine|No|Aucun|Nessuno|Não|なし|无|無
Yes|Ja|Sí|Oui|Sì|Sim|はい|是|是
Stop|Stoppen|Detener|Arrêter|Ferma|Parar|停止|停止|停止
Start|Starten|Iniciar|Démarrer|Avvia|Iniciar|開始|开始|開始
Add|Hinzufügen|Añadir|Ajouter|Aggiungi|Adicionar|追加|添加|新增
Edit|Bearbeiten|Editar|Modifier|Modifica|Editar|編集|编辑|編輯
Enabled|Aktiviert|Activado|Activé|Abilitato|Ativado|有効|已启用|已啟用
Disabled|Deaktiviert|Desactivado|Désactivé|Disabilitato|Desativado|無効|已禁用|已停用
Status|Status|Estado|État|Stato|Status|状態|状态|狀態
Result|Ergebnis|Resultado|Résultat|Risultato|Resultado|結果|结果|結果
Summary|Zusammenfassung|Resumen|Résumé|Riepilogo|Resumo|概要|摘要|摘要
Details|Details|Detalles|Détails|Dettagli|Detalhes|詳細|详情|詳細資料
Test|Test|Prueba|Test|Test|Teste|テスト|测试|測試
Task|Aufgabe|Tarea|Tâche|Attività|Tarefa|タスク|任务|工作
Steps|Schritte|Pasos|Étapes|Passaggi|Etapas|ステップ|步骤|步驟
Step|Schritt|Paso|Étape|Passaggio|Etapa|ステップ|步骤|步驟
Evidence|Nachweise|Evidencias|Preuves|Prove|Evidências|証跡|证据|證據
Artifacts|Artefakte|Artefactos|Artefacts|Artefatti|Artefatos|成果物|产物|產物
Duration|Dauer|Duración|Durée|Durata|Duração|所要時間|耗时|耗時
Created|Erstellt|Creado|Créé|Creato|Criado|作成日時|创建时间|建立時間
Updated|Aktualisiert|Actualizado|Mis à jour|Aggiornato|Atualizado|更新日時|更新时间|更新時間
Started|Gestartet|Iniciado|Démarré|Avviato|Iniciado|開始日時|开始时间|開始時間
Finished|Beendet|Finalizado|Terminé|Terminato|Finalizado|終了日時|结束时间|結束時間
Revision|Revision|Revisión|Révision|Revisione|Revisão|リビジョン|修订|修訂
Attempt|Versuch|Intento|Tentative|Tentativo|Tentativa|試行|尝试|嘗試
Priority|Priorität|Prioridad|Priorité|Priorità|Prioridade|優先度|优先级|優先順序
Platform|Plattform|Plataforma|Plateforme|Piattaforma|Plataforma|プラットフォーム|平台|平台
Browser|Browser|Navegador|Navigateur|Browser|Navegador|ブラウザー|浏览器|瀏覽器
Architecture|Architektur|Arquitectura|Architecture|Architettura|Arquitetura|アーキテクチャ|架构|架構
Capabilities|Funktionen|Capacidades|Capacités|Funzionalità|Recursos|機能|能力|功能
Tags|Tags|Etiquetas|Étiquettes|Tag|Tags|タグ|标签|標籤
Endpoint|Endpunkt|Punto de conexión|Point de connexion|Endpoint|Endpoint|エンドポイント|端点|端點
Token|Token|Token|Jeton|Token|Token|トークン|令牌|權杖
Reason|Grund|Motivo|Motif|Motivo|Motivo|理由|原因|原因
None|Keine|Ninguno|Aucun|Nessuno|Nenhum|なし|无|無
Loading…|Wird geladen…|Cargando…|Chargement…|Caricamento…|Carregando…|読み込み中…|正在加载…|正在載入…
Something went wrong|Ein Fehler ist aufgetreten|Algo salió mal|Une erreur est survenue|Si è verificato un errore|Algo deu errado|エラーが発生しました|发生错误|發生錯誤
Project unavailable|Projekt nicht verfügbar|Proyecto no disponible|Projet indisponible|Progetto non disponibile|Projeto indisponível|プロジェクトを利用できません|项目不可用|專案無法使用
Opening project…|Projekt wird geöffnet…|Abriendo proyecto…|Ouverture du projet…|Apertura progetto…|Abrindo projeto…|プロジェクトを開いています…|正在打开项目…|正在開啟專案…
Opening folder…|Ordner wird geöffnet…|Abriendo carpeta…|Ouverture du dossier…|Apertura cartella…|Abrindo pasta…|フォルダーを開いています…|正在打开文件夹…|正在開啟資料夾…
Waiting for folder selection…|Auf Ordnerauswahl warten…|Esperando selección de carpeta…|En attente du choix d'un dossier…|In attesa della selezione della cartella…|Aguardando seleção de pasta…|フォルダーの選択を待機中…|等待选择文件夹…|等待選取資料夾…
passed|bestanden|aprobado|réussi|superato|aprovado|成功|通过|通過
failed|fehlgeschlagen|fallido|échoué|fallito|falhou|失敗|失败|失敗
running|läuft|en ejecución|en cours|in esecuzione|em execução|実行中|运行中|執行中
queued|eingereiht|en cola|en attente|in coda|na fila|待機中|已入队|已排入佇列
cancelled|abgebrochen|cancelado|annulé|annullato|cancelado|キャンセル済み|已取消|已取消
pending|ausstehend|pendiente|en attente|in attesa|pendente|保留中|待处理|待處理
idle|inaktiv|inactivo|inactif|inattivo|ocioso|待機|空闲|閒置
ready|bereit|listo|prêt|pronto|pronto|準備完了|就绪|就緒
offline|offline|sin conexión|hors ligne|offline|offline|オフライン|离线|離線
online|online|en línea|en ligne|online|online|オンライン|在线|線上
busy|beschäftigt|ocupado|occupé|occupato|ocupado|処理中|忙碌|忙碌
available|verfügbar|disponible|disponible|disponibile|disponível|利用可能|可用|可用
unavailable|nicht verfügbar|no disponible|indisponible|non disponibile|indisponível|利用不可|不可用|無法使用
completed|abgeschlossen|completado|terminé|completato|concluído|完了|已完成|已完成
skipped|übersprungen|omitido|ignoré|saltato|ignorado|スキップ|已跳过|已略過
timeout|Zeitüberschreitung|tiempo agotado|délai dépassé|tempo scaduto|tempo esgotado|タイムアウト|超时|逾時
rejected|abgelehnt|rechazado|rejeté|rifiutato|rejeitado|却下|已拒绝|已拒絕
approved|genehmigt|aprobado|approuvé|approvato|aprovado|承認済み|已批准|已核准
proposed|vorgeschlagen|propuesto|proposé|proposto|proposto|提案済み|已提议|已提案
applied|angewendet|aplicado|appliqué|applicato|aplicado|適用済み|已应用|已套用
reverted|zurückgesetzt|revertido|annulé|ripristinato|revertido|復元済み|已还原|已還原
validating|wird geprüft|validando|validation en cours|convalida in corso|validando|検証中|验证中|驗證中
retesting|erneuter Test|repitiendo prueba|nouveau test|nuovo test|testando novamente|再テスト中|重新测试中|重新測試中
open|offen|abierto|ouvert|aperto|aberto|未解決|打开|開啟
closed|geschlossen|cerrado|fermé|chiuso|fechado|解決済み|已关闭|已關閉
Choose folder|Ordner auswählen|Elegir carpeta|Choisir un dossier|Scegli cartella|Escolher pasta|フォルダーを選択|选择文件夹|選擇資料夾`;
export const additionalLanguages=['de','es','fr','it','pt','ja','zh','zh-hant'] as const;
export const international:Partial<Record<Language,Record<string,string>>>=Object.fromEntries(additionalLanguages.map((language,index)=>[language,Object.fromEntries(rows.split('\n').map(row=>{const cells=row.split('|');if(cells.length!==9)throw new Error('Invalid translation row: '+cells[0]);return[cells[0],cells[index+1]];}))]));
