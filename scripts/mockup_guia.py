"""Mockup do Guia de Treino Feminino: livro 3D no centro com páginas reais do PDF em leque atrás.
Uso: python -I mockup_guia.py <pdf> <saida_sem_extensao>
"""
import sys
import numpy as np
import pymupdf
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

PDF, SAIDA = sys.argv[1], sys.argv[2]
doc = pymupdf.open(PDF)


def pagina(n, largura):
    pg = doc[n - 1]
    zoom = largura / pg.rect.width
    pix = pg.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
    return Image.frombytes('RGB', (pix.width, pix.height), pix.samples).convert('RGBA')


def coefs(dst, src):
    """Coeficientes do Image.transform PERSPECTIVE que levam src (4 pontos) a dst."""
    m = []
    for (x, y), (u, v) in zip(dst, src):
        m.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        m.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    a = np.array(m, dtype=float)
    b = np.array(src, dtype=float).reshape(8)
    return np.linalg.solve(a, b).tolist()


def com_sombra(img, raio=18, desloc=(0, 14), opac=110):
    """Imagem RGBA com sombra suave (margem extra em volta)."""
    pad = raio * 3
    w, h = img.size
    base = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    alpha = img.split()[3]
    sombra = Image.new('RGBA', img.size, (0, 0, 0, opac))
    sombra.putalpha(alpha.point(lambda p: opac if p > 0 else 0))
    base.alpha_composite(sombra, (pad + desloc[0], pad + desloc[1]))
    base = base.filter(ImageFilter.GaussianBlur(raio))
    base.alpha_composite(img, (pad, pad))
    return base


def folha(n, largura, angulo):
    img = pagina(n, largura)
    # borda cinza fina, como papel
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, img.width - 1, img.height - 1], outline=(200, 200, 200, 255), width=2)
    img = img.rotate(angulo, resample=Image.BICUBIC, expand=True)
    return com_sombra(img, raio=16, desloc=(6, 12), opac=120)


def livro(largura):
    capa = pagina(1, largura)
    w, h = capa.size
    lomb = int(w * 0.075)  # largura visível da lombada
    esp = int(w * 0.035)  # espessura das folhas (lado direito/baixo)
    W, H = w + lomb + esp + 40, h + esp + 60
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))

    # Capa em leve perspectiva (lado direito um pouco menor, como girada)
    topo_d, base_d = int(h * 0.025), int(h * 0.025)
    x0, x1 = lomb, lomb + w
    dst = [(x0, 0), (x1, topo_d), (x1, h - base_d), (x0, h)]
    capa_p = capa.transform((W, H), Image.PERSPECTIVE, coefs(dst, [(0, 0), (w, 0), (w, h), (0, h)]), Image.BICUBIC)

    # Folhas (miolo branco) aparecendo à direita, atrás da capa
    miolo = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dm = ImageDraw.Draw(miolo)
    dm.polygon([(x1, topo_d), (x1 + esp, topo_d + esp), (x1 + esp, h - base_d + esp // 2), (x1, h - base_d)], fill=(236, 233, 228, 255))
    for k in range(1, esp, 3):  # linhas das páginas
        dm.line([(x1 + k, topo_d + k), (x1 + k, h - base_d + k // 2)], fill=(205, 200, 194, 255), width=1)

    # Lombada (escura, com o título na vertical)
    lomb_img = Image.new('RGBA', (lomb, h), (18, 10, 12, 255))
    grad = Image.linear_gradient('L').rotate(90).resize((lomb, h))
    lomb_img = Image.composite(Image.new('RGBA', (lomb, h), (70, 12, 16, 255)), lomb_img, grad)
    try:
        fonte = ImageFont.truetype('C:/Windows/Fonts/impact.ttf', int(lomb * 0.62))
    except OSError:
        fonte = ImageFont.load_default()
    txt = Image.new('RGBA', (h, lomb), (0, 0, 0, 0))
    dt = ImageDraw.Draw(txt)
    dt.text((h * 0.08, lomb * 0.16), 'TREINO FEMININO', font=fonte, fill=(255, 255, 255, 255))
    dt.text((h * 0.08 + dt.textlength('TREINO FEMININO ', font=fonte), lomb * 0.16), 'GUIA COMPLETO', font=fonte, fill=(220, 38, 38, 255))
    lomb_img.alpha_composite(txt.rotate(-90, expand=True))
    lomb_dst = [(0, int(h * 0.012)), (lomb, 0), (lomb, h), (0, h - int(h * 0.012))]
    lomb_p = lomb_img.transform((W, H), Image.PERSPECTIVE, coefs(lomb_dst, [(0, 0), (lomb, 0), (lomb, h), (0, h)]), Image.BICUBIC)

    out.alpha_composite(miolo)
    out.alpha_composite(lomb_p)
    out.alpha_composite(capa_p)
    # brilho suave na capa (luz vinda da esquerda)
    brilho = Image.linear_gradient('L').rotate(90).resize((W, H)).point(lambda p: int(p * 0.10))
    luz = Image.new('RGBA', (W, H), (255, 255, 255, 0))
    luz.putalpha(Image.composite(brilho, Image.new('L', (W, H), 0), capa_p.split()[3]))
    out.alpha_composite(luz)
    return com_sombra(out, raio=26, desloc=(10, 22), opac=150)


CW, CH = 1500, 1380
tela = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))


def colar(img, cx, cy):
    tela.alpha_composite(img, (int(cx - img.width / 2), int(cy - img.height / 2)))


# páginas em leque (de trás para frente): número da página no PDF, largura, ângulo, centro
FOLHAS = [
    (31, 430, 16, 1160, 560),   # posteriores de coxa
    (20, 430, -6, 980, 330),    # quadríceps
    (2, 430, 13, 1140, 1000),   # sumário
    (44, 430, 9, 560, 300),     # costas
    (4, 430, -20, 330, 640),    # abertura: glúteos
    (5, 430, -9, 350, 1030),    # hip thrust
    (57, 430, 3, 790, 1120),    # ombros: preenche o vão abaixo da capa, atrás do livro
]
for n, lw, ang, cx, cy in FOLHAS:
    colar(folha(n, lw, ang), cx, cy)

colar(livro(560), 760, 760)

bbox = tela.getbbox()
final = tela.crop(bbox)

# Gradiente de transparência na parte de baixo (como a imagem do app na oferta do quiz):
# o último FADE da altura some aos poucos até ficar transparente
FADE = 0.30
fw, fh = final.size
ini = int(fh * (1 - FADE))
mascara = Image.new('L', (fw, fh), 255)
dm = ImageDraw.Draw(mascara)
for y in range(ini, fh):
    t = (y - ini) / max(1, fh - ini)
    dm.line([(0, y), (fw, y)], fill=int(255 * (1 - t) ** 1.6))
alpha = final.split()[3]
final.putalpha(Image.fromarray((np.asarray(alpha, dtype=np.float32) * np.asarray(mascara, dtype=np.float32) / 255).astype('uint8')))
for largura, sufixo in ((1100, ''), (720, '-720')):
    f = final.resize((largura, round(final.height * largura / final.width)), Image.LANCZOS)
    f.save(f'{SAIDA}{sufixo}.webp', 'WEBP', quality=84, method=6)
    print(f'{SAIDA}{sufixo}.webp', f.size)
final.convert('RGBA').save(f'{SAIDA}-previa.png')
