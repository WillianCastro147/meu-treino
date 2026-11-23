# Uso: python scripts/mockup/gerar-mockups-es.py
# Imagens do app em espanhol para o quiz /es (quiz-dados-es.js troca as vagas por estas):
#   public/quiz-site/img/info-app-es.webp       celular do treino (tela "info-app" e tela de oferta), igual ao
#                                                info-app.webp do português (gerar-mockup-app.py)
#   public/quiz-site/img/info-objetivo-es.webp  três celulares (treino, início e exercício aberto), igual ao
#                                                info-objetivo.webp do português
# Capturas do app em espanhol (iPhone, 921x2000) em scripts/mockup/es/.
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops, ImageEnhance

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, '..', '..'))
CAP = lambda nome: os.path.join(AQUI, 'es', f'captura-{nome}.png')
OUT = lambda nome: os.path.join(RAIZ, 'public', 'quiz-site', 'img', nome)


def barra_limpa(shot):
    """Troca a barra de status real (hora, bateria) por uma limpa: 9:41, sinal, wi-fi e bateria cheia.
    Medidas do gerar-mockup-app.py (captura de 1320 de largura), em escala para a largura da captura."""
    shot = shot.copy()
    SW = shot.size[0]
    f = SW / 1320
    p = lambda v: round(v * f)
    d = ImageDraw.Draw(shot)
    d.rectangle((0, 0, SW, p(175)), fill=(0, 0, 0))
    d.text((p(150), p(62)), '9:41', font=ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf', p(64)), fill='white')
    for i, hgt in enumerate((18, 28, 38, 48)):
        x = 930 + i * 22
        d.rounded_rectangle((p(x), p(118 - hgt), p(x + 14), p(118)), radius=p(4), fill='white')
    cx, cy = 1050, 122
    for r in (52, 36, 20):
        d.pieslice((p(cx - r), p(cy - r), p(cx + r), p(cy + r)), 225, 315, fill='white')
        d.pieslice((p(cx - r + 9), p(cy - r + 9), p(cx + r - 9), p(cy + r - 9)), 225, 315, fill=(0, 0, 0))
    d.ellipse((p(cx - 7), p(cy - 13), p(cx + 7), p(cy + 1)), fill='white')
    d.rounded_rectangle((p(1110), p(76), p(1196), p(120)), radius=p(12), outline='white', width=max(2, p(4)))
    d.rounded_rectangle((p(1117), p(83), p(1189), p(113)), radius=p(8), fill='white')
    d.rounded_rectangle((p(1200), p(90), p(1206), p(106)), radius=p(3), fill='white')
    return shot


def celular(shot, scr_w, max_scr_h=None):
    """Aparelho (RGBA, fundo transparente) com a captura na tela. scr_w: largura da tela em px."""
    SW, SH = shot.size
    scr_h = round(SH * scr_w / SW)
    screen = shot.resize((scr_w, scr_h), Image.LANCZOS)
    if max_scr_h and scr_h > max_scr_h:  # só a parte de cima da tela (o resto some no degradê)
        screen = screen.crop((0, 0, scr_w, max_scr_h))
        scr_h = max_scr_h
    k = scr_w / 772  # proporções do info-app.webp (tela de 772 px)
    bez = round(26 * k)
    W, H = scr_w + 2 * bez, scr_h + 2 * bez
    ph = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ph)
    d.rounded_rectangle((0, 0, W - 1, H - 1), radius=round(132 * k), fill=(18, 18, 20, 255))
    d.rounded_rectangle((0, 0, W - 1, H - 1), radius=round(132 * k), outline=(74, 74, 80, 255), width=max(2, round(5 * k)))
    d.rounded_rectangle((round(9 * k), round(9 * k), W - 1 - round(9 * k), H - 1 - round(9 * k)), radius=round(124 * k),
                        outline=(40, 40, 44, 255), width=max(1, round(3 * k)))
    mask = Image.new('L', screen.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, scr_w - 1, scr_h - 1), radius=round(108 * k), fill=255)
    ph.paste(screen, (bez, bez), mask)
    iw, ih = round(250 * k), round(72 * k)  # Dynamic Island
    ix, iy = W // 2 - iw // 2, bez + round(26 * k)
    ImageDraw.Draw(ph).rounded_rectangle((ix, iy, ix + iw, iy + ih), radius=ih // 2, fill=(0, 0, 0, 255))
    return ph


def info_app(shot, out):
    """Mesmo layout do info-app.webp: 900x1200, fundo transparente, brilho azul atrás e degradê no fim."""
    OUT_W, OUT_H = 900, 1200
    px0, py0 = 38, 24
    scr_w = OUT_W - 2 * px0 - 2 * 26
    ph = celular(shot, scr_w, max_scr_h=OUT_H)
    canvas = Image.new('RGBA', (OUT_W, OUT_H), (0, 0, 0, 0))
    glow = Image.new('RGBA', (OUT_W, OUT_H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).rounded_rectangle((px0 + 40, py0 + 80, px0 + ph.size[0] - 40, OUT_H), radius=140, fill=(59, 130, 246, 70))
    canvas = Image.alpha_composite(canvas, glow.filter(ImageFilter.GaussianBlur(60)))
    canvas.alpha_composite(ph, (px0, py0))
    fade_from = int(OUT_H * 0.72)
    grad = Image.new('L', (1, OUT_H), 255)
    for y in range(fade_from, OUT_H):
        t = (y - fade_from) / (OUT_H - fade_from)
        grad.putpixel((0, y), int(255 * (1 - t) ** 1.6))
    canvas.putalpha(ImageChops.multiply(canvas.getchannel('A'), grad.resize((OUT_W, OUT_H))))
    canvas.save(out, 'WEBP', quality=90, method=6)
    print('ok', os.path.basename(out), canvas.size)


def info_objetivo(esq, meio, dir_, out):
    """Mesmo layout do info-objetivo.webp (800x600, fundo #191715), em 2x: 1600x1200.
    Celular do meio na frente (início); os dos lados um pouco menores, mais baixos e mais escuros."""
    W, H = 1600, 1200
    canvas = Image.new('RGBA', (W, H), (25, 23, 21, 255))

    def sombra(ph, x, y):
        s = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        a = ph.getchannel('A').point(lambda v: 150 if v else 0)
        s.paste((0, 0, 0, 255), (x + 10, y + 24), a)
        return s.filter(ImageFilter.GaussianBlur(28))

    lado = []
    for shot, x in ((esq, 92), (dir_, None)):
        ph = celular(shot, 428)
        ph = Image.merge('RGBA', (*ImageEnhance.Brightness(ph.convert('RGB')).enhance(0.82).split(), ph.getchannel('A')))
        lado.append((ph, x if x is not None else W - 92 - ph.size[0], 190))
    for ph, x, y in lado:
        canvas = Image.alpha_composite(canvas, sombra(ph, x, y))
        canvas.alpha_composite(ph, (x, y))

    ph = celular(meio, 486)
    x, y = (W - ph.size[0]) // 2, 52
    canvas = Image.alpha_composite(canvas, sombra(ph, x, y))
    canvas.alpha_composite(ph, (x, y))

    canvas.convert('RGB').save(out, 'WEBP', quality=88, method=6)
    print('ok', os.path.basename(out), canvas.size)


treino = barra_limpa(Image.open(CAP('treino')).convert('RGB'))
inicio = barra_limpa(Image.open(CAP('inicio')).convert('RGB'))
exercicio = barra_limpa(Image.open(CAP('exercicio')).convert('RGB'))

info_app(treino, OUT('info-app-es.webp'))
info_objetivo(treino, inicio, exercicio, OUT('info-objetivo-es.webp'))
