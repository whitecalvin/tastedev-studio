import type {Language} from './core.ts';
const languages:Language[]=['ko','de','es','fr','it','pt','ja','zh','zh-hant'];
const rows=`Remove|제거|Entfernen|Eliminar|Supprimer|Rimuovi|Remover|削除|移除|移除
Debugger|디버거|Debugger|Depurador|Débogueur|Debugger|Depurador|デバッガー|调试器|偵錯工具
Start debugging|디버깅 시작|Debuggen starten|Iniciar depuración|Démarrer le débogage|Avvia debug|Iniciar depuração|デバッグ開始|开始调试|開始偵錯
Debug saved Node and TypeScript files locally.|저장한 Node·TypeScript 파일을 로컬에서 디버깅합니다.|Gespeicherte Node- und TypeScript-Dateien lokal debuggen.|Depura archivos Node y TypeScript guardados localmente.|Déboguez localement les fichiers Node et TypeScript enregistrés.|Esegui il debug locale dei file Node e TypeScript salvati.|Depure arquivos Node e TypeScript salvos localmente.|保存済みの Node・TypeScript ファイルをローカルでデバッグします。|在本地调试已保存的 Node 和 TypeScript 文件。|在本機偵錯已儲存的 Node 和 TypeScript 檔案。
Breakpoint line|중단점 줄|Haltepunktzeile|Línea del punto de interrupción|Ligne du point d’arrêt|Riga del punto di interruzione|Linha do ponto de interrupção|ブレークポイント行|断点行|中斷點行
Add breakpoint|중단점 추가|Haltepunkt hinzufügen|Añadir punto de interrupción|Ajouter un point d’arrêt|Aggiungi punto di interruzione|Adicionar ponto de interrupção|ブレークポイント追加|添加断点|新增中斷點
Call stack|호출 스택|Aufrufliste|Pila de llamadas|Pile d’appels|Stack di chiamate|Pilha de chamadas|呼び出し履歴|调用堆栈|呼叫堆疊
Variables|변수|Variablen|Variables|Variables|Variabili|Variáveis|変数|变量|變數
Debug console|디버그 콘솔|Debug-Konsole|Consola de depuración|Console de débogage|Console di debug|Console de depuração|デバッグコンソール|调试控制台|偵錯主控台
continue|계속 실행|Fortsetzen|Continuar|Continuer|Continua|Continuar|続行|继续|繼續
pause|일시 중지|Pausieren|Pausar|Pause|Pausa|Pausar|一時停止|暂停|暫停
step-over|다음 줄|Schritt über|Paso por encima|Pas à pas principal|Passa oltre|Passar por cima|ステップオーバー|单步跳过|逐步跳過
step-into|함수 안으로|Schritt hinein|Paso a paso|Pas à pas détaillé|Entra|Entrar|ステップイン|单步进入|逐步進入
step-out|함수 밖으로|Schritt heraus|Salir de función|Sortir de la fonction|Esci|Sair|ステップアウト|单步跳出|逐步跳出
Debugging requires the desktop application.|디버깅은 데스크톱 앱에서 사용할 수 있습니다.|Debuggen erfordert die Desktop-App.|La depuración requiere la aplicación de escritorio.|Le débogage nécessite l’application de bureau.|Il debug richiede l’app desktop.|A depuração exige o aplicativo desktop.|デバッグにはデスクトップアプリが必要です。|调试需要桌面应用。|偵錯需要桌面應用程式。
Save all edited files before debugging.|디버깅 전에 편집한 파일을 모두 저장하세요.|Vor dem Debuggen alle bearbeiteten Dateien speichern.|Guarda todos los archivos editados antes de depurar.|Enregistrez tous les fichiers modifiés avant de déboguer.|Salva tutti i file modificati prima del debug.|Salve todos os arquivos editados antes de depurar.|デバッグ前に編集したファイルをすべて保存してください。|调试前请保存所有编辑的文件。|偵錯前請儲存所有編輯的檔案。`;
export const debuggerMessages=Object.fromEntries(languages.map((language,index)=>[language,Object.fromEntries(rows.split('\n').map(row=>{const parts=row.split('|');return[parts[0],parts[index+1]];}))])) as Partial<Record<Language,Record<string,string>>>;
