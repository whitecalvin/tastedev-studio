import type { Language } from './core.ts';
const languages: Language[]=['ko','de','es','fr','it','pt','ja','zh','zh-hant'];
const rows=`Search phrase|검색어|Suchbegriff|Texto de búsqueda|Texte à rechercher|Testo di ricerca|Texto de busca|検索語|搜索词|搜尋詞
Match case|대소문자 구분|Groß-/Kleinschreibung|Distinguir mayúsculas|Respecter la casse|Distingui maiuscole|Diferenciar maiúsculas|大文字と小文字を区別|区分大小写|區分大小寫
matches|일치 항목|Treffer|coincidencias|résultats|risultati|resultados|件の一致|个匹配|個符合
files searched|검색한 파일|Dateien durchsucht|archivos buscados|fichiers recherchés|file cercati|arquivos pesquisados|個のファイルを検索|个已搜索文件|個已搜尋檔案
Search limit reached|검색 제한 도달|Suchlimit erreicht|Límite de búsqueda alcanzado|Limite de recherche atteinte|Limite di ricerca raggiunto|Limite de busca atingido|検索上限に達しました|已达到搜索限制|已達到搜尋限制
files skipped|건너뛴 파일|Dateien übersprungen|archivos omitidos|fichiers ignorés|file ignorati|arquivos ignorados|個のファイルをスキップ|个已跳过文件|個已略過檔案
Search includes current edits. Dependencies, build output and credential files are excluded.|미저장 편집 내용도 검색합니다. 의존성·빌드 결과·credential 파일은 제외합니다.|Aktuelle Änderungen werden durchsucht. Abhängigkeiten, Build-Ausgaben und Anmeldedateien sind ausgeschlossen.|Se incluyen las ediciones actuales. Se excluyen dependencias, compilaciones y credenciales.|La recherche inclut les modifications. Dépendances, sorties de build et identifiants sont exclus.|Include le modifiche attuali. Esclude dipendenze, build e credenziali.|Inclui edições atuais. Exclui dependências, builds e credenciais.|現在の編集を含めます。依存関係、ビルド出力、認証情報ファイルは除外します。|包括当前编辑，排除依赖、构建输出和凭据文件。|包含目前編輯，排除相依項目、建置輸出和認證檔案。
TypeScript and JavaScript diagnostics. Dependency types are not indexed.|TypeScript·JavaScript 진단입니다. 의존성 타입은 인덱싱하지 않습니다.|TypeScript- und JavaScript-Diagnosen. Abhängigkeitstypen werden nicht indiziert.|Diagnósticos TypeScript y JavaScript. No se indexan tipos de dependencias.|Diagnostics TypeScript et JavaScript. Les types des dépendances ne sont pas indexés.|Diagnostica TypeScript e JavaScript. I tipi delle dipendenze non sono indicizzati.|Diagnósticos TypeScript e JavaScript. Tipos de dependências não são indexados.|TypeScript・JavaScriptの診断です。依存関係の型は索引化しません。|TypeScript和JavaScript诊断，不索引依赖类型。|TypeScript和JavaScript診斷，不索引相依類型。
No diagnostics reported.|보고된 진단 없음.|Keine Diagnosen gemeldet.|Sin diagnósticos.|Aucun diagnostic signalé.|Nessuna diagnostica.|Nenhum diagnóstico.|診断は報告されていません。|没有诊断信息。|沒有診斷資訊。
Definition|정의|Definition|Definición|Définition|Definizione|Definição|定義|定义|定義
References|참조|Verweise|Referencias|Références|Riferimenti|Referências|参照|引用|參照
Format|포맷|Formatieren|Formato|Formater|Formatta|Formatar|整形|格式化|格式化
Reload language tools|언어 도구 다시 로드|Sprachwerkzeuge neu laden|Recargar herramientas de lenguaje|Recharger les outils de langage|Ricarica strumenti linguistici|Recarregar ferramentas de linguagem|言語ツールを再読み込み|重新加载语言工具|重新載入語言工具`;
export const editorProductivityMessages:Partial<Record<Language,Record<string,string>>>=Object.fromEntries(languages.map((language,index)=>[language,Object.fromEntries(rows.split('\n').map(row=>{const parts=row.split('|');return[parts[0],parts[index+1]];}))]));
