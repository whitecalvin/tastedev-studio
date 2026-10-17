# TASTESTUDIO 제품 이미지 묶음 — TASTEDEV 소프트 타입(남색 · 스카이블루) 제품군과 같은 꼴 · 같은 규격(2026-10-02).
#
# 기준: ../tastedev-soft-type-navy-blue-20260921/export-assets.cjs 의 배치를 그대로 옮겼다.
#   - 워드마크는 제품군 공통 둥근 `tastedev`(tastedev/logo/wordmark.png), 제품명은 그 아래 스카이블루 `STUDIO`(Segoe UI Semibold).
#   - 마크는 make-studio-brand.py 의 큐브(예전 studio.svg)(logo/mark-1024.png).
#   - 슬로건: 세상의 앱을, 더 좋은 취향으로 다시 개발하다.
# 결과는 tastedev-studio/ 아래에 다른 제품과 같은 폴더 구조로 둔다(auth · favicon · logo · platform · pwa · social · splash · brand-board).
# 실행: C:\Users\whitecalvin\anaconda3\python.exe make-studio-family.py   (먼저 make-studio-brand.py)
import io, os, struct
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FAMILY = os.path.join(HERE, "..", "tastedev-soft-type-navy-blue-20260921")
OUT = os.path.join(HERE, "tastedev-studio")
NAVY = (0x10, 0x2A, 0x4C); BLUE = (0x46, 0x9B, 0xEA); WHITE = (255, 255, 255)
LABEL = "STUDIO"
SLOGAN = "세상의 앱을, 더 좋은 취향으로 다시 개발하다."

SEMIBOLD = r"C:/Windows/Fonts/seguisb.ttf"
KOREAN = r"C:/Windows/Fonts/malgunbd.ttf"


def crop(im):
    return im.crop(im.getbbox())


MARK = crop(Image.open(os.path.join(HERE, "logo", "mark-1024.png")).convert("RGBA"))
DARK_MARK = crop(Image.open(os.path.join(HERE, "logo", "mark-1024-reverse.png")).convert("RGBA"))
WORD = crop(Image.open(os.path.join(FAMILY, "tastedev", "logo", "wordmark.png")).convert("RGBA"))


def fit(im, w, h):
    k = min(w / im.width, h / im.height)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def icon(master, size, pad=0.015, bg=None):
    """export-assets.cjs icon(): 가장자리 pad 만큼 비우고 가운데."""
    n = max(1, int(size * (1 - 2 * pad)))
    small = fit(master, n, n)
    c = Image.new("RGBA", (size, size), (bg + (255,)) if bg else (0, 0, 0, 0))
    c.alpha_composite(small, ((size - small.width) // 2, (size - small.height) // 2))
    return c


def place(canvas, im, x, y, w, h):
    """SVG <image> 의 기본(xMidYMid meet) — 상자 안에 맞추고 가운데."""
    f = fit(im, w, h)
    canvas.alpha_composite(f, (x + (w - f.width) // 2, y + (h - f.height) // 2))


def text(canvas, x, y, size, s, color=NAVY, font=SEMIBOLD, center=False):
    """SVG <text x y> — y 는 기준선."""
    d = ImageDraw.Draw(canvas)
    f = ImageFont.truetype(font, size)
    if center:
        x = x - d.textlength(s, font=f) / 2
    d.text((x, y), s, font=f, fill=color + (255,), anchor="ls")


def save(rel, im, opaque=False):
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    (im.convert("RGB") if opaque else im).save(path, optimize=True)
    return path


def save_ico(rel, master):
    sizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]
    frames = []
    for s in sizes:
        b = io.BytesIO(); icon(master, s, 0.02).save(b, "PNG"); frames.append(b.getvalue())
    head = struct.pack("<HHH", 0, 1, len(frames))
    entries = b""; offset = 6 + 16 * len(frames)
    for s, f in zip(sizes, frames):
        entries += struct.pack("<BBBBHHII", 0 if s == 256 else s, 0 if s == 256 else s, 0, 0, 1, 32, len(f), offset)
        offset += len(f)
    path = os.path.join(OUT, rel); os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "wb").write(head + entries + b"".join(frames))


def save_icns(rel, master):
    types = {32: b"icp5", 64: b"icp6", 128: b"ic07", 256: b"ic08", 512: b"ic09", 1024: b"ic10"}
    chunks = b""
    for s, t in types.items():
        b = io.BytesIO(); icon(master, s, 0.035).save(b, "PNG"); data = b.getvalue()
        chunks += t + struct.pack(">I", len(data) + 8) + data
    path = os.path.join(OUT, rel); os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "wb").write(b"icns" + struct.pack(">I", len(chunks) + 8) + chunks)


def horizontal(mark=MARK, word=WORD, ink=None):
    c = Image.new("RGBA", (1500, 360), (0, 0, 0, 0))
    c.alpha_composite(icon(mark, 300), (10, 30))
    place(c, word, 355, 58, 780, 200)
    text(c, 365, 306, 55, LABEL, BLUE)
    return c


def recolor(im, color):
    """남색 글자를 다른 색으로(알파 유지) — 어두운 바탕용 워드마크."""
    r = Image.new("RGBA", im.size, color + (0,))
    r.putalpha(im.getchannel("A"))
    return r


def main():
    # 로고
    save("logo/mark-1024.png", icon(MARK, 1024))
    save("logo/app-icon-1024.png", icon(MARK, 1024))
    save("logo/logo-horizontal.png", horizontal())
    save("logo/logo-horizontal-reverse.png", horizontal(DARK_MARK, recolor(WORD, (0xEC, 0xE8, 0xF6))))
    stacked = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    stacked.alpha_composite(icon(MARK, 650), (187, 0))
    place(stacked, WORD, 112, 710, 800, 150)
    text(stacked, 512, 958, 60, LABEL, BLUE, center=True)
    save("logo/logo-stacked.png", stacked)

    # 인증 화면 앱 로고(구글 · 네이버 · 카카오 · GitHub App)
    for name, s in [("google-120.png", 120), ("google-512.png", 512), ("naver-140.png", 140), ("kakao-128.png", 128)]:
        save(f"auth/{name}", icon(MARK, s))
    save("auth/github-app-200.png", icon(MARK, 200, 0.08))
    save("auth/github-app-200-white.png", icon(MARK, 200, 0.08, WHITE), opaque=True)

    # PWA · favicon · 플랫폼
    for s in (192, 512):
        save(f"pwa/icon-{s}.png", icon(MARK, s))
    save("pwa/maskable-512.png", icon(MARK, 512, 0.23, WHITE), opaque=True)
    save("pwa/apple-touch-icon.png", icon(MARK, 180, 0.09, WHITE), opaque=True)
    save("pwa/apple-touch-transparent-180.png", icon(MARK, 180))
    for s in (16, 32, 48, 64):
        save(f"favicon/favicon-{s}.png", icon(MARK, s, 0.02))
    save_ico("favicon/favicon.ico", MARK)
    save_ico("platform/windows/app.ico", MARK)
    save_icns("platform/macos/app.icns", MARK)
    for s in (16, 24, 32, 48, 64, 128, 256, 512):
        save(f"platform/linux/{s}x{s}/tastedev-studio.png", icon(MARK, s))

    # 공유 카드 — 제품군과 같은 흰 카드
    card = Image.new("RGBA", (1200, 630), WHITE + (255,))
    card.alpha_composite(icon(MARK, 400), (65, 85))
    place(card, WORD, 535, 170, 590, 112)
    text(card, 540, 350, 52, LABEL, BLUE)
    text(card, 540, 425, 24, "세상의 앱을, 더 좋은 취향으로", font=KOREAN)
    text(card, 540, 465, 24, "다시 개발하다.", font=KOREAN)
    save("social/og-1200x630.png", card, opaque=True)

    # 스플래시(제품군 soft type 의 splash-logo@2x 와 같은 640×167, 왼쪽 마크 + 워드마크 + GEO)
    splash = Image.new("RGBA", (640, 167), (0, 0, 0, 0))
    h = horizontal()
    place(splash, h, 0, 0, 640, 167)
    save("splash/splash-logo@2x.png", splash)

    # 히어로(홈페이지 · 제품 소개 머리) 1600×650
    hero = Image.new("RGBA", (1600, 650), WHITE + (255,))
    hero.alpha_composite(icon(MARK, 380), (85, 110))
    place(hero, WORD, 570, 175, 900, 170)
    text(hero, 575, 420, 64, LABEL, BLUE)
    text(hero, 575, 490, 31, SLOGAN, font=KOREAN)
    save("social/hero-1600x650.png", hero, opaque=True)

    # 브랜드 보드 1600×900 — 마크 · 가로/세로 로고 · 어두운 바탕 · 색 · 앱 아이콘 크기
    board = Image.new("RGBA", (1600, 900), (0xF5, 0xF8, 0xFC, 255))
    text(board, 60, 72, 34, "TASTEDEV / SOFT TYPE — STUDIO")
    text(board, 60, 116, 22, SLOGAN, font=KOREAN)
    d = ImageDraw.Draw(board)
    def panel(x, y, w, h, fill=WHITE):
        d.rounded_rectangle((x, y, x + w, y + h), radius=20, fill=fill + (255,))
    panel(60, 160, 470, 470)
    board.alpha_composite(icon(MARK, 330), (130, 210))
    text(board, 90, 605, 20, "마크 — 큐브(예전 studio.svg)", font=KOREAN)
    panel(560, 160, 980, 220)
    place(board, horizontal(), 590, 180, 920, 180)
    panel(560, 410, 480, 220, (0x0F, 0x12, 0x15))
    place(board, horizontal(DARK_MARK, recolor(WORD, (0xEC, 0xE8, 0xF6))), 585, 445, 430, 150)
    panel(1060, 410, 480, 220)
    for i, s in enumerate((96, 64, 48, 32, 16)):
        x = 1090 + sum((96, 64, 48, 32, 16)[:i]) + 24 * i
        board.alpha_composite(icon(MARK, s), (x, 520 - s // 2))
    text(board, 1090, 605, 20, "앱 아이콘 96 · 64 · 48 · 32 · 16", font=KOREAN)
    panel(60, 660, 470, 200)
    place(board, stacked, 60, 670, 470, 180)
    swatches = [("마크 남색", (0x0E, 0x2B, 0x51)), ("마크 파랑", (0x40, 0x99, 0xF0)), ("글자 남색", NAVY), ("스카이블루", BLUE), ("셸 바탕", (0x0F, 0x12, 0x15))]
    for i, (name, col) in enumerate(swatches):
        x = 560 + i * 200
        d.rounded_rectangle((x, 660, x + 180, 780), radius=16, fill=col + (255,))
        text(board, x, 815, 20, name, font=KOREAN)
        text(board, x, 845, 18, "#%02X%02X%02X" % col)
    save("brand-board/tastedev-studio-brand-board-1600x900.png", board, opaque=True)
    print("done", OUT)


if __name__ == "__main__":
    main()
