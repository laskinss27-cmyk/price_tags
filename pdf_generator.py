"""
PDF generator — price tags 60 × 40 mm, 18 per A4 page (3 cols × 6 rows).

Settings:
    company_name  str     bottom label, default "Умный Дом"
    price_field   str     "price_sale" | "price_goodsale"
    article_field str     API field used as article number, default "id"
    show_article  bool    show article in top-left
    show_model    bool    show model under product name
    qr_size_mm    float   QR side in mm, 8–20, default 12
    name_size     float   name font size pt, 6–13, default 8
"""
import io
import os

import qrcode
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.platypus.flowables import Flowable

# ── fixed tag / page geometry ─────────────────────────────────
TAG_W   = 60 * mm
TAG_H   = 40 * mm
BOT_H   =  6 * mm
PAD     =  2.5 * mm

MARGIN  = 10 * mm
COL_GAP =  3 * mm
ROW_GAP =  3 * mm
COLS    = 3
ROWS    = 6

QR_URL  = "https://dom-automation.ru"

FONT_REG  = "TagFont"
FONT_BOLD = "TagFont-Bold"
_fonts_ok = False


DEFAULT_SETTINGS: dict = {
    "company_name":  "Умный Дом",
    "price_field":   "price_sale",
    "article_field": "id",
    "show_article":  True,
    "show_model":    True,
    "qr_size_mm":    12.0,
    "name_size":     8.0,
}


# ── fonts ─────────────────────────────────────────────────────

def _register_fonts():
    global _fonts_ok
    if _fonts_ok:
        return
    for reg, bold in [
        ("C:/Windows/Fonts/arial.ttf",   "C:/Windows/Fonts/arialbd.ttf"),
        ("C:/Windows/Fonts/calibri.ttf", "C:/Windows/Fonts/calibrib.ttf"),
    ]:
        if os.path.exists(reg) and os.path.exists(bold):
            try:
                pdfmetrics.registerFont(TTFont(FONT_REG,  reg))
                pdfmetrics.registerFont(TTFont(FONT_BOLD, bold))
                _fonts_ok = True
                return
            except Exception:
                pass


# ── QR ────────────────────────────────────────────────────────

def _make_qr(url: str) -> ImageReader:
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=1,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return ImageReader(buf)


# ── helpers ───────────────────────────────────────────────────

def _fmt_price(value) -> str:
    try:
        return f"{int(float(value or 0)):,}".replace(",", "\u202f")
    except Exception:
        return str(value or "0")


def _wrap(c, text: str, font: str, size: float, max_w: float, max_lines=3) -> list:
    words = (text or "").split()
    lines, cur = [], []
    for word in words:
        if len(lines) >= max_lines:
            break
        test = " ".join(cur + [word])
        if c.stringWidth(test, font, size) <= max_w:
            cur.append(word)
        else:
            if cur:
                lines.append(" ".join(cur))
            cur = [word]
    if cur and len(lines) < max_lines:
        lines.append(" ".join(cur))
    return lines


def _fit_font(c, text: str, font: str, max_size: float, min_size: float, max_w: float) -> float:
    """Shrink font until text fits max_w."""
    size = max_size
    while size > min_size and c.stringWidth(text, font, size) > max_w:
        size -= 0.5
    return size


# ── tag ───────────────────────────────────────────────────────

class _Tag(Flowable):
    def __init__(self, good: dict, qr: ImageReader, s: dict):
        super().__init__()
        self.good = good
        self.qr   = qr
        self.s    = s
        self._fixedWidth  = TAG_W
        self._fixedHeight = TAG_H

    def wrap(self, *_):
        return TAG_W, TAG_H

    def draw(self):
        c  = self.canv
        g  = self.good
        s  = self.s
        W, H = TAG_W, TAG_H

        qr_size = float(s.get("qr_size_mm", 12)) * mm
        name_sz = float(s.get("name_size",  8.0))

        # dynamic top strip height: enough for name lines + model
        top_h = max(12 * mm, name_sz * 0.35 * mm * 3 + 4 * mm)

        right_x = PAD + qr_size + PAD
        right_w = W - right_x - PAD

        # ── border ───────────────────────────────────────────
        c.setFillColor(colors.white)
        c.setStrokeColor(colors.HexColor("#CCCCCC"))
        c.setLineWidth(0.5)
        c.roundRect(0.5, 0.5, W - 1, H - 1, 3 * mm, fill=1)

        # separators
        c.setStrokeColor(colors.HexColor("#EEEEEE"))
        c.setLineWidth(0.3)
        c.line(PAD, H - top_h, W - PAD, H - top_h)
        c.line(PAD, BOT_H,     W - PAD, BOT_H)

        # ── TOP STRIP ────────────────────────────────────────
        # article — top left, small grey
        if s.get("show_article", True):
            art_val = str(g.get(s.get("article_field", "id"), "") or "").strip()
            if art_val:
                c.setFillColor(colors.HexColor("#888888"))
                art_sz = _fit_font(c, f"Арт: {art_val}", FONT_REG, 6.5, 5.0, PAD + qr_size - PAD)
                c.setFont(FONT_REG, art_sz)
                c.drawString(PAD, H - top_h + 3.5 * mm, f"Арт: {art_val}")

        # name — right side, bold, adaptive wrap
        name = (g.get("name") or "").strip()
        c.setFillColor(colors.HexColor("#111111"))
        c.setFont(FONT_BOLD, name_sz)
        name_lines = _wrap(c, name, FONT_BOLD, name_sz, right_w, max_lines=3)
        line_h = name_sz * 0.38 * mm + 1 * mm
        name_top_y = H - top_h + top_h - 3.5 * mm
        for i, line in enumerate(name_lines):
            c.drawString(right_x, name_top_y - i * line_h, line)

        # model — right side, below name, smaller grey
        if s.get("show_model", True):
            model = (g.get("model") or "").strip()
            if model:
                model_y = name_top_y - len(name_lines) * line_h - 0.5 * mm
                if model_y > H - top_h + 1 * mm:
                    c.setFillColor(colors.HexColor("#666666"))
                    model_sz = max(5.5, name_sz - 1.5)
                    c.setFont(FONT_REG, model_sz)
                    c.drawString(right_x, model_y, model)

        # ── MIDDLE STRIP ─────────────────────────────────────
        mid_bot = BOT_H
        mid_h   = H - top_h - BOT_H

        # QR — left, vertically centred
        qr_y = mid_bot + (mid_h - qr_size) / 2
        c.drawImage(self.qr, PAD, qr_y, width=qr_size, height=qr_size, mask="auto")

        # price — right, vertically centred
        price_str = _fmt_price(g.get(s.get("price_field", "price_sale")))
        mid_cy    = mid_bot + mid_h / 2

        p_size = _fit_font(c, price_str, FONT_BOLD, 26, 13, right_w - 7 * mm)
        c.setFillColor(colors.HexColor("#111111"))
        c.setFont(FONT_BOLD, p_size)
        p_w = c.stringWidth(price_str, FONT_BOLD, p_size)
        c.drawString(right_x, mid_cy, price_str)

        c.setFont(FONT_REG, 7)
        c.setFillColor(colors.HexColor("#444444"))
        c.drawString(right_x + p_w + 1.5 * mm, mid_cy + 2.5 * mm, "руб.")

        # ── BOTTOM STRIP ─────────────────────────────────────
        company = s.get("company_name", "Умный Дом")
        c.setFillColor(colors.HexColor("#555555"))
        c.setFont(FONT_REG, 6.5)
        c.drawCentredString(W / 2, BOT_H / 2 - 1 * mm, company)


# ── public ────────────────────────────────────────────────────

class PDFGenerator:
    def __init__(self):
        _register_fonts()
        self._qr = _make_qr(QR_URL)

    def generate(self, goods: list, output_path: str, settings: dict = None):
        s = {**DEFAULT_SETTINGS, **(settings or {})}
        c = pdf_canvas.Canvas(output_path, pagesize=A4)
        c.setTitle("Ценники — Умный Дом")
        _, page_h = A4

        for i, good in enumerate(goods):
            pos = i % (COLS * ROWS)
            if pos == 0 and i > 0:
                c.showPage()
            col = pos % COLS
            row = pos // COLS
            x = MARGIN + col * (TAG_W + COL_GAP)
            y = page_h - MARGIN - (row + 1) * TAG_H - row * ROW_GAP

            c.saveState()
            c.translate(x, y)
            tag = _Tag(good, self._qr, s)
            tag.canv = c
            tag.draw()
            c.restoreState()

        c.save()
