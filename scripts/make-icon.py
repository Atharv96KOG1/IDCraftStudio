# Draws the IDCraft Studio app icon (build/icon.png, build/icon.ico, public/icon.png).
# Run: python3 scripts/make-icon.py   (needs Pillow)
from PIL import Image, ImageDraw, ImageFilter

S = 2048


def lerp(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def background():
    bg = Image.new('RGB', (S, S))
    px = bg.load()
    c1, c2, c3 = (67, 56, 202), (147, 51, 234), (236, 72, 153)
    for y in range(S):
        for x in range(S):
            t = (x * 0.45 + y * 0.55) / S
            px[x, y] = lerp(c1, c2, t / 0.6) if t < 0.6 else lerp(c2, c3, (t - 0.6) / 0.4)
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, S - 1, S - 1), int(S * 0.23), fill=255)
    icon = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    icon.paste(bg, (0, 0), mask)
    gloss = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(gloss).ellipse((-S * 0.3, -S * 0.75, S * 1.2, S * 0.42), fill=(255, 255, 255, 30))
    clipped = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    clipped.paste(gloss, (0, 0), mask)
    return Image.alpha_composite(icon, clipped)


def card(w, h, alpha=255, details=True):
    c = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    r = int(h * 0.12)
    d.rounded_rectangle((0, 0, w - 1, h - 1), r, fill=(255, 255, 255, alpha))
    if not details:
        return c
    head = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    hd = ImageDraw.Draw(head)
    for i in range(int(h * 0.2)):
        hd.line((0, i, w, i), fill=lerp((79, 70, 229), (124, 58, 237), i / (h * 0.2)) + (255,))
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=255)
    c.alpha_composite(Image.composite(head, Image.new('RGBA', (w, h), (0, 0, 0, 0)), m))
    d.rounded_rectangle((int(w * 0.06), int(h * 0.07), int(w * 0.34), int(h * 0.13)), int(h * 0.03), fill=(255, 255, 255, 210))
    # avatar
    ar = int(h * 0.22)
    ax, ay = int(w * 0.22), int(h * 0.56)
    av = Image.new('RGBA', (ar * 2, ar * 2))
    ad = ImageDraw.Draw(av)
    for i in range(ar * 2):
        ad.line((0, i, ar * 2, i), fill=lerp((129, 140, 248), (232, 121, 249), i / (ar * 2)) + (255,))
    ad.ellipse((ar * 0.62, ar * 0.40, ar * 1.38, ar * 1.16), fill=(255, 255, 255, 255))
    ad.ellipse((ar * 0.30, ar * 1.28, ar * 1.70, ar * 2.55), fill=(255, 255, 255, 255))
    am = Image.new('L', (ar * 2, ar * 2), 0)
    ImageDraw.Draw(am).ellipse((0, 0, ar * 2 - 1, ar * 2 - 1), fill=255)
    c.paste(av, (ax - ar, ay - ar), am)
    # text lines
    x0 = int(w * 0.45)
    for i, (ww, col) in enumerate([(0.44, (31, 41, 55)), (0.34, (167, 172, 186)), (0.26, (167, 172, 186))]):
        y = int(h * (0.33 + i * 0.13))
        d.rounded_rectangle((x0, y, x0 + int(w * ww), y + int(h * 0.07)), int(h * 0.035), fill=col + (255,))
    # mini QR
    q = int(h * 0.19)
    qx, qy = x0, int(h * 0.73)
    cell = q / 5
    pat = [1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1]
    for i, v in enumerate(pat):
        if v:
            cx, cy = qx + (i % 5) * cell, qy + (i // 5) * cell
            d.rounded_rectangle((cx, cy, cx + cell - 6, cy + cell - 6), 4, fill=(79, 70, 229, 255))
    # badge dot
    dr = int(h * 0.075)
    d.ellipse((int(w * 0.86) - dr, int(h * 0.82) - dr, int(w * 0.86) + dr, int(h * 0.82) + dr), fill=(236, 72, 153, 255))
    return c


def main():
    icon = background()
    W, H = int(S * 0.70), int(S * 0.46)
    back = card(W, H, 85, False).rotate(10, resample=Image.BICUBIC, expand=True)
    front_flat = card(W, H)
    shadow = Image.new('RGBA', (W + 400, H + 400), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((200, 200, 200 + W, 200 + H), int(H * 0.12), fill=(25, 5, 60, 90))
    shadow = shadow.rotate(-6, resample=Image.BICUBIC, expand=True).filter(ImageFilter.GaussianBlur(55))
    front = front_flat.rotate(-6, resample=Image.BICUBIC, expand=True)
    cx, cy = S // 2, int(S * 0.53)
    icon.alpha_composite(back, (cx - back.width // 2 + 40, cy - back.height // 2 - 110))
    icon.alpha_composite(shadow, (cx - shadow.width // 2 + 10, cy - shadow.height // 2 + 60))
    icon.alpha_composite(front, (cx - front.width // 2, cy - front.height // 2))
    out = icon.resize((1024, 1024), Image.LANCZOS)
    out.save('build/icon.png')
    out.resize((512, 512), Image.LANCZOS).save('public/icon.png')
    out.save('build/icon.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print('icon written')


main()
