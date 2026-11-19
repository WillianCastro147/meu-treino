# Uso: python scripts/mockup/gerar-imagens-bumps.py public/produtos
# Gera as imagens dos order bumps (512x512, sem texto), no estilo do ícone do Moviq:
# fundo em degradê azul (mesmas cores do icon-maskable-512.png) e desenho branco de traço arredondado.
import math
import sys
from PIL import Image, ImageDraw

S = 4  # desenha em 4x e reduz (bordas suaves)
W = 512 * S
C1 = (58, 129, 245)  # canto superior esquerdo
C2 = (29, 78, 216)   # canto inferior direito
WHITE = (255, 255, 255, 255)


def fundo():
    # degradê diagonal
    grad = Image.new('RGB', (2, 2))
    grad.putpixel((0, 0), C1)
    grad.putpixel((1, 1), C2)
    mid = tuple((a + b) // 2 for a, b in zip(C1, C2))
    grad.putpixel((1, 0), mid)
    grad.putpixel((0, 1), mid)
    return grad.resize((W, W), Image.BILINEAR).convert('RGBA')


def linha(d, pts, w):
    d.line(pts, fill=WHITE, width=w, joint='curve')
    r = w / 2
    for x, y in (pts[0], pts[-1]):
        d.ellipse((x - r, y - r, x + r, y + r), fill=WHITE)


def barra(d, x0, y0, x1, y1):
    r = min(x1 - x0, y1 - y0) / 2
    d.rounded_rectangle((x0, y0, x1, y1), radius=r, fill=WHITE)


def estrela(d, cx, cy, R):
    # brilho de 4 pontas (lados côncavos)
    pts = []
    n = 64
    for i in range(n):
        a = 2 * math.pi * i / n
        c, s = math.cos(a), math.sin(a)
        # superelipse côncava: |x|^0.5 + |y|^0.5 = 1
        k = (abs(c) ** 0.5 + abs(s) ** 0.5) ** -2
        pts.append((cx + R * k * c, cy + R * k * s))
    d.polygon(pts, fill=WHITE)


def plano_alimentar():
    im = fundo()
    d = ImageDraw.Draw(im)
    u = S
    cx, cy = 256 * u, 262 * u
    # prato: anel externo e anel interno
    R = 118 * u
    d.ellipse((cx - R, cy - R, cx + R, cy + R), outline=WHITE, width=22 * u)
    r = 74 * u
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=WHITE, width=12 * u)
    # garfo (esquerda)
    fx = 88 * u
    for dx in (-20, 0, 20):
        linha(d, [(fx + dx * u, 150 * u), (fx + dx * u, 214 * u)], 11 * u)
    d.rounded_rectangle((fx - 26 * u, 206 * u, fx + 26 * u, 236 * u), radius=15 * u, fill=WHITE)
    linha(d, [(fx, 226 * u), (fx, 380 * u)], 22 * u)
    # faca (direita)
    kx = 424 * u
    # lâmina: reta à esquerda, arredondada no topo e à direita
    d.rounded_rectangle((kx - 22 * u, 140 * u, kx + 20 * u, 266 * u), radius=20 * u, fill=WHITE)
    d.rectangle((kx - 22 * u, 160 * u, kx, 266 * u), fill=WHITE)
    linha(d, [(kx - 1 * u, 250 * u), (kx - 1 * u, 380 * u)], 22 * u)
    return im


def gerador_ia():
    im = fundo()
    d = ImageDraw.Draw(im)
    u = S
    # haltere do Moviq (mesmas proporções do ícone), um pouco menor e mais para baixo/esquerda
    k, ox, oy = 0.8, 30, 70
    T = lambda x, y: ((ox + x * k) * u, (oy + y * k) * u)
    def b(x0, y0, x1, y1):
        a, c = T(x0, y0), T(x1, y1)
        barra(d, a[0], a[1], c[0], c[1])
    b(122, 200, 152, 310)   # externa esquerda
    b(166, 168, 198, 342)   # interna esquerda
    b(190, 240, 322, 270)   # barra do meio
    b(314, 168, 346, 342)   # interna direita
    b(360, 200, 390, 310)   # externa direita
    # brilhos de "IA"
    estrela(d, 372 * u, 132 * u, 78 * u)
    estrela(d, 448 * u, 220 * u, 36 * u)
    estrela(d, 300 * u, 92 * u, 26 * u)
    return im


out = sys.argv[1]
for nome, fn in (('plano-alimentar', plano_alimentar), ('gerador-ia', gerador_ia)):
    fn().resize((512, 512), Image.LANCZOS).convert('RGB').save(f'{out}/{nome}.png', optimize=True)
    print('ok', nome)
