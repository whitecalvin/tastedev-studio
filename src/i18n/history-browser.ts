import type {Language} from './core.ts';
const locales:Language[]=['ko','de','es','fr','it','pt','ja','zh','zh-hant'];
const rows=`History browser|이력 조회|Verlauf anzeigen|Explorar historial|Parcourir l’historique|Esplora cronologia|Explorar histórico|履歴表示|历史浏览|歷史瀏覽
History metadata is paged. Source patches require separate approvals.|이력은 페이지로 조회합니다. Source 변경은 별도 승인이 필요합니다.|Verlauf wird seitenweise geladen. Quelländerungen erfordern eigene Freigaben.|El historial se pagina. Cambios de código requieren aprobación aparte.|Historique paginé. Les modifications exigent une approbation distincte.|Cronologia paginata. Le modifiche richiedono approvazione separata.|Histórico paginado. Alterações exigem aprovação separada.|履歴はページ単位で取得します。ソース変更には別の承認が必要です。|历史分页查询，源码修改需要单独批准。|歷史分頁查詢，原始碼修改需另行核准。
History type|이력 종류|Verlaufstyp|Tipo de historial|Type d’historique|Tipo cronologia|Tipo de histórico|履歴種類|历史类型|歷史類型
Attempt History|시도 이력|Versuchsverlauf|Historial de intentos|Historique des tentatives|Cronologia tentativi|Histórico de tentativas|試行履歴|尝试历史|嘗試歷史
From|시작 날짜|Von|Desde|Du|Da|De|開始日|开始日期|開始日期
To|종료 날짜|Bis|Hasta|Au|A|Até|終了日|结束日期|結束日期
Load history|이력 불러오기|Verlauf laden|Cargar historial|Charger l’historique|Carica cronologia|Carregar histórico|履歴を取得|加载历史|載入歷史
records|기록|Datensätze|registros|enregistrements|record|registros|件|条记录|筆紀錄
shown|표시|angezeigt|mostrados|affichés|visualizzati|exibidos|件表示|已显示|已顯示
Export manifest|기록 내보내기|Manifest exportieren|Exportar manifiesto|Exporter le manifeste|Esporta manifesto|Exportar manifesto|マニフェストを出力|导出清单|匯出清單
First page|첫 페이지|Erste Seite|Primera página|Première page|Prima pagina|Primeira página|最初のページ|第一页|第一頁
Next page|다음 페이지|Nächste Seite|Página siguiente|Page suivante|Pagina successiva|Próxima página|次のページ|下一页|下一頁
Some log chunks were evicted. Full output cannot be reconstructed.|보관 한도로 일부 로그가 제거되어 전체 출력을 복원할 수 없습니다.|Einige Logs wurden entfernt. Vollständige Ausgabe ist nicht rekonstruierbar.|Se eliminaron algunos logs. No se reconstruye toda la salida.|Certains logs ont été supprimés. La sortie complète n’est pas récupérable.|Alcuni log sono stati rimossi. L’output completo non è recuperabile.|Alguns logs foram removidos. Saída completa não pode ser reconstruída.|一部ログは保管上限で削除され、全出力を復元できません。|部分日志已清除，无法恢复完整输出。|部分日誌已清除，無法復原完整輸出。
Evidence retention|Evidence 보관|Evidence-Aufbewahrung|Retención de evidencia|Conservation des preuves|Conservazione evidenze|Retenção de evidências|証拠の保管|证据保留|證據保留
Deletion requires review. Metadata remains; active Run evidence is protected.|검토 후 삭제합니다. 메타데이터를 보존하며 실행 중 Evidence는 보호합니다.|Löschung erfordert Prüfung. Metadaten bleiben; laufende Evidence ist geschützt.|Borrado requiere revisión. Metadatos quedan; evidencia activa protegida.|Suppression après revue. Métadonnées conservées; preuves actives protégées.|Eliminazione dopo revisione. Metadati conservati; evidenze attive protette.|Exclusão após revisão. Metadados preservados; evidências ativas protegidas.|確認後に削除します。メタデータを保ち実行中の証拠を保護します。|删除需审核，保留元数据并保护运行中证据。|刪除需審核，保留中繼資料並保護執行中證據。
Retention days|보관 일수|Aufbewahrungstage|Días de retención|Jours de conservation|Giorni di conservazione|Dias de retenção|保管日数|保留天数|保留天數
Save retention policy|보관 정책 저장|Richtlinie speichern|Guardar política|Enregistrer la politique|Salva criterio|Salvar política|保管方針を保存|保存保留策略|儲存保留政策
Review retention|보관 삭제 검토|Aufbewahrung prüfen|Revisar retención|Revoir la conservation|Esamina conservazione|Revisar retenção|保管を確認|审核保留|審核保留
Retained bytes|보관 용량|Gespeicherte Bytes|Bytes retenidos|Octets conservés|Byte conservati|Bytes retidos|保管バイト数|保留字节|保留位元組
Deletion candidates|삭제 후보|Löschkandidaten|Candidatos a borrar|Candidats à supprimer|Candidati da eliminare|Candidatos à exclusão|削除候補|删除候选|刪除候選
Deleted|삭제됨|Gelöscht|Eliminado|Supprimé|Eliminato|Excluído|削除済み|已删除|已刪除
Confirm evidence deletion? Run/history identity and checksum are retained.|Evidence 본문을 삭제할까요? Run·이력 ID와 checksum은 보존합니다.|Evidence löschen? Run-/Verlaufs-ID und Prüfsumme bleiben.|¿Borrar evidencia? Se conservan ID e integridad del historial.|Supprimer la preuve ? Identité et checksum restent.|Eliminare evidenza? Identità e checksum restano.|Excluir evidência? Identidade e checksum são preservados.|証拠を削除しますか？Runと履歴のIDとチェックサムを保ちます。|确认删除证据？保留Run及历史标识与校验和。|確認刪除證據？保留Run與歷史識別及校驗和。
Delete evidence body|Evidence 본문 삭제|Evidence-Inhalt löschen|Borrar contenido de evidencia|Supprimer le contenu|Elimina contenuto evidenza|Excluir conteúdo de evidência|証拠本体を削除|删除证据内容|刪除證據內容
Evidence deleted; metadata retained.|Evidence 삭제됨 · 메타데이터 보존|Evidence gelöscht; Metadaten behalten.|Evidencia eliminada; metadatos conservados.|Preuve supprimée ; métadonnées conservées.|Evidenza eliminata; metadati conservati.|Evidência excluída; metadados preservados.|証拠は削除済み、メタデータは保管。|证据已删除，元数据保留。|證據已刪除，中繼資料保留。`;
export const historyBrowserMessages:Partial<Record<Language,Record<string,string>>>=Object.fromEntries(locales.map((locale,index)=>[locale,Object.fromEntries(rows.split('\n').map(row=>{const parts=row.split('|');return[parts[0],parts[index+1]];}))]));
