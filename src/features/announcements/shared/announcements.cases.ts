// 앱 안 공지 공통 모듈의 시험 사례 — 앱마다 제 시험 도구(node --test · vitest)로 돌립니다.
//
// 이 파일은 시험 도구를 모릅니다: `announcementCases(모듈)` 이 [이름, 함수] 목록을 돌려주고, 앱의 작은 시험 파일이
// 그것을 `test(이름, 함수)` 로 등록합니다. 단언은 node:assert 입니다(두 도구 모두에서 돕니다).
// 네트워크에 나가지 않습니다 — 가져오기는 가짜 fetch 로 봅니다.

import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type * as Module from "./announcements.ts";

type Case = { name: string; run: () => void | Promise<void> };

const FIXTURE = {
  announcements: [
    {
      id: "u1",
      level: "urgent",
      title: "서버 점검 안내",
      body: "오늘 밤 23시부터 30분 동안 다운로드가 멈춥니다.\n앱은 그대로 쓸 수 있습니다.",
      url: "https://tastedev.net/support",
      locale: "ko",
      startsAt: "2026-09-25T14:00:00.000Z",
      endsAt: "2026-09-25T15:00:00.000Z",
    },
    { id: "p1", level: "update", title: "새 판", body: "", url: null, locale: "ko", startsAt: null, endsAt: null },
    { id: "i1", level: "info", title: "안내", body: null, url: "http://insecure.example", locale: "en" },
  ],
};

function fakeFetch(answer: { ok: boolean; text: string } | Error): typeof fetch {
  return (async () => {
    if (answer instanceof Error) throw answer;
    return { ok: answer.ok, text: async () => answer.text } as Response;
  }) as unknown as typeof fetch;
}

export function announcementCases(m: typeof Module): Case[] {
  return [
    {
      name: "응답을 읽고 서버 순서를 지킨다",
      run: () => {
        const a = m.parseAnnouncements(FIXTURE);
        assert.deepEqual(a.map((x) => x.id), ["u1", "p1", "i1"]);
        assert.equal(a[0]?.level, "urgent");
        assert.ok(a[0]?.body.includes("\n"));
        assert.equal(a[0]?.url, "https://tastedev.net/support");
        assert.equal(a[0]?.startsAt, "2026-09-25T14:00:00.000Z");
        assert.equal(a[1]?.url, null);
        assert.equal(a[2]?.body, "");
        assert.equal(a[2]?.url, null, "http:// 주소는 버린다");
        assert.equal(a[2]?.locale, "en");
      },
    },
    {
      name: "잘못된 입력은 버린다",
      run: () => {
        for (const bad of ["", "not json", "[]", "{}", '{"announcements":{}}', '{"announcements":null}', '{"error":"unknown_product"}']) {
          assert.deepEqual(m.parseAnnouncementsText(bad), [], bad);
        }
        const mixed = m.parseAnnouncements({
          announcements: [
            { level: "info", title: "id 없음" },
            { id: "", level: "info", title: "빈 id" },
            { id: "a", level: "weird", title: "모르는 등급" },
            { id: "b", level: "info", title: "   " },
            { id: "c", level: "info", title: "본문이 수", body: 3 },
            { id: "d", level: "info", title: 7 },
            { id: "e", level: "INFO", title: " 줄\n바꿈 제목 ", url: "javascript:alert(1)" },
            { id: "e", level: "urgent", title: "같은 id" },
            { id: "f", level: "update", title: "주소 빈칸", url: "https://a b" },
            { id: "g", level: "update", title: "대문자 주소", url: "HTTPS://tastedev.net/x" },
            "문자열",
            42,
          ],
        });
        assert.deepEqual(mixed.map((x) => x.id), ["e", "f", "g"]);
        assert.equal(mixed[0]?.title, "줄 바꿈 제목");
        assert.equal(mixed[0]?.level, "info");
        assert.equal(mixed[0]?.url, null);
        assert.equal(mixed[1]?.url, null);
        assert.equal(mixed[2]?.url, "HTTPS://tastedev.net/x");
        const crlf = m.parseAnnouncements({ announcements: [{ id: "x", level: "info", title: "t", body: "하나\r\n둘\r\n" }] });
        assert.equal(crlf[0]?.body, "하나\n둘");
      },
    },
    {
      name: "최대 5건",
      run: () => {
        const many = { announcements: Array.from({ length: 9 }, (_, i) => ({ id: `n${i}`, level: "info", title: `공지 ${i}` })) };
        const a = m.parseAnnouncements(many);
        assert.equal(a.length, m.MAX_ITEMS);
        assert.equal(a[0]?.id, "n0");
        assert.equal(a[4]?.id, "n4");
      },
    },
    {
      name: "앱 25개 언어를 API 언어로",
      run: () => {
        const app = ["ko", "en", "de", "es", "fr", "it", "pt", "ja", "zh", "zh_hant", "cs", "da", "el", "fi", "hu", "id", "nb", "nl", "pl", "ro", "ru", "sv", "tr", "uk", "vi"];
        const want = ["ko", "en", "de", "es", "fr", "it", "pt", "ja", "zh", "zh-hant", ...Array(15).fill("en")];
        assert.deepEqual(app.map(m.apiLocale), want);
        assert.equal(m.apiLocale("zh-TW"), "zh-hant");
        assert.equal(m.apiLocale("zh-CN"), "zh");
        assert.equal(m.apiLocale("pt-BR"), "pt");
        assert.equal(m.apiLocale("KO"), "ko");
        assert.equal(m.apiLocale(""), "en");
      },
    },
    {
      name: "요청 주소에는 제품과 언어만",
      run: () => {
        assert.equal(m.requestUrl("TasteMail", "ko"), "https://tastedev.net/api/announcements?product=tastemail&locale=ko");
        assert.equal(m.requestUrl("tasteetl", "zh_hant", "http://127.0.0.1:9/x?v=1"), "http://127.0.0.1:9/x?v=1&product=tasteetl&locale=zh-hant");
        assert.equal(m.requestUrl("taste&x=1", "ko", "https://h/a"), "https://h/a?product=tastex1&locale=ko");
        assert.equal(m.PRODUCTS.length, 7);
      },
    },
    {
      name: "닫은 공지는 최근 50개",
      run: () => {
        let seen: string[] = [];
        for (let i = 0; i < 60; i += 1) seen = m.rememberDismissed(seen, `id${i}`);
        assert.equal(seen.length, m.SEEN_MAX);
        assert.ok(!seen.includes("id9") && seen.includes("id10") && seen.includes("id59"));
        seen = m.rememberDismissed(seen, "id10");
        assert.equal(seen.at(-1), "id10");
        assert.equal(seen.length, 50);
        assert.deepEqual(m.rememberDismissed(["a"], "  "), ["a"]);
        assert.deepEqual(m.normalizeSeen(["a", "", 3, "b", "a"]), ["b", "a"]);
        assert.deepEqual(m.normalizeSeen("x"), []);
        // 저장소: 실패는 조용히.
        const box = new Map<string, string>();
        const storage = { getItem: (k: string) => box.get(k) ?? null, setItem: (k: string, v: string) => void box.set(k, v) };
        m.writeSeen(storage, "k", ["x", "y"]);
        assert.deepEqual(m.readSeen(storage, "k"), ["x", "y"]);
        assert.deepEqual(m.readSeen({ getItem: () => "{broken" }, "k"), []);
        assert.deepEqual(m.readSeen(null, "k"), []);
        m.writeSeen({ setItem: () => { throw new Error("꽉 참"); } }, "k", ["x"]);
      },
    },
    {
      name: "긴급이 먼저, 긴급은 닫을 수 없다",
      run: () => {
        const items = m.parseAnnouncements({
          announcements: [
            { id: "i", level: "info", title: "안내" },
            { id: "p", level: "update", title: "업데이트" },
            { id: "u", level: "urgent", title: "긴급" },
            { id: "i2", level: "info", title: "안내 둘" },
          ],
        });
        assert.deepEqual(m.visibleAnnouncements(items, ["i2", "u"]).map((x) => x.id), ["u", "p", "i"]);
        assert.equal(m.dismissible("urgent"), false);
        assert.equal(m.dismissible("update") && m.dismissible("info"), true);
      },
    },
    {
      name: "가져오기 실패는 조용히 빈 목록",
      run: async () => {
        const base = "https://example.invalid/api";
        const ok = await m.fetchAnnouncements({ product: "tastemail", lang: "ko", userAgent: "t/1", base, fetchImpl: fakeFetch({ ok: true, text: JSON.stringify(FIXTURE) }) });
        assert.equal(ok.length, 3);
        assert.deepEqual(await m.fetchAnnouncements({ product: "tastemail", lang: "ko", userAgent: "t/1", base, fetchImpl: fakeFetch({ ok: false, text: "{}" }) }), []);
        assert.deepEqual(await m.fetchAnnouncements({ product: "tastemail", lang: "ko", userAgent: "t/1", base, fetchImpl: fakeFetch({ ok: true, text: "<html>" }) }), []);
        assert.deepEqual(await m.fetchAnnouncements({ product: "tastemail", lang: "ko", userAgent: "t/1", base, fetchImpl: fakeFetch(new Error("망 없음")) }), []);
        // 보내는 것: 제품 · 언어 · User-Agent 뿐.
        let asked = "";
        let headers: Record<string, string> = {};
        await m.fetchAnnouncements({
          product: "tasteetl",
          lang: "ko",
          userAgent: "tasteetl-ide/0.1.0",
          base,
          fetchImpl: (async (url: string, init: RequestInit) => {
            asked = url;
            headers = init.headers as Record<string, string>;
            return { ok: true, text: async () => "{}" } as Response;
          }) as unknown as typeof fetch,
        });
        assert.equal(asked, `${base}?product=tasteetl&locale=ko`);
        assert.deepEqual(Object.keys(headers).sort(), ["Accept", "User-Agent"]);
      },
    },
    {
      name: "서버 캐시는 5분",
      run: async () => {
        const cache = m.announcementsCache();
        let loads = 0;
        const load = async () => {
          loads += 1;
          return m.parseAnnouncements(FIXTURE);
        };
        await cache.get("ko", load, 0);
        await cache.get("ko", load, m.CACHE_MS - 1);
        assert.equal(loads, 1);
        await cache.get("ko", load, m.CACHE_MS);
        assert.equal(loads, 2);
        await cache.get("en", load, m.CACHE_MS);
        assert.equal(loads, 3);
      },
    },
    {
      name: "띠: 긴급 먼저 · 닫기 없음 · 자세히 보기 링크 · 1/3",
      run: () => {
        const items = m.parseAnnouncements(FIXTURE);
        const html = renderToStaticMarkup(createElement(m.AnnouncementBar, { items }));
        assert.ok(html.includes('data-announcement-level="urgent"'));
        assert.ok(html.includes('aria-label="긴급 공지: 서버 점검 안내"'));
        assert.ok(!html.includes('aria-label="공지 닫기"'), "긴급은 닫기가 없다");
        assert.ok(html.includes('href="https://tastedev.net/support"') && html.includes('rel="noopener noreferrer"') && html.includes('target="_blank"'));
        assert.ok(html.includes("자세히 보기"));
        assert.ok(html.includes("1/3"));
        assert.ok(html.includes('aria-label="이전 공지"') && html.includes('aria-label="다음 공지"'));
        // 링크만 손가락 포인터(규격 2-7).
        assert.equal((html.match(/cursor:pointer/g) ?? []).length, 1);
      },
    },
    {
      name: "띠: 닫은 업데이트는 빠지고 안내에는 닫기가 있다, 없으면 그리지 않는다",
      run: () => {
        const items = m.parseAnnouncements(FIXTURE).filter((x) => x.level !== "urgent");
        const html = renderToStaticMarkup(createElement(m.AnnouncementBar, { items, initialSeen: ["p1"] }));
        assert.ok(html.includes('data-announcement-level="info"'));
        assert.ok(html.includes('aria-label="공지 닫기"'));
        assert.ok(!html.includes("1/"), "한 건이면 넘기기가 없다");
        assert.equal(renderToStaticMarkup(createElement(m.AnnouncementBar, { items, initialSeen: ["p1", "i1"] })), "");
        assert.equal(renderToStaticMarkup(createElement(m.AnnouncementBar, { items: [] })), "");
      },
    },
    {
      name: "띠: 긴 본문은 더 보기, 문구는 앱이 넘긴다",
      run: () => {
        const items = m.parseAnnouncements({ announcements: [{ id: "l", level: "update", title: "긴 공지", body: "하나\n둘\n셋" }] });
        const html = renderToStaticMarkup(createElement(m.AnnouncementBar, { items, texts: { ...m.KO_TEXTS, showMore: "More" } }));
        assert.ok(html.includes("More"));
        assert.ok(html.includes("white-space:pre-line"));
        assert.equal(m.likelyLong("짧음"), false);
      },
    },
  ];
}
