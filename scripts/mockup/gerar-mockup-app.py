# Uso: python scripts/mockup/gerar-mockup-app.py scripts/mockup/captura-treino.png public/quiz-site/img/info-app.webp
# Mockup do app para o quiz (tela "info-app" e tela de oferta), a partir da captura nítida (1320x2580)
# que estava dentro do info-app.svg. Saída em alta resolução (3x), fundo transparente, celular grande
# mostrando a parte de cima da tela e sumindo num degradê para o preto do quiz.
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

src, out = sys.argv[1], sys.argv[2]
shot = Image.open(src).convert('RGB')  # 1320 x 2580
SW, SH = shot.size

# 1) Barra de status limpa (sem o horário/bateria reais do aparelho)
d = ImageDraw.Draw(shot)
d.rectangle((0, 0, SW, 175), fill=(0, 0, 0))
font = ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf', 64)
d.text((150, 62), '9:41', font=font, fill='white')
# sinal (4 barras)
for i, hgt in enumerate((18, 28, 38, 48)):
    x = 930 + i * 22
    d.rounded_rectangle((x, 118 - hgt, x + 14, 118), radius=4, fill='white')
# wi-fi (3 arcos)
cx, cy = 1050, 122
for r in (52, 36, 20):
    d.pieslice((cx - r, cy - r, cx + r, cy + r), 225, 315, fill='white')
    d.pieslice((cx - r + 9, cy - r + 9, cx + r - 9, cy + r - 9), 225, 315, fill=(0, 0, 0))
d.ellipse((cx - 7, cy - 13, cx + 7, cy + 1), fill='white')
# bateria cheia
d.rounded_rectangle((1110, 76, 1196, 120), radius=12, outline='white', width=4)
d.rounded_rectangle((1117, 83, 1189, 113), radius=8, fill='white')
d.rounded_rectangle((1200, 90, 1206, 106), radius=3, fill='white')

# 2) Celular
K = 3                      # densidade (3x)
OUT_W, OUT_H = 300 * K, 400 * K
BEZ = 26                   # borda do aparelho
SCR_W = OUT_W - 2 * 38 - 2 * BEZ
scale = SCR_W / SW
SCR_H = round(SH * scale)
screen = shot.resize((SCR_W, SCR_H), Image.LANCZOS)

px0, py0 = 38, 24
px1, py1 = px0 + SCR_W + 2 * BEZ, py0 + SCR_H + 2 * BEZ
canvas = Image.new('RGBA', (OUT_W, OUT_H), (0, 0, 0, 0))

# brilho azul suave atrás do aparelho
glow = Image.new('RGBA', (OUT_W, OUT_H), (0, 0, 0, 0))
ImageDraw.Draw(glow).rounded_rectangle((px0 + 40, py0 + 80, px1 - 40, py1), radius=140, fill=(59, 130, 246, 70))
canvas = Image.alpha_composite(canvas, glow.filter(ImageFilter.GaussianBlur(60)))

body = ImageDraw.Draw(canvas)
body.rounded_rectangle((px0, py0, px1, py1), radius=132, fill=(18, 18, 20, 255))
body.rounded_rectangle((px0, py0, px1, py1), radius=132, outline=(74, 74, 80, 255), width=5)
body.rounded_rectangle((px0 + 9, py0 + 9, px1 - 9, py1 - 9), radius=124, outline=(40, 40, 44, 255), width=3)

mask = Image.new('L', screen.size, 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, SCR_W - 1, SCR_H - 1), radius=108, fill=255)
canvas.paste(screen, (px0 + BEZ, py0 + BEZ), mask)

# Dynamic Island
iw, ih = 250, 72
ix = (px0 + px1) // 2 - iw // 2
iy = py0 + BEZ + 26
body = ImageDraw.Draw(canvas)
body.rounded_rectangle((ix, iy, ix + iw, iy + ih), radius=ih // 2, fill=(0, 0, 0, 255))

# 3) Degradê no fim: some no preto do quiz
fade_from = int(OUT_H * 0.72)
alpha = canvas.getchannel('A')
grad = Image.new('L', (1, OUT_H), 255)
for y in range(fade_from, OUT_H):
    t = (y - fade_from) / (OUT_H - fade_from)
    grad.putpixel((0, y), int(255 * (1 - t) ** 1.6))
grad = grad.resize((OUT_W, OUT_H))
from PIL import ImageChops
canvas.putalpha(ImageChops.multiply(alpha, grad))

canvas.save(out, 'WEBP', quality=90, method=6)
canvas.save(out.replace('.webp', '-preview.png'))
print('ok', canvas.size)
