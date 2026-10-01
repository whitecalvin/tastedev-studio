import type {Language} from './core.ts';
const locales:Language[]=['ko','de','es','fr','it','pt','ja','zh','zh-hant'];
const rows=`Team access|팀 접근 권한|Teamzugriff|Acceso del equipo|Accès d’équipe|Accesso del team|Acesso da equipe|チームのアクセス権|团队访问权限|團隊存取權限
Local single-user mode.|로컬 개인용 모드입니다.|Lokaler Einzelbenutzermodus.|Modo local de un solo usuario.|Mode local à utilisateur unique.|Modalità locale per singolo utente.|Modo local de usuário único.|ローカルの単一ユーザーモードです。|本地单用户模式。|本機單一使用者模式。
Signed in as|연결된 사용자|Angemeldet als|Conectado como|Connecté en tant que|Connesso come|Conectado como|接続中のユーザー|已连接用户|已連線使用者
Role|역할|Rolle|Rol|Rôle|Ruolo|Função|ロール|角色|角色
Owner|소유자|Eigentümer|Propietario|Propriétaire|Proprietario|Proprietário|所有者|所有者|擁有者
Admin|관리자|Administrator|Administrador|Administrateur|Amministratore|Administrador|管理者|管理员|管理員
Developer|개발자|Entwickler|Desarrollador|Développeur|Sviluppatore|Desenvolvedor|開発者|开发者|開發者
Viewer|조회자|Betrachter|Lector|Lecteur|Visualizzatore|Leitor|閲覧者|查看者|檢視者
Permitted actions|허용된 작업|Erlaubte Aktionen|Acciones permitidas|Actions autorisées|Azioni consentite|Ações permitidas|許可された操作|允许的操作|允許的操作
Read project|프로젝트 조회|Projekt lesen|Consultar proyecto|Consulter le projet|Consulta progetto|Consultar projeto|プロジェクトを閲覧|查看项目|檢視專案
Run tests|테스트 실행|Tests ausführen|Ejecutar pruebas|Exécuter les tests|Esegui test|Executar testes|テストを実行|运行测试|執行測試
Cancel runs|실행 취소|Läufe abbrechen|Cancelar ejecuciones|Annuler les exécutions|Annulla esecuzioni|Cancelar execuções|実行をキャンセル|取消运行|取消執行
Use AI|AI 사용|KI verwenden|Usar IA|Utiliser l’IA|Usa IA|Usar IA|AI を使用|使用 AI|使用 AI
Approve changes|변경 승인|Änderungen genehmigen|Aprobar cambios|Approuver les modifications|Approva modifiche|Aprovar alterações|変更を承認|批准更改|核准變更
Save analysis history|분석 이력 저장|Analyseverlauf speichern|Guardar historial de análisis|Enregistrer l’historique d’analyse|Salva cronologia analisi|Salvar histórico de análise|分析履歴を保存|保存分析历史|儲存分析歷程
Manage agents|에이전트 관리|Agents verwalten|Gestionar agentes|Gérer les agents|Gestisci agenti|Gerenciar agentes|エージェントを管理|管理代理|管理代理
Manage schedules|일정 관리|Zeitpläne verwalten|Gestionar horarios|Gérer les planifications|Gestisci pianificazioni|Gerenciar agendamentos|スケジュールを管理|管理计划|管理排程
Create issues|이슈 생성|Issues erstellen|Crear incidencias|Créer des tickets|Crea segnalazioni|Criar issues|Issue を作成|创建问题|建立 Issue
View audit|감사 이력 조회|Prüfverlauf anzeigen|Consultar auditoría|Consulter l’audit|Visualizza audit|Consultar auditoria|監査履歴を閲覧|查看审计|檢視稽核
Manage team access|팀 권한 관리|Teamzugriff verwalten|Gestionar acceso del equipo|Gérer les accès de l’équipe|Gestisci accessi del team|Gerenciar acesso da equipe|チームのアクセス権を管理|管理团队权限|管理團隊權限
Core denied this action. Ask a project administrator to check your access.|Core가 이 작업을 거부했습니다. 프로젝트 관리자에게 권한 확인을 요청하세요.|Core hat diese Aktion verweigert. Bitten Sie einen Projektadministrator, Ihren Zugriff zu prüfen.|Core denegó esta acción. Pida al administrador del proyecto que revise su acceso.|Core a refusé cette action. Demandez à un administrateur du projet de vérifier vos accès.|Core ha negato questa azione. Chiedi a un amministratore del progetto di verificare l’accesso.|O Core negou esta ação. Peça ao administrador do projeto para verificar seu acesso.|Core がこの操作を拒否しました。プロジェクト管理者にアクセス権の確認を依頼してください。|Core 拒绝了此操作。请让项目管理员检查您的权限。|Core 拒絕了此操作。請要求專案管理員檢查您的權限。
Your Core session expired or was revoked. Reconnect with a current session token.|Core 세션이 만료되었거나 회수되었습니다. 유효한 세션 토큰으로 다시 연결하세요.|Ihre Core-Sitzung ist abgelaufen oder wurde widerrufen. Verbinden Sie sich mit einem gültigen Sitzungstoken erneut.|La sesión Core expiró o fue revocada. Vuelva a conectarse con un token vigente.|Votre session Core a expiré ou a été révoquée. Reconnectez-vous avec un jeton valide.|La sessione Core è scaduta o è stata revocata. Riconnettiti con un token valido.|Sua sessão Core expirou ou foi revogada. Reconecte com um token válido.|Core セッションが期限切れまたは取り消されました。有効なセッショントークンで再接続してください。|Core 会话已过期或已撤销。请使用有效的会话令牌重新连接。|Core 工作階段已過期或已撤銷。請使用有效的工作階段權杖重新連線。
The shared Queue limit was reached. Wait for pending work to finish.|공용 대기열 한도에 도달했습니다. 대기 중인 작업이 끝날 때까지 기다리세요.|Das Limit der gemeinsamen Warteschlange wurde erreicht. Warten Sie auf den Abschluss ausstehender Aufgaben.|Se alcanzó el límite de la cola compartida. Espere a que terminen las tareas pendientes.|La limite de la file partagée est atteinte. Attendez la fin des tâches en attente.|È stato raggiunto il limite della coda condivisa. Attendi il completamento delle attività in attesa.|O limite da fila compartilhada foi atingido. Aguarde a conclusão das tarefas pendentes.|共有キューの上限に達しました。待機中の作業が完了するまでお待ちください。|共享队列已达到上限。请等待待处理任务完成。|共用佇列已達上限。請等待待處理工作完成。`;
export const teamMessages:Partial<Record<Language,Record<string,string>>>=Object.fromEntries(locales.map(l=>[l,{}]));
for(const row of rows.split('\n')){const [key,...values]=row.split('|');if(values.length!==locales.length)throw Error('Invalid team translation row');locales.forEach((locale,i)=>{teamMessages[locale]![key]=values[i];});}
