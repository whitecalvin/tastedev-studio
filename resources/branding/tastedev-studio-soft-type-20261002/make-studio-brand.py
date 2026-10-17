# TASTESTUDIO 마크 · 워드마크 · 아이콘 묶음(2026-10-02).
# 꼴: 제품군 소프트 타입(남색 테두리 획 100/1024 + 파랑 강조 하나, 둥근 끝) — TASTEGEO 의 make-geo-brand.py 와 같은 틀.
#   큐브 — 예전 studio.svg 의 상자 그림을 제품군 꼴로(윗면 파랑, 나머지 남색 선).
# 실행: C:\Users\whitecalvin\anaconda3\python.exe make-studio-brand.py
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.dirname(os.path.abspath(__file__))
NAVY = (0x10, 0x2A, 0x4C); SKY = (0x46, 0x9B, 0xEA); LIGHT = (0xEC, 0xE8, 0xF6)
MARK_NAVY = (14, 43, 81); MARK_BLUE = (64, 153, 240)


def poly_stroke(d, pts, w, fill, closed=False):
    if closed:
        pts = pts + [pts[0], pts[1]]
    d.line(pts, fill=fill, width=w, joint="curve")
    r = w / 2
    for x, y in (pts if not closed else []):
        d.ellipse((x - r, y - r, x + r, y + r), fill=fill)


# 1024 격자 좌표 — 예전 큐브 그림(tastedev-studio-desktop/studio.svg, 256 격자)을 4배로 옮긴 것.
# 윗면은 파랑으로 채우고(강조 하나), 상자 윤곽 · 안쪽 모서리 · 아래 받침은 남색 선.
TOP = [(512, 160), (744, 296), (512, 432), (280, 296)]
BOX = [(512, 160), (744, 296), (744, 560), (512, 696), (280, 560), (280, 296)]
INNER = [[(280, 296), (512, 432), (744, 296)], [(512, 432), (512, 696)]]
BASE = [(280, 560), (160, 632), (160, 776), (288, 856), (512, 728), (736, 856), (864, 776), (864, 632), (744, 560)]
STROKE = 64


def studio_mark(size=1024, navy=MARK_NAVY, blue=MARK_BLUE):
    s = 4
    S = size * s
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    u = lambda p: (round(p[0] * s), round(p[1] * s))
    n = navy + (255,); b = blue + (255,)
    W = round(STROKE * s)
    d.polygon([u(p) for p in TOP], fill=b)
    poly_stroke(d, [u(p) for p in BOX], W, n, closed=True)
    for line in INNER:
        poly_stroke(d, [u(p) for p in line], W, n)
    poly_stroke(d, [u(p) for p in BASE], W, n)
    poly_stroke(d, [u(p) for p in TOP], W, b, closed=True)
    return img.resize((size, size), Image.LANCZOS)


def studio_mark_svg():
    """같은 도형의 진짜 벡터(그린 좌표 그대로, 1024 격자)."""
    blue = "#%02X%02X%02X" % MARK_BLUE; navy = "#%02X%02X%02X" % MARK_NAVY
    pts = lambda ps: " ".join(f"{x},{y}" for x, y in ps)
    nl = "\n"
    line = lambda ps, c: f'  <polyline points="{pts(ps)}" fill="none" stroke="{c}" stroke-width="{STROKE}" stroke-linecap="round" stroke-linejoin="round"/>' + nl
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-labelledby="t">' + nl
        + '  <title id="t">TASTESTUDIO</title>' + nl
        + f'  <polygon points="{pts(BOX)}" fill="none" stroke="{navy}" stroke-width="{STROKE}" stroke-linejoin="round"/>' + nl
        + "".join(line(l, navy) for l in INNER) + line(BASE, navy)
        + f'  <polygon points="{pts(TOP)}" fill="{blue}" stroke="{blue}" stroke-width="{STROKE}" stroke-linejoin="round"/>' + nl
        + "</svg>" + nl
    )


def recolor_dark(mark):
    px = mark.load()
    dlt = [MARK_BLUE[i] - MARK_NAVY[i] for i in range(3)]
    dd = sum(v * v for v in dlt)
    for y in range(mark.height):
        for x in range(mark.width):
            r, g, bb, a = px[x, y]
            if a == 0:
                continue
            t = sum((c - MARK_NAVY[i]) * dlt[i] for i, c in enumerate((r, g, bb))) / dd
            t = min(max(t, 0.0), 1.0)
            px[x, y] = tuple(round(LIGHT[i] + (MARK_BLUE[i] - LIGHT[i]) * t) for i in range(3)) + (a,)
    return mark


def fit(mark, box, fill=0.97):
    m = mark.crop(mark.getbbox())
    k = box * fill / max(m.size)
    m = m.resize((round(m.width * k), round(m.height * k)), Image.LANCZOS)
    c = Image.new("RGBA", (box, box), (0, 0, 0, 0))
    c.alpha_composite(m, ((box - m.width) // 2, (box - m.height) // 2))
    return c


def on_bg(mark, size, bg, pad):
    c = Image.new("RGBA", (size, size), bg + (255,))
    inner = fit(mark, size - 2 * pad, 1.0)
    c.alpha_composite(inner, (pad, pad))
    return c


def wordmark(mark, dark):
    # 대문자 스플래시 v2 격자: 680×160, 마크 칸 128 을 (28,16), T 첫 열 184, 대문자 가운데 y 80, Segoe UI Bold 86.
    font = ImageFont.truetype(r"C:/Windows/Fonts/segoeuib.ttf", 86)
    H = 160
    W = 184 + round(font.getlength("TASTESTUDIO")) + 40
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    m = mark.crop(mark.getbbox())
    k = min(112 / (m.width * m.height) ** 0.5, 128 / m.width, 128 / m.height)
    m = m.resize((round(m.width * k), round(m.height * k)), Image.LANCZOS)
    img.alpha_composite(m, (28 + (128 - m.width) // 2, 16 + (128 - m.height) // 2))
    probe = Image.new("L", (200, 160), 0)
    ImageDraw.Draw(probe).text((50, 0), "T", font=font, fill=255)
    bearing = [x for x in range(200) if any(probe.getpixel((x, y)) for y in range(160))][0] - 50
    t, bt = font.getbbox("H")[1], font.getbbox("H")[3]
    x0, y0 = 184 - bearing, round(80 - (t + bt) / 2)
    d = ImageDraw.Draw(img)
    d.text((x0, y0), "TASTE", font=font, fill=(LIGHT if dark else NAVY) + (255,))
    d.text((x0 + d.textlength("TASTE", font=font), y0), "STUDIO", font=font, fill=SKY + (255,))
    return img


def trim(img, pad=0):
    bb = img.getbbox()
    return img.crop((max(bb[0] - pad, 0), max(bb[1] - pad, 0), min(bb[2] + pad, img.width), min(bb[3] + pad, img.height)))


def main():
    mark = studio_mark()
    dark = recolor_dark(studio_mark())
    os.makedirs(f"{OUT}/logo", exist_ok=True)
    os.makedirs(f"{OUT}/favicon", exist_ok=True)
    os.makedirs(f"{OUT}/pwa", exist_ok=True)
    os.makedirs(f"{OUT}/splash", exist_ok=True)
    fit(mark, 1024).save(f"{OUT}/logo/mark-1024.png", optimize=True)
    fit(dark, 1024).save(f"{OUT}/logo/mark-1024-reverse.png", optimize=True)
    for sz in (64, 128):
        fit(mark, sz).save(f"{OUT}/logo/mark-{sz}.png", optimize=True)
        fit(dark, sz).save(f"{OUT}/logo/mark-{sz}-reverse.png", optimize=True)
    app = on_bg(mark, 1024, (255, 255, 255), 150)
    app.save(f"{OUT}/logo/app-icon-1024.png", optimize=True)
    light = wordmark(mark, False); rev = wordmark(dark, True)
    light.save(f"{OUT}/splash/splash-logo@2x.png", optimize=True)
    rev.save(f"{OUT}/splash/splash-logo-dark@2x.png", optimize=True)
    trim(light, 2).save(f"{OUT}/logo/logo-horizontal.png", optimize=True)
    trim(rev, 2).save(f"{OUT}/logo/logo-horizontal-reverse.png", optimize=True)
    for sz in (16, 32, 48, 64):
        fit(mark, sz, 1.0).save(f"{OUT}/favicon/favicon-{sz}.png", optimize=True)
    fit(mark, 256, 1.0).save(f"{OUT}/favicon/favicon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    fit(mark, 192).save(f"{OUT}/pwa/icon-192.png", optimize=True)
    fit(mark, 512).save(f"{OUT}/pwa/icon-512.png", optimize=True)
    on_bg(mark, 512, (255, 255, 255), 100).save(f"{OUT}/pwa/maskable-512.png", optimize=True)
    on_bg(mark, 180, (255, 255, 255), 24).convert("RGB").save(f"{OUT}/pwa/apple-touch-icon.png", optimize=True)
    open(f"{OUT}/logo/mark.svg", "w", encoding="utf-8").write(studio_mark_svg())
    # 플랫폼 아이콘 — Windows ICO(16~256), Linux hicolor PNG.
    os.makedirs(f"{OUT}/platform/windows", exist_ok=True)
    fit(mark, 256, 0.97).save(f"{OUT}/platform/windows/tastestudio.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    for sz in (16, 24, 32, 48, 64, 128, 256, 512):
        os.makedirs(f"{OUT}/platform/linux/{sz}x{sz}", exist_ok=True)
        fit(mark, sz).save(f"{OUT}/platform/linux/{sz}x{sz}/tastestudio.png", optimize=True)
    # 공유 카드 1200×630 — 관리자 셸의 어두운 바탕(#0f1215)에 어두운 쪽 워드마크.
    os.makedirs(f"{OUT}/social", exist_ok=True)
    og = Image.new("RGBA", (1200, 630), (0x0F, 0x12, 0x15, 255))
    wm = trim(rev).resize((round(trim(rev).width * 1.35), round(trim(rev).height * 1.35)), Image.LANCZOS)
    og.alpha_composite(wm, ((1200 - wm.width) // 2, 230))
    sub = ImageFont.truetype(r"C:/Windows/Fonts/malgun.ttf", 34)
    d = ImageDraw.Draw(og)
    line = "개발 · 시험 자동화 스튜디오"
    d.text(((1200 - d.textlength(line, font=sub)) / 2, 230 + wm.height + 40), line, font=sub, fill=(0x8E, 0x98, 0xA5, 255))
    og.convert("RGB").save(f"{OUT}/social/og-1200x630.png", optimize=True)
    # 미리보기: 밝은 판 / 어두운 판.
    pv = Image.new("RGBA", (1600, 520), (255, 255, 255, 255))
    pv.alpha_composite(app.resize((240, 240), Image.LANCZOS), (20, 20))
    pv.alpha_composite(light, (300, 60))
    dk = Image.new("RGBA", (1600, 260), (0x0B, 0x1A, 0x30, 255))
    dk.alpha_composite(fit(dark, 200), (40, 30))
    dk.alpha_composite(rev, (300, 50))
    pv.alpha_composite(dk, (0, 260))
    pv.convert("RGB").save(f"{OUT}/preview.png")


if __name__ == "__main__":
    main()
