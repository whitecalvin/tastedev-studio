export const orchestrationKorean: Readonly<Record<string,string>> = {
 "AI configurations":"AI 구성",
 "AI configuration":"AI 구성",
 "Add AI configuration":"AI 구성 추가",
 "Save AI configurations":"AI 구성 저장",
 "Remove AI configuration":"AI 구성 제거",
 "AI provider":"AI 공급자",
 "Local AI":"로컬 AI",
 "Configured on Core":"Core 설정 사용",
 "Connection method":"연결 방식",
 "Core connection":"Core 연결",
 "API connection":"API 연결",
 "Account connection":"계정 연결",
 "Local connection":"로컬 연결",
 "AI development tool":"AI 개발 도구",
 "AI service":"AI 서비스",
 "AI role":"AI 담당 역할",
 "Code review":"코드 리뷰",
 "Design":"설계",
 "Execution location":"실행 위치",
 "Core host":"Core 장비",
 "Assigned device":"배정 장비",
 "External service":"외부 서비스",
 "Connection reference":"연결 참조 (인증값 제외)",
 "Timeout seconds":"시간 제한 (초)",
 "AI prompt":"AI 프롬프트",
 "Prompt preview":"프롬프트 미리보기",
 "Task AI":"작업 담당 AI",
 "Task bindings":"AI 배정 작업",
 "Invalid AI configuration.":"AI 구성이 올바르지 않습니다.",
 "AI configuration changed in another window.":"다른 창에서 AI 구성이 변경되었습니다. 현재 편집 내용은 보존됩니다.",
 "AI configurations saved. No request was sent.":"AI 구성을 저장했습니다. 요청은 전송하지 않았습니다.",
 "Configurations describe the requested AI. Provider routing is not activated by saving. Credentials stay on the connection host.":"사용할 AI를 구성합니다. 저장만으로 공급자 연결이나 실행은 활성화되지 않습니다. 인증값은 연결 장비에서 관리합니다.",
 "Configuration only. Graph AI dispatch is not yet connected; existing Core AI analysis remains available. All source changes require separate approval.":"그래프 자동 AI 실행은 아직 연결되지 않았습니다. 기존 Core AI 분석을 사용할 수 있으며, Source 변경은 별도 승인이 필요합니다.",
 "Bind an AI configuration in the task inspector. The exact task prompt is shown there.":"작업 노드 설정에서 AI 구성을 배정하세요. 해당 작업의 프롬프트도 표시됩니다.",
 "Prepare prompt in AI":"AI 화면에서 프롬프트 준비",
 "Preparation does not send data. Core selects the actual provider and model. Other connections require an adapter; no fallback is used.":"준비는 데이터를 전송하지 않습니다. 현재는 OpenAI·Core 연결·AI 서비스·Core 장비·모델 및 연결 참조 공란인 구성을 지원합니다. 실제 공급자와 모델은 Core 설정을 사용합니다. 다른 연결은 어댑터가 필요하며 임의 대체하지 않습니다.",
 "Arrange flow":"흐름 정렬",
 "paused":"일시 중지",
 "launching":"실행 준비 중",
 "cancelling":"취소 중",
 "Execution controls":"실행 제어",
 "Graph execution is unavailable.":"해당 실행을 사용할 수 없습니다.",
 "This execution is already finished.":"이미 종료된 실행입니다.",
 "Review the saved graph version before continuing.":"계속하기 전에 저장된 구성 버전을 검토하세요.",
 "Review this execution before continuing.":"계속하기 전에 이번 실행을 검토하세요.",
 "Execution monitoring":"실행 관제",
 "No execution has been recorded.":"기록된 실행이 없습니다.",
 "This execution differs from the current graph. Node states are hidden.":"현재 구성과 다른 버전의 실행입니다. 노드 상태는 표시하지 않습니다.",
 "Bind graph schedules disabled":"그래프 스케줄 연결 (비활성)",
 "Graph schedules saved disabled. Review and enable them in Scheduler.":"그래프 스케줄은 비활성 상태로 저장됩니다. Scheduler에서 검토 후 활성화하세요.",
 "Enabled — allow automatic reviewed graph execution":"활성화 — 검토한 그래프 자동 실행 허용",
 "Execution Source":"실행 Source",
 "Saved workspace snapshot":"저장된 작업 공간 Snapshot",
 "Protocol Source / Agent workspace":"Protocol Source / Agent 작업 공간",
 "Transfer the saved, secret-filtered Source to the connected Core for this graph.":"이 구성에 사용할 저장된 Source를 Secret 제외 후 연결된 Core로 전송합니다.",
 "Snapshot files":"Snapshot 파일",
 "Excluded entries":"제외 항목",
 "Review execution scope":"실행 범위 검토",
 "Deadline":"제한 시간",
 "Save Protocol changes before publishing.":"등록 전에 Protocol 변경을 저장하세요.",
 "Core revision":"Core 버전",
 "Approve this activation":"이번 단계 승인",
 "Start reviewed graph":"검토한 구성 실행",
 "Review and resume":"검토 후 재개",
 "Publish graph to Core":"Core에 구성 등록",
 "Protocol input checksum":"Protocol 입력 체크섬",
 "Durable storage":"영속 저장",
 "Entry node":"시작 노드",
 "Cancel execution":"실행 취소",
 "I reviewed this version and approve its Protocol execution.":"이 버전의 실행 범위를 검토했으며 Protocol 실행을 승인합니다.",
 "Core graph execution":"Core 그래프 실행",
 "Saving a graph does not run work. Publish validates saved Protocol and Agent assignments; start requires review.":"구성 저장은 실행을 시작하지 않습니다. Core 등록 시 저장된 Protocol과 Agent 배정을 검사하며, 실행 전 검토가 필요합니다.",
 "Maximum node attempts":"노드 최대 시도",
 "Memory storage; restart loses graph history":"메모리 저장: 재시작하면 그래프 이력이 사라집니다",
 'Test':'테스트',
 'Zoom':'확대·축소',
 'Graph changed in another window. Your draft is preserved.':'다른 창에서 구성이 변경되었습니다. 현재 편집 내용은 유지됩니다. 다시 열어 변경 사항을 검토하세요.',
 'An Agent can only be bound once in a project graph.':'하나의 에이전트는 프로젝트 구성에 한 번만 연결할 수 있습니다.',
 'An Agent node can only belong to one device.':'에이전트 노드는 하나의 장비에만 속할 수 있습니다.',
 'Connect to Core in Agents.':'에이전트 화면에서 Core에 연결하세요.',
 'Project orchestration':'프로젝트 오케스트레이션','Project kind':'프로젝트 종류','Current PC roles':'현재 PC 역할',
 'One PC can have multiple roles. Agent connection is configured after creation.':'한 PC가 여러 역할을 맡을 수 있습니다. 에이전트는 생성 후 연결합니다.',
 'Devices, roles and work are connected here. Files are supporting tools.':'장비·역할·작업의 관계를 구성합니다. 파일은 작업을 지원하는 도구입니다.',
 'Connect devices, roles, agents and the implementation → deployment → testing flow.':'장비·역할·에이전트와 구현 → 배포 → 테스트 흐름을 연결하세요.',
 'Save graph':'구성 저장','Devices':'장비','Roles':'역할','Connected agents':'연결된 에이전트','Relationships':'관계',
 'Unsaved graph':'저장하지 않은 구성','Saved / initial configuration':'저장된 구성 / 초기 구성',
 'Design mode: relationships do not execute work. Use existing execution and approval screens. Core graph automation is not connected yet.':'설계 모드: 연결선만으로 작업은 실행되지 않습니다. 기존 실행·승인 화면을 사용하세요. Core의 그래프 자동 실행은 아직 연결되지 않았습니다.',
 'Add node':'노드 추가','Drag the handle to move a node. Arrow keys also move it.':'노드 상단을 끌거나 방향키로 이동하세요.',
 'Relationship canvas':'관계 캔버스','Move {label}':'{label} 이동','Node settings':'노드 설정','Select a node to configure its relationships.':'노드를 선택하여 설정과 관계를 편집하세요.',
 'Agent binding':'에이전트 연결','Execution definition':'실행 정의','Protocol reference':'Protocol 참조','Choose a Protocol reference':'Protocol 참조 선택',
 'Open execution settings':'실행 설정 열기','Schedule binding':'스케줄 연결','Open Scheduler':'스케줄러 열기',
 'Device membership is declared here. It is not inferred from an Agent ID.':'장비 소속은 명시적으로 구성합니다. 에이전트 ID로 장비를 추정하지 않습니다.',
 'This node expresses a review gate. It does not grant execution or write permission.':'검토 단계를 표현하는 노드입니다. 실행·쓰기 권한을 부여하지 않습니다.',
 'Connect to':'관계 연결','Target node':'대상 노드','Select a node':'노드 선택','Relationship':'관계','Add relationship':'관계 추가','Remove relationship':'관계 제거','Remove node':'노드 제거',
 'Removing a graph node never deletes files, agents or running work.':'노드를 제거해도 파일·에이전트·실행 중인 작업은 삭제되지 않습니다.',
 'Open Agents':'에이전트 열기','Open Runs':'실행 기록 열기','Current PC':'현재 PC','Declared device':'등록할 장비','Configured role':'설정된 역할',
 'Review required':'검토 필요','Reference unavailable':'참조를 찾을 수 없음','Defined':'정의됨','Not configured':'미설정','Not connected':'미연결',
 'Graph saved. No work was executed.':'구성을 저장했습니다. 작업은 실행하지 않았습니다.',
 'Graph could not be saved. Your draft is preserved.':'구성을 저장하지 못했습니다. 편집 내용은 유지됩니다.',
 'Add a device and its roles to begin.':'장비와 역할을 추가하여 시작하세요.',
 'Invalid project graph. Saved data is unchanged.':'프로젝트 구성이 유효하지 않습니다. 저장 데이터는 변경하지 않았습니다.',
 'Invalid node.':'노드가 유효하지 않습니다.','Invalid or duplicate relationship.':'유효하지 않거나 중복된 관계입니다.','Success path cannot contain a cycle.':'성공 경로에 순환 관계를 만들 수 없습니다.',
 'Select at least one device role.':'장비 역할을 하나 이상 선택하세요.',
 web:'웹',desktop:'데스크톱',mobile:'모바일',server:'서버/API',library:'라이브러리/CLI',composite:'복합',custom:'사용자 정의',
 device:'장비',agent:'에이전트',role:'역할',task:'작업',approval:'승인',schedule:'스케줄',implementation:'구현',deployment:'배포',testing:'테스트',
 hosts:'장비 소속',assigns:'역할 배정',performs:'작업 담당',success:'성공 후 진행',failure:'실패 피드백',triggers:'실행 조건',
};
const locales = ['de','es','fr','it','pt','ja','zh','zh-hant'] as const;
const rows = `Zoom|Zoom|Zoom|Zoom|Zoom|Zoom|ズーム|缩放|縮放
Test|Test|Prueba|Test|Test|Teste|テスト|测试|測試
web|Web|Web|Web|Web|Web|ウェブ|网页|網頁
desktop|Desktop|Escritorio|Bureau|Desktop|Desktop|デスクトップ|桌面|桌面
mobile|Mobil|Móvil|Mobile|Mobile|Móvel|モバイル|移动|行動
server|Server/API|Servidor/API|Serveur/API|Server/API|Servidor/API|サーバー/API|服务器/API|伺服器/API
library|Bibliothek/CLI|Biblioteca/CLI|Bibliothèque/CLI|Libreria/CLI|Biblioteca/CLI|ライブラリ/CLI|库/CLI|程式庫/CLI
composite|Verbundprojekt|Proyecto compuesto|Projet composite|Progetto composito|Projeto composto|複合|复合|複合
custom|Benutzerdefiniert|Personalizado|Personnalisé|Personalizzato|Personalizado|カスタム|自定义|自訂
device|Gerät|Equipo|Appareil|Dispositivo|Dispositivo|装置|设备|裝置
agent|Agent|Agente|Agent|Agente|Agente|エージェント|代理|代理程式
role|Rolle|Rol|Rôle|Ruolo|Função|役割|角色|角色
task|Aufgabe|Tarea|Tâche|Attività|Tarefa|作業|工作|工作
approval|Freigabe|Aprobación|Approbation|Approvazione|Aprovação|承認|审批|審批
schedule|Zeitplan|Programación|Planification|Pianificazione|Agendamento|スケジュール|计划|排程
implementation|Implementierung|Implementación|Développement|Sviluppo|Implementação|実装|实现|實作
deployment|Bereitstellung|Despliegue|Déploiement|Distribuzione|Implantação|配備|部署|部署
testing|Tests|Pruebas|Tests|Test|Testes|テスト|测试|測試
hosts|Gerätezugehörigkeit|Alojamiento|Appartenance|Appartenenza|Associação|装置の所属|设备归属|裝置歸屬
assigns|Rollenzuweisung|Asignación de rol|Attribution de rôle|Assegnazione ruolo|Atribuição de função|役割の割当|角色分配|角色指派
performs|Aufgabenverantwortung|Responsabilidad de tarea|Responsabilité de tâche|Responsabilità attività|Responsabilidade de tarefa|作業担当|工作负责|工作負責
success|Nach Erfolg|Tras éxito|Après réussite|Dopo successo|Após sucesso|成功後に進行|成功后继续|成功後繼續
failure|Fehlerrückmeldung|Respuesta al fallo|Retour d’échec|Feedback errore|Retorno de falha|失敗フィードバック|失败反馈|失敗回饋
triggers|Auslöser|Condición de inicio|Condition de lancement|Condizione di avvio|Condição de início|実行条件|执行条件|執行條件
Current PC|Dieser PC|Este PC|Ce PC|Questo PC|Este PC|現在のPC|当前PC|目前PC
Declared device|Deklariertes Gerät|Equipo declarado|Appareil déclaré|Dispositivo dichiarato|Dispositivo declarado|宣言された装置|声明的设备|宣告的裝置
Configured role|Konfigurierte Rolle|Rol configurado|Rôle configuré|Ruolo configurato|Função configurada|設定済み役割|已配置角色|已設定角色
Review required|Prüfung erforderlich|Revisión requerida|Revue requise|Revisione richiesta|Revisão necessária|レビューが必要|需要审查|需要審查
Defined|Definiert|Definido|Défini|Definito|Definido|定義済み|已定义|已定義
Graph saved. No work was executed.|Graph gespeichert. Keine Aufgabe ausgeführt.|Grafo guardado. No se ejecutó ninguna tarea.|Graphe enregistré. Aucune tâche exécutée.|Grafo salvato. Nessuna attività eseguita.|Grafo guardado. Nenhuma tarefa executada.|構成を保存しました。作業は実行していません。|图已保存。未执行工作。|圖已儲存。未執行工作。
Graph could not be saved. Your draft is preserved.|Graph konnte nicht gespeichert werden. Entwurf bleibt erhalten.|No se pudo guardar el grafo. El borrador se conserva.|Impossible d’enregistrer le graphe. Le brouillon est conservé.|Impossibile salvare il grafo. La bozza è conservata.|Não foi possível guardar o grafo. O rascunho foi preservado.|構成を保存できませんでした。下書きは保持されています。|无法保存图。草稿已保留。|無法儲存圖。草稿已保留。
Project orchestration|Projektorchestrierung|Orquestación del proyecto|Orchestration du projet|Orchestrazione del progetto|Orquestração do projeto|プロジェクトオーケストレーション|项目编排|專案編排
Devices, roles and work are connected here. Files are supporting tools.|Hier werden Geräte, Rollen und Aufgaben verbunden. Dateien sind Hilfsmittel.|Aquí se conectan equipos, roles y tareas. Los archivos son herramientas de apoyo.|Reliez ici les appareils, rôles et tâches. Les fichiers sont des outils de soutien.|Qui si collegano dispositivi, ruoli e attività. I file sono strumenti di supporto.|Aqui são ligados dispositivos, funções e tarefas. Os ficheiros são ferramentas de apoio.|装置・役割・作業を接続します。ファイルは補助ツールです。|在此连接设备、角色和工作。文件是辅助工具。|在此連接裝置、角色和工作。檔案是輔助工具。
Connect to Core in Agents.|In Agents mit Core verbinden.|Conecte con Core en Agentes.|Connectez-vous à Core dans Agents.|Connetti a Core in Agenti.|Ligue ao Core em Agentes.|エージェント画面でCoreに接続してください。|在代理界面连接Core。|在代理程式介面連接Core。
Connect devices, roles, agents and the implementation → deployment → testing flow.|Geräte, Rollen, Agents und Implementierung → Bereitstellung → Tests verbinden.|Conecte equipos, roles, agentes y el flujo implementación → despliegue → pruebas.|Reliez appareils, rôles, agents et le flux développement → déploiement → tests.|Collega dispositivi, ruoli, agenti e il flusso sviluppo → distribuzione → test.|Ligue dispositivos, funções, agentes e o fluxo implementação → implantação → testes.|装置・役割・エージェントと実装 → 配備 → テストの流れを接続します。|连接设备、角色、代理及实现 → 部署 → 测试流程。|連接裝置、角色、代理程式及實作 → 部署 → 測試流程。
Save graph|Graph speichern|Guardar grafo|Enregistrer le graphe|Salva grafo|Guardar grafo|構成を保存|保存图|儲存圖
Devices|Geräte|Equipos|Appareils|Dispositivi|Dispositivos|装置|设备|裝置
Roles|Rollen|Roles|Rôles|Ruoli|Funções|役割|角色|角色
Connected agents|Verbundene Agents|Agentes conectados|Agents connectés|Agenti connessi|Agentes ligados|接続済みエージェント|已连接代理|已連接代理程式
Relationships|Beziehungen|Relaciones|Relations|Relazioni|Relações|関係|关系|關係
Unsaved graph|Ungespeicherter Graph|Grafo sin guardar|Graphe non enregistré|Grafo non salvato|Grafo não guardado|未保存の構成|未保存的图|未儲存的圖
Saved / initial configuration|Gespeicherte / anfängliche Konfiguration|Configuración guardada / inicial|Configuration enregistrée / initiale|Configurazione salvata / iniziale|Configuração guardada / inicial|保存済み／初期構成|已保存／初始配置|已儲存／初始設定
Design mode: relationships do not execute work. Use existing execution and approval screens. Core graph automation is not connected yet.|Entwurfsmodus: Beziehungen führen keine Aufgaben aus. Bestehende Ausführungs- und Freigabeansichten verwenden. Die Graph-Automatisierung im Core ist noch nicht angebunden.|Modo de diseño: las relaciones no ejecutan tareas. Use las pantallas existentes de ejecución y aprobación. La automatización del grafo en Core aún no está conectada.|Mode conception : les relations n’exécutent aucune tâche. Utilisez les écrans d’exécution et d’approbation existants. L’automatisation du graphe dans Core n’est pas encore connectée.|Modalità progettazione: le relazioni non eseguono attività. Usa le schermate di esecuzione e approvazione esistenti. L’automazione del grafo in Core non è ancora collegata.|Modo de desenho: as relações não executam tarefas. Use os ecrãs existentes de execução e aprovação. A automatização do grafo no Core ainda não está ligada.|設計モード：関係だけでは作業を実行しません。既存の実行・承認画面を使用してください。Coreのグラフ自動実行はまだ接続されていません。|设计模式：关系不会执行工作。请使用现有执行和审批界面。Core图自动执行尚未连接。|設計模式：關係不會執行工作。請使用現有執行和審批介面。Core圖自動執行尚未連接。
Project kind|Projektart|Tipo de proyecto|Type de projet|Tipo di progetto|Tipo de projeto|プロジェクトの種類|项目类型|專案類型
Add node|Knoten hinzufügen|Añadir nodo|Ajouter un nœud|Aggiungi nodo|Adicionar nó|ノードを追加|添加节点|新增節點
Drag the handle to move a node. Arrow keys also move it.|Knoten am Griff ziehen oder mit Pfeiltasten bewegen.|Arrastre el asa para mover el nodo. También puede usar las flechas.|Déplacez le nœud par sa poignée ou avec les touches fléchées.|Trascina la maniglia o usa i tasti freccia per spostare il nodo.|Arraste a pega ou use as setas para mover o nó.|上部をドラッグするか矢印キーでノードを移動します。|拖动顶部或使用方向键移动节点。|拖動頂部或使用方向鍵移動節點。
Relationship canvas|Beziehungsfläche|Lienzo de relaciones|Canevas des relations|Area delle relazioni|Tela de relações|関係キャンバス|关系画布|關係畫布
Move {label}|{label} bewegen|Mover {label}|Déplacer {label}|Sposta {label}|Mover {label}|{label}を移動|移动{label}|移動{label}
Add a device and its roles to begin.|Zum Start Gerät und Rollen hinzufügen.|Añada un equipo y sus roles para comenzar.|Ajoutez un appareil et ses rôles pour commencer.|Aggiungi un dispositivo e i suoi ruoli per iniziare.|Adicione um dispositivo e as suas funções para começar.|装置と役割を追加して開始してください。|添加设备及其角色以开始。|新增裝置及其角色以開始。
Node settings|Knoteneinstellungen|Configuración del nodo|Paramètres du nœud|Impostazioni nodo|Definições do nó|ノード設定|节点设置|節點設定
Select a node to configure its relationships.|Knoten zum Konfigurieren seiner Beziehungen auswählen.|Seleccione un nodo para configurar sus relaciones.|Sélectionnez un nœud pour configurer ses relations.|Seleziona un nodo per configurare le sue relazioni.|Selecione um nó para configurar as suas relações.|ノードを選択して関係を設定してください。|选择节点以配置其关系。|選擇節點以設定其關係。
Agent binding|Agent-Zuordnung|Vinculación de agente|Association d’agent|Associazione agente|Associação de agente|エージェント接続|代理绑定|代理程式綁定
Reference unavailable|Referenz nicht verfügbar|Referencia no disponible|Référence indisponible|Riferimento non disponibile|Referência indisponível|参照が見つかりません|引用不可用|參照無法使用
Execution definition|Ausführungsdefinition|Definición de ejecución|Définition d’exécution|Definizione di esecuzione|Definição de execução|実行定義|执行定义|執行定義
Protocol reference|Protocol-Referenz|Referencia de Protocol|Référence Protocol|Riferimento Protocol|Referência Protocol|Protocol参照|Protocol引用|Protocol參照
Choose a Protocol reference|Protocol-Referenz wählen|Elegir referencia de Protocol|Choisir une référence Protocol|Scegli riferimento Protocol|Escolher referência Protocol|Protocol参照を選択|选择Protocol引用|選擇Protocol參照
Open execution settings|Ausführungseinstellungen öffnen|Abrir configuración de ejecución|Ouvrir les paramètres d’exécution|Apri impostazioni di esecuzione|Abrir definições de execução|実行設定を開く|打开执行设置|開啟執行設定
Schedule binding|Zeitplan-Zuordnung|Vinculación de programación|Association de planification|Associazione pianificazione|Associação de agendamento|スケジュール接続|计划绑定|排程綁定
Open Scheduler|Scheduler öffnen|Abrir programador|Ouvrir le planificateur|Apri pianificatore|Abrir agendador|スケジューラーを開く|打开调度器|開啟排程器
Device membership is declared here. It is not inferred from an Agent ID.|Die Gerätezugehörigkeit wird hier festgelegt, nicht aus einer Agent-ID abgeleitet.|La pertenencia al equipo se declara aquí; no se deduce del ID del agente.|L’appartenance à un appareil est déclarée ici, jamais déduite d’un ID d’agent.|L’appartenenza al dispositivo è dichiarata qui, non dedotta da un ID agente.|A associação ao dispositivo é declarada aqui, não deduzida do ID do agente.|装置の所属はここで明示します。エージェントIDから推測しません。|在此声明设备归属，不从代理ID推断。|在此宣告裝置歸屬，不從代理程式ID推斷。
This node expresses a review gate. It does not grant execution or write permission.|Dieser Knoten beschreibt eine Prüfung und gewährt keine Ausführungs- oder Schreibrechte.|Este nodo representa una revisión; no otorga permisos de ejecución ni escritura.|Ce nœud représente une étape de revue, sans accorder de droits d’exécution ou d’écriture.|Questo nodo rappresenta una revisione, senza concedere permessi di esecuzione o scrittura.|Este nó representa uma revisão, sem conceder permissões de execução ou escrita.|このノードはレビュー段階を表し、実行・書き込み権限を付与しません。|此节点表示审查关卡，不授予执行或写入权限。|此節點表示審查關卡，不授予執行或寫入權限。
Connect to|Verbinden mit|Conectar con|Relier à|Collega a|Ligar a|接続先|连接到|連接至
Target node|Zielknoten|Nodo destino|Nœud cible|Nodo destinazione|Nó de destino|対象ノード|目标节点|目標節點
Select a node|Knoten auswählen|Seleccionar nodo|Sélectionner un nœud|Seleziona nodo|Selecionar nó|ノードを選択|选择节点|選擇節點
Relationship|Beziehung|Relación|Relation|Relazione|Relação|関係|关系|關係
Add relationship|Beziehung hinzufügen|Añadir relación|Ajouter une relation|Aggiungi relazione|Adicionar relação|関係を追加|添加关系|新增關係
Remove relationship|Beziehung entfernen|Eliminar relación|Retirer la relation|Rimuovi relazione|Remover relação|関係を削除|移除关系|移除關係
Remove node|Knoten entfernen|Eliminar nodo|Retirer le nœud|Rimuovi nodo|Remover nó|ノードを削除|移除节点|移除節點
Removing a graph node never deletes files, agents or running work.|Das Entfernen eines Knotens löscht keine Dateien, Agents oder laufenden Aufgaben.|Eliminar un nodo no borra archivos, agentes ni tareas en ejecución.|Retirer un nœud ne supprime aucun fichier, agent ou travail en cours.|Rimuovere un nodo non elimina file, agenti o attività in corso.|Remover um nó não elimina ficheiros, agentes ou tarefas em execução.|ノードの削除でファイル・エージェント・実行中の作業は削除されません。|移除节点不会删除文件、代理或运行中的工作。|移除節點不會刪除檔案、代理程式或執行中的工作。
Open Agents|Agents öffnen|Abrir agentes|Ouvrir les agents|Apri agenti|Abrir agentes|エージェントを開く|打开代理|開啟代理程式
Open Runs|Ausführungen öffnen|Abrir ejecuciones|Ouvrir les exécutions|Apri esecuzioni|Abrir execuções|実行履歴を開く|打开运行记录|開啟執行記錄
Arrange flow|Ablauf anordnen|Ordenar flujo|Organiser le flux|Disponi flusso|Organizar fluxo|フローを整列|排列流程|排列流程
paused|Pausiert|En pausa|En pause|In pausa|Pausado|一時停止|已暂停|已暫停
launching|Wird gestartet|Iniciando|Démarrage|Avvio|A iniciar|起動中|启动中|啟動中
cancelling|Wird abgebrochen|Cancelando|Annulation|Annullamento|A cancelar|キャンセル中|正在取消|正在取消
Current PC roles|Rollen dieses PCs|Roles de este PC|Rôles de ce PC|Ruoli di questo PC|Funções deste PC|現在のPCの役割|当前PC角色|目前PC角色
One PC can have multiple roles. Agent connection is configured after creation.|Ein PC kann mehrere Rollen übernehmen. Agents werden nach der Erstellung verbunden.|Un PC puede tener varios roles. Los agentes se conectan después de la creación.|Un PC peut avoir plusieurs rôles. Les agents sont connectés après la création.|Un PC può avere più ruoli. Gli agenti si collegano dopo la creazione.|Um PC pode ter várias funções. Os agentes são ligados após a criação.|1台のPCに複数の役割を設定できます。エージェントは作成後に接続します。|一台PC可承担多个角色。创建后配置代理连接。|一台PC可承擔多個角色。建立後設定代理程式連接。`;
export const orchestrationMessages: Record<string,Record<string,string>> = {ko:{...orchestrationKorean}};
for(const row of rows.split('\n')) {const [key,...values]=row.split('|');for(const [i,locale] of locales.entries())(orchestrationMessages[locale]??={})[key]=values[i];}

const runtimeEnglish:Record<string,string>={
 "Execution controls":"Execution controls",
 "Graph execution is unavailable.":"Graph execution is unavailable.",
 "This execution is already finished.":"This execution is already finished.",
 "Review the saved graph version before continuing.":"Review the saved graph version before continuing.",
 "Review this execution before continuing.":"Review this execution before continuing.",
 "Execution monitoring":"Execution monitoring",
 "No execution has been recorded.":"No execution has been recorded.",
 "This execution differs from the current graph. Node states are hidden.":"This execution differs from the current graph. Node states are hidden.",
 "Bind graph schedules disabled":"Bind graph schedules disabled",
 "Graph schedules saved disabled. Review and enable them in Scheduler.":"Graph schedules saved disabled. Review and enable them in Scheduler.",
 "Enabled — allow automatic reviewed graph execution":"Enabled — allow automatic reviewed graph execution",
 "Execution Source":"Execution Source",
 "Saved workspace snapshot":"Saved workspace snapshot",
 "Protocol Source / Agent workspace":"Protocol Source / Agent workspace",
 "Transfer the saved, secret-filtered Source to the connected Core for this graph.":"Transfer the saved, secret-filtered Source to the connected Core for this graph.",
 "Snapshot files":"Snapshot files",
 "Excluded entries":"Excluded entries",
 "Review execution scope":"Review execution scope",
 "Deadline":"Deadline",
 "Save Protocol changes before publishing.":"Save Protocol changes before publishing.",
 "Core revision":"Core revision",
 "Approve this activation":"Approve this activation",
 "Start reviewed graph":"Start reviewed graph",
 "Review and resume":"Review and resume",
 "Publish graph to Core":"Publish graph to Core",
 "Protocol input checksum":"Protocol input checksum",
 "Durable storage":"Durable storage",
 "Entry node":"Entry node",
 "Cancel execution":"Cancel execution",
 "I reviewed this version and approve its Protocol execution.":"I reviewed this version and approve its Protocol execution.",
 "Core graph execution":"Core graph execution",
 "Saving a graph does not run work. Publish validates saved Protocol and Agent assignments; start requires review.":"Saving a graph does not run work. Publish validates saved Protocol and Agent assignments; start requires review.",
 "Maximum node attempts":"Maximum node attempts",
 "Memory storage; restart loses graph history":"Memory storage; restart loses graph history",
};
const aiConfigurationEnglish=Object.fromEntries(Object.keys(orchestrationKorean).filter(key=>/AI|Core host|Configured on Core|Connection method|Connection reference|connection$|Code review|^Design$|Execution location|Assigned device|External service|Timeout seconds|Prompt preview|Configurations describe|Configuration only|Bind an|Preparation does|Task bindings/.test(key)).map(key=>[key,key]));
for(const locale of locales)Object.assign(orchestrationMessages[locale],runtimeEnglish,aiConfigurationEnglish);
