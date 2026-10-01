import type { Language } from './core.ts';
const locales: Language[] = ['ko', 'de', 'es', 'fr', 'it', 'pt', 'ja', 'zh', 'zh-hant'];
const rows = `Announcements|공지사항|Mitteilungen|Avisos|Annonces|Annunci|Avisos|お知らせ|公告|公告
{count} unread announcements|읽지 않은 공지 {count}개|{count} ungelesene Mitteilungen|{count} avisos sin leer|{count} annonces non lues|{count} annunci non letti|{count} avisos não lidos|未読のお知らせ {count} 件|{count} 条未读公告|{count} 則未讀公告
Receive announcements|공지사항 받기|Mitteilungen empfangen|Recibir avisos|Recevoir les annonces|Ricevi annunci|Receber avisos|お知らせを受け取る|接收公告|接收公告
More information|자세히 보기|Weitere Informationen|Más información|Plus d’informations|Ulteriori informazioni|Mais informações|詳細を見る|更多信息|更多資訊
View announcement|공지 보기|Mitteilung anzeigen|Ver aviso|Voir l’annonce|Visualizza annuncio|Ver aviso|お知らせを見る|查看公告|查看公告
Dismiss announcement|공지 닫기|Mitteilung ausblenden|Ocultar aviso|Masquer l’annonce|Nascondi annuncio|Ocultar aviso|お知らせを閉じる|关闭公告|關閉公告
Do not show again today|오늘 하루 보지 않기|Heute nicht mehr anzeigen|No volver a mostrar hoy|Ne plus afficher aujourd’hui|Non mostrare più oggi|Não mostrar novamente hoje|今日は表示しない|今天不再显示|今天不再顯示
Loading announcements…|공지사항 불러오는 중…|Mitteilungen werden geladen…|Cargando avisos…|Chargement des annonces…|Caricamento annunci…|Carregando avisos…|お知らせを読み込み中…|正在加载公告…|正在載入公告…
Announcement preferences could not be saved.|공지 설정을 저장하지 못했습니다.|Mitteilungseinstellungen konnten nicht gespeichert werden.|No se pudieron guardar las preferencias.|Impossible d’enregistrer les préférences.|Impossibile salvare le preferenze.|Não foi possível salvar as preferências.|お知らせの設定を保存できませんでした。|无法保存公告设置。|無法儲存公告設定。
Announcements could not be loaded. Try again.|공지사항을 불러오지 못했습니다. 다시 시도하세요.|Mitteilungen konnten nicht geladen werden. Erneut versuchen.|No se pudieron cargar los avisos. Inténtelo de nuevo.|Impossible de charger les annonces. Réessayez.|Impossibile caricare gli annunci. Riprova.|Não foi possível carregar os avisos. Tente novamente.|お知らせを読み込めませんでした。再試行してください。|无法加载公告。请重试。|無法載入公告。請重試。
No announcements.|공지사항이 없습니다.|Keine Mitteilungen.|No hay avisos.|Aucune annonce.|Nessun annuncio.|Nenhum aviso.|お知らせはありません。|暂无公告。|暫無公告。
Announcements are disabled.|공지사항 받기가 꺼져 있습니다.|Mitteilungen sind deaktiviert.|Los avisos están desactivados.|Les annonces sont désactivées.|Gli annunci sono disattivati.|Os avisos estão desativados.|お知らせは無効です。|公告已关闭。|公告已關閉。
Unread|읽지 않음|Ungelesen|Sin leer|Non lu|Non letto|Não lido|未読|未读|未讀
Refresh|새로고침|Aktualisieren|Actualizar|Actualiser|Aggiorna|Atualizar|更新|刷新|重新整理`;
export const announcementMessages: Partial<Record<Language, Record<string, string>>> = Object.fromEntries(locales.map(language => [language, {}]));
for (const row of rows.split('\n')) { const [key, ...values] = row.split('|'); if (values.length !== locales.length) throw Error('Invalid announcement translation row'); locales.forEach((language, index) => { announcementMessages[language]![key] = values[index]; }); }
