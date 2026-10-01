// 앱 안 공지(규격 2-13) — 웹 제품(TASTEMAIL · TASTEETL)이 함께 쓰는 공통 모듈. 의존성 없이 React 19 만 씁니다.
//
// 기준 원본: sources/v1.0/tastedev-common/web-announcements/ — 각 앱에 **한 글자도 다르지 않게** 복사해 씁니다
// (check-shared.ps1 이 비교). 고칠 때는 기준을 고치고 사본을 맞춥니다.
//
// 서버 계약: resources/guides/announcements-app-api/README.md
//   GET https://tastedev.net/api/announcements?product=<제품>&locale=<언어>
//   → {"announcements":[{id, level, title, body, url, locale, startsAt, endsAt}]}
//
// 규칙은 데스크톱 공통 크레이트(tastedev-ui-kit announcements)와 같습니다:
// - 요청 주소: 앱 언어 → API 언어(ko · en · de · es · fr · it · pt · ja · zh · zh-hant, 그 밖은 en). 제품 · 언어만 보냅니다.
// - 응답 읽기: 잘못된 JSON · 필드는 버리고, url 은 https:// 만, 같은 id 는 처음 것만, 최대 5건, 서버 순서 유지.
// - 닫은 공지: 최근 50개(오래된 것부터), 긴급은 닫을 수 없고 닫은 목록에 있어도 보입니다.
// - 가져오기는 앱 서버(route handler)에서 합니다(브라우저가 tastedev.net 을 직접 부르지 않게, 5분 캐시).
//   실패는 조용히 "공지 없음". 오류 보고를 보내지 않습니다.
// - 띠(AnnouncementBar): 긴급 → 업데이트 → 안내, 한 번에 하나 · "1/3 ‹ ›", 제목 굵게 · 본문 줄바꿈(두 줄 뒤 접고
//   "더 보기"), "자세히 보기" 링크(새 창, 손가락 포인터는 링크만), 닫기 ✕(긴급은 없음), 150ms 로 열림(움직임 줄이기 존중).
//   색은 앱이 CSS 값(보통 var(--…))으로 넘깁니다.
//
// 이 파일에는 "use client" 가 없습니다 — 서버 route 도 같은 파일의 함수를 씁니다. 띠를 그리는 앱 쪽 파일이
// "use client" 를 답니다.

import { createElement, useEffect, useLayoutEffect, useMemo, useState, type ReactElement } from "react";

/** 공지 API 기준 주소. */
export const API_URL = "https://tastedev.net/api/announcements";
/** 기준 주소를 바꾸는 환경 변수(시험 · 확인용). 앱 서버가 읽어 `requestUrl` 의 base 로 넘깁니다. */
export const URL_ENV = "TASTEDEV_ANNOUNCEMENTS_URL";
/** 한 번에 받는 최대 건수. */
export const MAX_ITEMS = 5;
/** 닫은 공지 id 를 기억하는 최대 개수. */
export const SEEN_MAX = 50;
/** id 최대 길이. */
export const ID_MAX = 128;
/** 서버 캐시(앱 서버가 한 번 받은 것을 이만큼 씁니다). */
export const CACHE_MS = 5 * 60 * 1000;
/** 요청 제한 시간. */
export const TIMEOUT_MS = 10_000;
/** API 가 받는 언어. */
export const API_LOCALES = ["ko", "en", "de", "es", "fr", "it", "pt", "ja", "zh", "zh-hant"] as const;
/** API 가 받는 제품 이름(데스크톱 다섯 + 웹 둘). */
export const PRODUCTS = ["tastefiles", "tastecad", "tasteftp", "tastessh", "tastezip", "tastemail", "tasteetl"] as const;

export type Level = "info" | "update" | "urgent";

export type Announcement = {
  id: string;
  level: Level;
  /** 한 줄(줄바꿈은 빈칸으로). */
  title: string;
  /** 글 그대로(줄바꿈 \n 유지, 비어 있을 수 있음). */
  body: string;
  /** "자세히 보기" 주소(https:// 만). */
  url: string | null;
  /** 서버가 실제로 고른 언어. */
  locale: string;
  startsAt: string | null;
  endsAt: string | null;
};

/** 보이는 차례(작을수록 먼저): 긴급 → 업데이트 → 안내. */
export function levelRank(level: Level): number {
  return level === "urgent" ? 0 : level === "update" ? 1 : 2;
}

/** 닫기 단추가 있는지(긴급은 없음). */
export function dismissible(level: Level): boolean {
  return level !== "urgent";
}

// ───────────────────────────── 요청 주소 ─────────────────────────────

/** 앱 언어 코드(ko · en · zh_hant · pt-BR …)를 API 언어로. 목록에 없으면 en. */
export function apiLocale(appLang: string): string {
  const code = appLang.trim().toLowerCase().replace(/_/g, "-");
  if (["zh-hant", "zh-tw", "zh-hk", "zh-mo", "zh-hant-tw", "zh-hant-hk"].includes(code)) return "zh-hant";
  if (["zh-hans", "zh-cn", "zh-sg", "zh-hans-cn"].includes(code)) return "zh";
  const primary = code.split("-")[0] ?? "";
  return (API_LOCALES as readonly string[]).includes(primary) ? primary : "en";
}

/** 요청 주소: `<기준>?product=<제품>&locale=<언어>`. 제품 이름은 소문자 영숫자만 남깁니다. */
export function requestUrl(product: string, appLang: string, base: string = API_URL): string {
  const name = product.replace(/[^0-9A-Za-z]/g, "").toLowerCase();
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}product=${name}&locale=${apiLocale(appLang)}`;
}

// ───────────────────────────── 응답 읽기 ─────────────────────────────

/** 제어 문자(U+0000 ~ U+001F, U+007F)인지. */
function isControl(char: string): boolean {
  const code = char.charCodeAt(0);
  return code < 0x20 || code === 0x7f;
}

function oneLine(text: string): string {
  return Array.from(text, (char) => (isControl(char) ? " " : char))
    .join("")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

function cleanBody(text: string): string {
  const unified = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // 줄바꿈 · 탭 말고 제어 문자는 뺀다.
  const kept = Array.from(unified, (char) => (isControl(char) && char !== "\n" && char !== "\t" ? "" : char)).join("");
  return kept.replace(/\s+$/, "").replace(/^\n+/, "");
}

function cleanUrl(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const url = text.trim();
  // 빈칸 · 제어 문자가 든 주소는 버린다.
  const ok = url.length > 8 && url.slice(0, 8).toLowerCase() === "https://" && !Array.from(url).some((char) => /\s/.test(char) || isControl(char));
  return ok ? url : null;
}

function parseOne(value: unknown): Announcement | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const read = value as Record<string, unknown>;
  if (typeof read.id !== "string") return null;
  const id = read.id.trim();
  if (!id || id.length > ID_MAX || Array.from(id).some(isControl)) return null;
  if (typeof read.level !== "string") return null;
  const level = read.level.trim().toLowerCase();
  if (level !== "info" && level !== "update" && level !== "urgent") return null;
  if (typeof read.title !== "string") return null;
  const title = oneLine(read.title);
  if (!title) return null;
  let body = "";
  if (typeof read.body === "string") body = cleanBody(read.body);
  else if (read.body !== undefined && read.body !== null) return null;
  const locale = typeof read.locale === "string" && read.locale.trim() ? read.locale.trim() : "en";
  return {
    id,
    level,
    title,
    body,
    url: cleanUrl(read.url),
    locale,
    startsAt: typeof read.startsAt === "string" ? read.startsAt : null,
    endsAt: typeof read.endsAt === "string" ? read.endsAt : null,
  };
}

/** 응답(JSON 을 읽은 값)을 공지 목록으로. 모양이 틀리면 빈 목록. */
export function parseAnnouncements(said: unknown): Announcement[] {
  if (typeof said !== "object" || said === null) return [];
  const list = (said as { announcements?: unknown }).announcements;
  if (!Array.isArray(list)) return [];
  const out: Announcement[] = [];
  for (const value of list) {
    if (out.length >= MAX_ITEMS) break;
    const one = parseOne(value);
    if (one && !out.some((x) => x.id === one.id)) out.push(one);
  }
  return out;
}

/** 응답 글(문자열)을 공지 목록으로. JSON 이 아니면 빈 목록. */
export function parseAnnouncementsText(text: string): Announcement[] {
  try {
    return parseAnnouncements(JSON.parse(text));
  } catch {
    return [];
  }
}

/** 보일 공지: 닫은 것(긴급 말고)을 빼고 긴급 → 업데이트 → 안내(같은 등급은 서버 순서). */
export function visibleAnnouncements(items: readonly Announcement[], seen: readonly string[]): Announcement[] {
  return items
    .filter((one) => !dismissible(one.level) || !seen.includes(one.id))
    .map((one, order) => ({ one, order }))
    .sort((a, b) => levelRank(a.one.level) - levelRank(b.one.level) || a.order - b.order)
    .map(({ one }) => one);
}

// ───────────────────────────── 닫은 공지 기억 ─────────────────────────────

/** 닫은 id 를 더한다(이미 있으면 가장 최근으로). 오래된 것부터, 최근 50개. */
export function rememberDismissed(seen: readonly string[], id: string): string[] {
  const clean = id.trim();
  if (!clean || clean.length > ID_MAX) return [...seen];
  const next = seen.filter((one) => one !== clean);
  next.push(clean);
  return next.slice(Math.max(0, next.length - SEEN_MAX));
}

/** 설정 · 저장소에서 읽은 목록을 다듬는다(빈 값 · 겹친 값 빼고 최근 50개). */
export function normalizeSeen(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  let out: string[] = [];
  for (const one of list) if (typeof one === "string") out = rememberDismissed(out, one);
  return out;
}

/** 저장소(localStorage 등)에서 닫은 목록을 읽는다. 실패는 빈 목록. */
export function readSeen(storage: Pick<Storage, "getItem"> | null | undefined, key: string): string[] {
  try {
    return normalizeSeen(JSON.parse(storage?.getItem(key) ?? "[]"));
  } catch {
    return [];
  }
}

/** 닫은 목록을 저장소에 적는다. 실패(사생활 모드 · 꽉 참)는 무시. */
export function writeSeen(storage: Pick<Storage, "setItem"> | null | undefined, key: string, seen: readonly string[]): void {
  try {
    storage?.setItem(key, JSON.stringify(normalizeSeen([...seen])));
  } catch {
    // 조용히.
  }
}

// ───────────────────────────── 가져오기(앱 서버) ─────────────────────────────

export type FetchOptions = {
  product: string;
  /** 앱 언어 코드. */
  lang: string;
  /** 앱의 기존 업데이트 · 판 확인과 같은 User-Agent(`<제품>/<판>`). 사용자 정보를 넣지 않습니다. */
  userAgent: string;
  /** 기준 주소(보통 `process.env[URL_ENV] || API_URL`). */
  base?: string;
  /** 시험용 fetch. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/** 공지를 받는다. 네트워크 오류 · 4xx · 5xx · 잘못된 JSON · 시간 초과는 모두 빈 목록(던지지 않음). */
export async function fetchAnnouncements(options: FetchOptions): Promise<Announcement[]> {
  const doFetch = options.fetchImpl ?? fetch;
  const url = requestUrl(options.product, options.lang, options.base || API_URL);
  try {
    const answer = await doFetch(url, {
      headers: { Accept: "application/json", "User-Agent": options.userAgent },
      signal: AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS),
      cache: "no-store",
    });
    if (!answer.ok) return [];
    return parseAnnouncementsText(await answer.text());
  } catch {
    return [];
  }
}

/** 앱 서버의 5분 캐시(언어마다). `now` 는 시험용. */
export function announcementsCache(ttlMs: number = CACHE_MS) {
  const kept = new Map<string, { at: number; items: Announcement[] }>();
  return {
    async get(key: string, load: () => Promise<Announcement[]>, now: number = Date.now()): Promise<Announcement[]> {
      const hit = kept.get(key);
      if (hit && now - hit.at < ttlMs) return hit.items;
      const items = await load();
      kept.set(key, { at: now, items });
      return items;
    },
    clear(): void {
      kept.clear();
    },
  };
}

// ───────────────────────────── 띠 ─────────────────────────────

/** 띠 문구(앱이 번역해서 넘깁니다 — 원문은 데스크톱 다섯 제품과 같습니다). */
export type BarTexts = {
  moreInfo: string;
  showMore: string;
  showLess: string;
  dismiss: string;
  prev: string;
  next: string;
  urgent: string;
  update: string;
  info: string;
};

/** 한국어 원문(= 데스크톱 `tastedev_ui_kit::announcements::KO_TEXTS`). */
export const KO_TEXTS: BarTexts = {
  moreInfo: "자세히 보기",
  showMore: "더 보기",
  showLess: "간단히 보기",
  dismiss: "공지 닫기",
  prev: "이전 공지",
  next: "다음 공지",
  urgent: "긴급 공지",
  update: "업데이트 공지",
  info: "안내 공지",
};

export function levelName(texts: BarTexts, level: Level): string {
  return level === "urgent" ? texts.urgent : level === "update" ? texts.update : texts.info;
}

/** 띠 색(CSS 값 — 보통 앱 토큰 `var(--…)`). 규격 2-13: 긴급 danger 계열 · 업데이트 accent 계열 · 안내 중립. */
export type BarColors = {
  urgentBackground: string;
  urgentLine: string;
  urgentIcon: string;
  updateBackground: string;
  updateLine: string;
  updateIcon: string;
  infoBackground: string;
  infoLine: string;
  infoIcon: string;
  text: string;
  muted: string;
  link: string;
  /** 단추를 가리켰을 때 바탕. */
  hover: string;
};

/** 규격 1 토큰(밝게) 값 — 앱이 제 토큰을 넘기지 않을 때의 기본. */
export const DEFAULT_COLORS: BarColors = {
  urgentBackground: "#fbe9eb",
  urgentLine: "rgba(192, 36, 54, 0.55)",
  urgentIcon: "#c02436",
  updateBackground: "#dcebfb",
  updateLine: "rgba(20, 83, 158, 0.45)",
  updateIcon: "#14539e",
  infoBackground: "#f4f2fa",
  infoLine: "#e2ddee",
  infoIcon: "#5e5673",
  text: "#1e1830",
  muted: "#5e5673",
  link: "#14539e",
  hover: "rgba(0, 0, 0, 0.06)",
};

function colorsOf(colors: BarColors, level: Level): { background: string; line: string; icon: string } {
  if (level === "urgent") return { background: colors.urgentBackground, line: colors.urgentLine, icon: colors.urgentIcon };
  if (level === "update") return { background: colors.updateBackground, line: colors.updateLine, icon: colors.updateIcon };
  return { background: colors.infoBackground, line: colors.infoLine, icon: colors.infoIcon };
}

/** 본문이 두 줄을 넘길 것 같은지(그리기 전 어림 — 그린 뒤에는 실제 높이로 다시 잽니다). */
export function likelyLong(body: string): boolean {
  return body.split("\n").length > 2 || body.length > 180;
}

const h = createElement;

function levelIcon(level: Level, color: string): ReactElement {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, focusable: "false" };
  if (level === "urgent") {
    return h("svg", common, h("path", { d: "M12 3 2.5 20h19L12 3Z" }), h("path", { d: "M12 10v4.5" }), h("path", { d: "M12 17.4v.1" }));
  }
  if (level === "update") {
    return h("svg", common, h("path", { d: "M12 4v11" }), h("path", { d: "m7 10.5 5 5 5-5" }), h("path", { d: "M5 20h14" }));
  }
  return h("svg", common, h("circle", { cx: 12, cy: 12, r: 9 }), h("path", { d: "M12 11v5.5" }), h("path", { d: "M12 7.6v.1" }));
}

function reducedMotion(): boolean {
  try {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// 서버에서 그릴 때는 useLayoutEffect 대신 useEffect(경고 없이).
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export type AnnouncementBarProps = {
  /** 앱 서버에서 받은 공지(서버 순서). */
  items: readonly Announcement[];
  texts?: BarTexts;
  colors?: BarColors;
  /** 닫은 id 를 적을 localStorage 열쇠. */
  storageKey?: string;
  /** 처음 그릴 때의 닫은 목록(시험 · 서버 그리기). 브라우저에서는 곧 localStorage 값으로 바뀝니다. */
  initialSeen?: readonly string[];
  /** 닫았을 때(앱이 따로 저장하고 싶을 때). */
  onDismiss?: (id: string, seen: string[]) => void;
  className?: string;
};

/** 공지 띠 — 앱 셸의 제목줄(헤더) 바로 아래 전체 폭에 둡니다. 보일 공지가 없으면 아무것도 그리지 않습니다. */
export function AnnouncementBar(props: AnnouncementBarProps): ReactElement | null {
  const texts = props.texts ?? KO_TEXTS;
  const colors = props.colors ?? DEFAULT_COLORS;
  const key = props.storageKey ?? "tastedev.announcements.seen";
  const [seen, setSeen] = useState<string[]>(() => normalizeSeen([...(props.initialSeen ?? [])]));
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState<boolean | null>(null);
  const [opened, setOpened] = useState(false);
  const [bodyEl, setBodyEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    let local: Storage | null = null;
    try {
      local = window.localStorage;
    } catch {
      local = null;
    }
    const stored = readSeen(local, key);
    if (stored.length > 0) queueMicrotask(() => setSeen((before) => normalizeSeen([...before, ...stored])));
  }, [key]);

  const visible = useMemo(() => visibleAnnouncements(props.items, seen), [props.items, seen]);
  const found = currentId === null ? -1 : visible.findIndex((one) => one.id === currentId);
  const index = found >= 0 ? found : 0;
  const item = visible[index] ?? null;

  useIsoLayoutEffect(() => {
    const el = bodyEl;
    if (!el || expanded) return;
    const measure = () => setOverflow(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, [bodyEl, item?.id, item?.body, expanded]);

  useEffect(() => {
    if (!item) {
      queueMicrotask(() => setOpened(false));
      return;
    }
    if (reducedMotion()) {
      queueMicrotask(() => setOpened(true));
      return;
    }
    const frame = requestAnimationFrame(() => setOpened(true));
    return () => cancelAnimationFrame(frame);
  }, [item]);

  if (!item) return null;
  const count = visible.length;
  const tone = colorsOf(colors, item.level);
  const name = levelName(texts, item.level);
  const long = overflow ?? likelyLong(item.body);
  const showToggle = item.body !== "" && (expanded || long);

  const go = (to: number) => {
    const next = visible[to];
    if (!next) return;
    setCurrentId(next.id);
    setExpanded(false);
    setOverflow(null);
  };
  const close = () => {
    if (!dismissible(item.level)) return;
    const next = rememberDismissed(seen, item.id);
    setSeen(next);
    let local: Storage | null = null;
    try {
      local = window.localStorage;
    } catch {
      local = null;
    }
    writeSeen(local, key, next);
    const after = visible[index + 1] ?? visible[index - 1] ?? null;
    setCurrentId(after ? after.id : null);
    setExpanded(false);
    setOverflow(null);
    props.onDismiss?.(item.id, next);
  };

  const iconButton = (label: string, glyph: ReactElement, onClick: () => void, enabled: boolean, id: string) =>
    h(
      "button",
      {
        type: "button",
        "aria-label": label,
        title: label,
        disabled: !enabled,
        onClick,
        "data-announcement": id,
        style: {
          width: 28,
          height: 28,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: 0,
          borderRadius: 5,
          background: "transparent",
          color: enabled ? colors.muted : colors.muted,
          opacity: enabled ? 1 : 0.4,
          cursor: "default",
          padding: 0,
        },
        onMouseEnter: (event: { currentTarget: HTMLButtonElement }) => {
          if (enabled) event.currentTarget.style.background = colors.hover;
        },
        onMouseLeave: (event: { currentTarget: HTMLButtonElement }) => {
          event.currentTarget.style.background = "transparent";
        },
      },
      glyph,
    );
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const svg = (d: string) => h("svg", { width: 16, height: 16, viewBox: "0 0 24 24", "aria-hidden": true, focusable: "false", ...stroke }, h("path", { d }));
  const textButton = (label: string, onClick: () => void) =>
    h(
      "button",
      {
        type: "button",
        onClick,
        "aria-expanded": expanded,
        "data-announcement": "toggle",
        style: { border: 0, background: "transparent", padding: 0, color: colors.link, font: "inherit", fontSize: 12.5, cursor: "default", whiteSpace: "nowrap" },
      },
      label,
    );

  return h(
    "section",
    {
      role: "region",
      "aria-label": `${name}: ${item.title}`,
      "aria-live": item.level === "urgent" ? "assertive" : "polite",
      "data-announcement-level": item.level,
      className: props.className,
      style: {
        display: "grid",
        gridTemplateRows: opened ? "1fr" : "0fr",
        transition: reducedMotion() ? "none" : "grid-template-rows 150ms cubic-bezier(0.33, 1, 0.68, 1)",
        background: tone.background,
        borderBottom: `1px solid ${tone.line}`,
        boxShadow: item.level === "urgent" ? `inset 3px 0 0 ${tone.icon}` : undefined,
        color: colors.text,
      },
    },
    h(
      "div",
      { style: { overflow: "hidden", minHeight: 0 } },
      h(
        "div",
        { style: { display: "flex", alignItems: "flex-start", gap: 10, padding: "6px 14px" } },
        h("span", { style: { display: "inline-flex", height: 28, alignItems: "center", flexShrink: 0 }, title: name }, levelIcon(item.level, tone.icon)),
        h(
          "div",
          { style: { flex: "1 1 auto", minWidth: 0, paddingTop: 5, paddingBottom: 2 } },
          h("strong", { style: { display: "block", fontWeight: 700, fontSize: 13, lineHeight: "18px", overflowWrap: "anywhere" } }, item.title),
          item.body
            ? h(
                "div",
                {
                  ref: setBodyEl,
                  style: {
                    marginTop: 2,
                    fontSize: 12.5,
                    lineHeight: "17px",
                    color: colors.muted,
                    whiteSpace: "pre-line",
                    overflowWrap: "anywhere",
                    ...(expanded ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }),
                  },
                },
                item.body,
              )
            : null,
        ),
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 12, flexShrink: 0, minHeight: 28, fontSize: 12.5 } },
          item.url
            ? h(
                "a",
                {
                  href: item.url,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  "data-announcement": "more-info",
                  style: { color: colors.link, cursor: "pointer", whiteSpace: "nowrap" },
                },
                texts.moreInfo,
              )
            : null,
          showToggle ? textButton(expanded ? texts.showLess : texts.showMore, () => setExpanded(!expanded)) : null,
          count > 1
            ? h(
                "span",
                { style: { display: "inline-flex", alignItems: "center", gap: 2 } },
                h("span", { style: { color: colors.muted, fontSize: 12, marginRight: 4 }, "aria-live": "polite" }, `${index + 1}/${count}`),
                iconButton(texts.prev, svg("m14.5 6-6 6 6 6"), () => go(index - 1), index > 0, "prev"),
                iconButton(texts.next, svg("m9.5 6 6 6-6 6"), () => go(index + 1), index + 1 < count, "next"),
              )
            : null,
          dismissible(item.level) ? iconButton(texts.dismiss, svg("M6.5 6.5l11 11M17.5 6.5l-11 11"), close, true, "dismiss") : null,
        ),
      ),
    ),
  );
}
