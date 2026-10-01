import type { Language } from './core.ts';
const languages: Language[] = ['ko','de','es','fr','it','pt','ja','zh','zh-hant'];
const rows = `Compatible|호환 가능|Kompatibel|Compatible|Compatible|Compatibile|Compatível|互換性あり|兼容|相容
None|없음|Keine|Ninguno|Aucun|Nessuno|Nenhum|なし|无|無
Agent readiness|Agent 준비 상태|Agent-Bereitschaft|Estado del Agent|État de l’Agent|Stato Agent|Estado do Agent|Agentの準備状態|Agent就绪状态|Agent就緒狀態
Inspect queue / cancel / retry|Queue 확인 / 취소 / 재시도|Queue prüfen / Abbrechen / Wiederholen|Ver cola / cancelar / reintentar|Voir la file / annuler / réessayer|Coda / annulla / riprova|Fila / cancelar / repetir|キュー確認／キャンセル／再試行|查看队列／取消／重试|查看佇列／取消／重試
Capability preview. Core checks permissions and availability again when assigning.|능력 미리보기입니다. 배정 시 Core가 권한과 가용성을 다시 확인합니다.|Fähigkeitsvorschau. Core prüft Rechte und Verfügbarkeit bei der Zuweisung erneut.|Vista previa de capacidades. Core verifica permisos y disponibilidad al asignar.|Aperçu des capacités. Core revérifie les droits et la disponibilité lors de l’affectation.|Anteprima capacità. Core verifica permessi e disponibilità all’assegnazione.|Prévia de capacidades. Core verifica permissões e disponibilidade ao atribuir.|能力のプレビューです。割り当て時にCoreが権限と可用性を再確認します。|能力预览。分配时Core会重新检查权限和可用性。|能力預覽。分配時Core會重新檢查權限和可用性。
New task|새 Task|Neue Aufgabe|Nueva tarea|Nouvelle tâche|Nuova attività|Nova tarefa|新しいタスク|新建任务|新增任務
New test|새 Test|Neuer Test|Nueva prueba|Nouveau test|Nuovo test|Novo teste|新しいテスト|新建测试|新增測試
Task editor|Task 편집|Aufgaben bearbeiten|Editor de tareas|Éditeur de tâches|Editor attività|Editor de tarefas|タスク編集|任务编辑|任務編輯
Test editor|Test 편집|Tests bearbeiten|Editor de pruebas|Éditeur de tests|Editor test|Editor de testes|テスト編集|测试编辑|測試編輯
Edit definition|정의 편집|Definition bearbeiten|Editar definición|Modifier la définition|Modifica definizione|Editar definição|定義を編集|编辑定义|編輯定義
New definition|새 정의|Neue Definition|Nueva definición|Nouvelle définition|Nuova definizione|Nova definição|新しい定義|新建定义|新增定義
Arguments (one per line)|인수 (한 줄에 하나)|Argumente (eines pro Zeile)|Argumentos (uno por línea)|Arguments (un par ligne)|Argomenti (uno per riga)|Argumentos (um por linha)|引数（1行に1つ）|参数（每行一个）|參數（每行一個）
Working directory|작업 디렉터리|Arbeitsverzeichnis|Directorio de trabajo|Répertoire de travail|Directory di lavoro|Diretório de trabalho|作業ディレクトリ|工作目录|工作目錄
Test task|실행 Task|Testaufgabe|Tarea de prueba|Tâche de test|Attività di test|Tarefa de teste|テストタスク|测试任务|測試任務
Test type|테스트 유형|Testtyp|Tipo de prueba|Type de test|Tipo di test|Tipo de teste|テストの種類|测试类型|測試類型
Pipeline|실행 단계|Pipeline|Pipeline|Pipeline|Pipeline|Pipeline|パイプライン|流水线|管線
Advanced options (JSON)|고급 옵션 (JSON)|Erweiterte Optionen (JSON)|Opciones avanzadas (JSON)|Options avancées (JSON)|Opzioni avanzate (JSON)|Opções avançadas (JSON)|詳細オプション（JSON）|高级选项（JSON）|進階選項（JSON）
Validate and preview|검증 및 미리보기|Prüfen und Vorschau|Validar y previsualizar|Valider et prévisualiser|Verifica e anteprima|Validar e visualizar|検証とプレビュー|验证并预览|驗證與預覽
Validated execution preview|검증된 실행 미리보기|Geprüfte Ausführungsvorschau|Vista previa validada|Aperçu validé|Anteprima verificata|Prévia validada|検証済み実行プレビュー|已验证的执行预览|已驗證的執行預覽
Save definition|정의 저장|Definition speichern|Guardar definición|Enregistrer la définition|Salva definizione|Salvar definição|定義を保存|保存定义|儲存定義
Saving updates one Protocol file. It does not run commands.|저장 시 Protocol 파일 하나를 갱신합니다. 명령을 실행하지 않습니다.|Speichern aktualisiert eine Protocol-Datei. Es führt keine Befehle aus.|Guardar actualiza un archivo Protocol. No ejecuta comandos.|L’enregistrement modifie un fichier Protocol sans exécuter de commandes.|Il salvataggio aggiorna un file Protocol senza eseguire comandi.|Salvar atualiza um arquivo Protocol sem executar comandos.|保存はProtocolファイル1つを更新します。コマンドは実行しません。|保存更新一个Protocol文件，不执行命令。|儲存更新一個Protocol檔案，不執行命令。
Environment, requirements and optional settings are preserved. Values must follow the Protocol schema.|환경·요구사항·선택 설정은 보존됩니다. Protocol 스키마에 맞게 입력하세요.|Umgebung, Anforderungen und Optionen bleiben erhalten. Werte müssen dem Protocol-Schema entsprechen.|Se conservan entorno, requisitos y opciones. Use el esquema Protocol.|Environnement, exigences et options sont conservés. Respectez le schéma Protocol.|Ambiente, requisiti e opzioni vengono conservati. Usa lo schema Protocol.|Ambiente, requisitos e opções são preservados. Siga o esquema Protocol.|環境・要件・オプションは保持されます。Protocolスキーマに従ってください。|保留环境、要求及可选设置，请遵循Protocol结构。|保留環境、需求及選用設定，請遵循Protocol結構。`;
export const protocolAuthoringMessages: Partial<Record<Language, Record<string,string>>> = Object.fromEntries(languages.map((language,index) => [language,Object.fromEntries(rows.split('\n').map(row => { const parts=row.split('|'); return [parts[0],parts[index+1]]; }))]));
