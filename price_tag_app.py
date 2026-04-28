"""
Генератор ценников — dom-automation.ru
Запуск: python price_tag_app.py
"""
import os
import threading
import tkinter as tk
from tkinter import ttk, messagebox, filedialog

from api_client import APIClient
from pdf_generator import PDFGenerator, DEFAULT_SETTINGS

BASE_URL   = "https://admin.dom-automation.ru"
CRED_FILE  = os.path.join(os.path.dirname(__file__), ".saved_login")


# ─────────────────────────────────────────────────────────────
# LOGIN
# ─────────────────────────────────────────────────────────────

class LoginFrame(tk.Frame):
    def __init__(self, parent, on_success):
        super().__init__(parent, padx=50, pady=40)
        self.on_success = on_success

        tk.Label(self, text="dom-automation.ru",
                 font=("Arial", 15, "bold")).grid(row=0, column=0, columnspan=2, pady=(0, 4))
        tk.Label(self, text="Генератор ценников",
                 font=("Arial", 10), fg="#555").grid(row=1, column=0, columnspan=2, pady=(0, 24))

        tk.Label(self, text="Пользователь:", anchor="e").grid(row=2, column=0, sticky="e", padx=6, pady=6)
        self._login = tk.StringVar()
        tk.Entry(self, textvariable=self._login, width=26).grid(row=2, column=1, padx=6, pady=6)

        tk.Label(self, text="Пароль:", anchor="e").grid(row=3, column=0, sticky="e", padx=6, pady=6)
        self._pass = tk.StringVar()
        pe = tk.Entry(self, textvariable=self._pass, show="●", width=26)
        pe.grid(row=3, column=1, padx=6, pady=6)
        pe.bind("<Return>", lambda _: self._do_login())

        self._btn = tk.Button(self, text="Войти", command=self._do_login,
                              width=22, bg="#1565C0", fg="white",
                              activebackground="#0D47A1", activeforeground="white",
                              font=("Arial", 10, "bold"), pady=4)
        self._btn.grid(row=4, column=0, columnspan=2, pady=20)

        self._status = tk.StringVar()
        tk.Label(self, textvariable=self._status, fg="red", wraplength=280)\
            .grid(row=5, column=0, columnspan=2)

        if os.path.exists(CRED_FILE):
            try:
                self._login.set(open(CRED_FILE, encoding="utf-8").read().strip())
            except Exception:
                pass

    def _do_login(self):
        login = self._login.get().strip()
        password = self._pass.get()
        if not login or not password:
            self._status.set("Введите логин и пароль")
            return
        self._btn.config(state="disabled", text="Подключение…")
        self._status.set("")

        def run():
            api = APIClient(BASE_URL)
            ok, msg = api.login(login, password)
            self.after(0, lambda: self._finish(ok, msg, api, login))

        threading.Thread(target=run, daemon=True).start()

    def _finish(self, ok, msg, api, login):
        self._btn.config(state="normal", text="Войти")
        if ok:
            try:
                open(CRED_FILE, "w", encoding="utf-8").write(login)
            except Exception:
                pass
            self.on_success(api)
        else:
            self._status.set(msg or "Ошибка входа")


# ─────────────────────────────────────────────────────────────
# TEMPLATE SETTINGS DIALOG
# ─────────────────────────────────────────────────────────────

class SettingsDialog(tk.Toplevel):
    """Настройка внешнего вида ценника (60×40 мм)."""

    def __init__(self, parent, current: dict, on_save):
        super().__init__(parent)
        self.title("Настройка ценника")
        self.resizable(False, False)
        self.grab_set()
        self.on_save = on_save
        self._s = dict(current)

        pad = dict(padx=12, pady=5)

        r = 0
        # ── Company name ──────────────────────────────────────
        tk.Label(self, text="Название компании:", anchor="e").grid(row=r, column=0, sticky="e", **pad)
        self._company = tk.StringVar(value=self._s.get("company_name", "Умный Дом"))
        tk.Entry(self, textvariable=self._company, width=24).grid(row=r, column=1, sticky="w", **pad)

        # ── Price field ───────────────────────────────────────
        r += 1
        tk.Label(self, text="Поле цены:", anchor="e").grid(row=r, column=0, sticky="e", **pad)
        self._price_field = tk.StringVar(value=self._s.get("price_field", "price_sale"))
        frm = tk.Frame(self)
        frm.grid(row=r, column=1, sticky="w", **pad)
        tk.Radiobutton(frm, text="Розничная (price_sale)",
                       variable=self._price_field, value="price_sale").pack(anchor="w")
        tk.Radiobutton(frm, text="Оптовая (price_goodsale)",
                       variable=self._price_field, value="price_goodsale").pack(anchor="w")

        # ── Article field name ────────────────────────────────
        r += 1
        tk.Label(self, text="Поле артикула\n(из API):", justify="right", anchor="e").grid(
            row=r, column=0, sticky="e", **pad)
        art_frm = tk.Frame(self)
        art_frm.grid(row=r, column=1, sticky="w", **pad)
        self._article_field = tk.StringVar(value=self._s.get("article_field", "id"))
        tk.Entry(art_frm, textvariable=self._article_field, width=18).pack(side="left")
        tk.Label(art_frm, text=" (сейчас: id)", fg="#888").pack(side="left")

        # ── Checkboxes ────────────────────────────────────────
        r += 1
        tk.Label(self, text="Показывать:", anchor="e").grid(row=r, column=0, sticky="e", **pad)
        chk = tk.Frame(self)
        chk.grid(row=r, column=1, sticky="w", **pad)
        self._show_article = tk.BooleanVar(value=self._s.get("show_article", True))
        self._show_model   = tk.BooleanVar(value=self._s.get("show_model",   True))
        tk.Checkbutton(chk, text="Артикул (верхний левый угол)",
                       variable=self._show_article).pack(anchor="w")
        tk.Checkbutton(chk, text="Модель (под названием)",
                       variable=self._show_model).pack(anchor="w")

        # ── QR size ───────────────────────────────────────────
        r += 1
        tk.Label(self, text="Размер QR-кода (мм):", anchor="e").grid(row=r, column=0, sticky="e", **pad)
        qr_frm = tk.Frame(self)
        qr_frm.grid(row=r, column=1, sticky="w", **pad)
        self._qr_size = tk.DoubleVar(value=self._s.get("qr_size_mm", 12.0))
        self._qr_label = tk.Label(qr_frm, text=f"{self._qr_size.get():.0f} мм", width=6)
        qr_slider = tk.Scale(qr_frm, variable=self._qr_size, from_=8, to=22,
                              resolution=1, orient="horizontal", length=180, showvalue=False,
                              command=lambda v: self._qr_label.config(text=f"{float(v):.0f} мм"))
        qr_slider.pack(side="left")
        self._qr_label.pack(side="left", padx=6)

        # ── Name font size ────────────────────────────────────
        r += 1
        tk.Label(self, text="Размер шрифта\nназвания (пт):", justify="right", anchor="e").grid(
            row=r, column=0, sticky="e", **pad)
        fs_frm = tk.Frame(self)
        fs_frm.grid(row=r, column=1, sticky="w", **pad)
        self._name_size = tk.DoubleVar(value=self._s.get("name_size", 8.0))
        self._fs_label  = tk.Label(fs_frm, text=f"{self._name_size.get():.1f} пт", width=7)
        fs_slider = tk.Scale(fs_frm, variable=self._name_size, from_=6, to=13,
                              resolution=0.5, orient="horizontal", length=180, showvalue=False,
                              command=lambda v: self._fs_label.config(text=f"{float(v):.1f} пт"))
        fs_slider.pack(side="left")
        self._fs_label.pack(side="left", padx=6)

        # ── Info ─────────────────────────────────────────────
        r += 1
        tk.Label(self, text="QR → https://dom-automation.ru\n60×40 мм · 18 шт./лист А4",
                 fg="#888", font=("Arial", 8)).grid(row=r, column=0, columnspan=2, pady=(4, 0))

        # ── Buttons ───────────────────────────────────────────
        r += 1
        btn_f = tk.Frame(self)
        btn_f.grid(row=r, column=0, columnspan=2, pady=14)
        tk.Button(btn_f, text="Сохранить", bg="#2E7D32", fg="white",
                  font=("Arial", 10, "bold"), padx=14, pady=4,
                  command=self._save).pack(side="left", padx=8)
        tk.Button(btn_f, text="Отмена", padx=14, pady=4,
                  command=self.destroy).pack(side="left", padx=8)

    def _save(self):
        self._s.update({
            "company_name":  self._company.get().strip() or "Умный Дом",
            "price_field":   self._price_field.get(),
            "article_field": self._article_field.get().strip() or "id",
            "show_article":  self._show_article.get(),
            "show_model":    self._show_model.get(),
            "qr_size_mm":    self._qr_size.get(),
            "name_size":     self._name_size.get(),
        })
        self.on_save(self._s)
        self.destroy()


# ─────────────────────────────────────────────────────────────
# MAIN WINDOW
# ─────────────────────────────────────────────────────────────

class MainFrame(tk.Frame):
    def __init__(self, parent, api: APIClient):
        super().__init__(parent)
        self.api      = api
        self.pdf_gen  = PDFGenerator()
        self._goods:  list = []
        self._selected: set = set()
        self._settings: dict = dict(DEFAULT_SETTINGS)

        self._build_ui()
        self._load_all()

    # ── UI ───────────────────────────────────────────────────

    def _build_ui(self):
        # Toolbar
        bar = tk.Frame(self, bd=1, relief="raised", pady=5, padx=8)
        bar.pack(fill="x")

        tk.Label(bar, text="Генератор ценников",
                 font=("Arial", 11, "bold"), fg="#0D47A1").pack(side="left")

        self._gen_btn = tk.Button(
            bar, text="  Создать PDF  ", command=self._generate,
            bg="#2E7D32", fg="white", font=("Arial", 10, "bold"),
            activebackground="#1B5E20", activeforeground="white", pady=3)
        self._gen_btn.pack(side="right", padx=6)

        tk.Button(bar, text="⚙ Настройка ценника", command=self._open_settings,
                  pady=3, padx=8).pack(side="right", padx=4)

        tk.Label(bar, text="60×40 мм · 18 шт./лист",
                 fg="#777").pack(side="right", padx=12)

        # Paned
        pw = ttk.PanedWindow(self, orient="horizontal")
        pw.pack(fill="both", expand=True, padx=4, pady=4)

        # Left – categories
        left = tk.LabelFrame(pw, text="Категории", padx=3, pady=3)
        pw.add(left, weight=1)

        self._cat_tree = ttk.Treeview(left, show="tree", selectmode="browse")
        sb = ttk.Scrollbar(left, orient="vertical", command=self._cat_tree.yview)
        self._cat_tree.configure(yscrollcommand=sb.set)
        self._cat_tree.pack(side="left", fill="both", expand=True)
        sb.pack(side="right", fill="y")
        self._cat_tree.bind("<<TreeviewSelect>>", lambda _: self._refresh_tree())

        tk.Button(left, text="Показать все",
                  command=self._reset_filter).pack(fill="x", pady=(4, 0))

        # Right – goods
        right = tk.Frame(pw)
        pw.add(right, weight=4)

        sf = tk.Frame(right)
        sf.pack(fill="x", pady=(0, 3))
        tk.Label(sf, text="Поиск:").pack(side="left")
        self._search = tk.StringVar()
        self._search.trace_add("write", lambda *_: self._refresh_tree())
        tk.Entry(sf, textvariable=self._search).pack(side="left", fill="x", expand=True, padx=4)

        bf = tk.Frame(right)
        bf.pack(fill="x", pady=(0, 2))
        tk.Button(bf, text="Выбрать все",  command=self._select_all).pack(side="left", padx=2)
        tk.Button(bf, text="Снять все",    command=self._deselect_all).pack(side="left", padx=2)
        self._counter = tk.Label(bf, text="Выбрано: 0",
                                  fg="#1565C0", font=("Arial", 9, "bold"))
        self._counter.pack(side="right", padx=8)

        cols = ("sel", "name", "model", "brand", "price")
        self._gtree = ttk.Treeview(right, columns=cols, show="headings", selectmode="browse")
        self._gtree.heading("sel",   text="✓",             anchor="center")
        self._gtree.heading("name",  text="Название")
        self._gtree.heading("model", text="Модель/Артикул")
        self._gtree.heading("brand", text="Бренд")
        self._gtree.heading("price", text="Цена продажи",  anchor="e")
        self._gtree.column("sel",   width=32,  minwidth=32,  anchor="center", stretch=False)
        self._gtree.column("name",  width=310, minwidth=160)
        self._gtree.column("model", width=140, minwidth=80)
        self._gtree.column("brand", width=120, minwidth=70)
        self._gtree.column("price", width=110, minwidth=80,  anchor="e", stretch=False)
        self._gtree.tag_configure("checked", background="#E3F2FD")

        gsb = ttk.Scrollbar(right, orient="vertical", command=self._gtree.yview)
        self._gtree.configure(yscrollcommand=gsb.set)
        self._gtree.pack(side="left", fill="both", expand=True)
        gsb.pack(side="right", fill="y")
        self._gtree.bind("<Button-1>", self._on_click)

        self._status = tk.StringVar(value="Загрузка…")
        tk.Label(self, textvariable=self._status, anchor="w",
                 relief="sunken", bd=1).pack(fill="x", side="bottom")

    # ── Data ─────────────────────────────────────────────────

    def _load_all(self):
        self._status.set("Загрузка категорий и товаров…")
        def run():
            cats  = self.api.get_categories()
            goods = self.api.get_goods()
            self.after(0, lambda: self._on_loaded(cats, goods))
        threading.Thread(target=run, daemon=True).start()

    def _on_loaded(self, cats, goods):
        self._goods = goods
        self._populate_cats(cats)
        self._refresh_tree()
        self._status.set(f"Загружено товаров: {len(goods)}")

    def _populate_cats(self, cats):
        self._cat_tree.delete(*self._cat_tree.get_children())
        inserted = set()

        def insert(cid, parent_node):
            if cid in inserted:
                return
            inserted.add(cid)
            cat = by_id.get(cid)
            if not cat:
                return
            self._cat_tree.insert(parent_node, "end", iid=cid, text=cat["name"])
            for ch in cats:
                if ch["parent"] == cid:
                    insert(ch["id"], cid)

        by_id = {c["id"]: c for c in cats}
        for c in cats:
            if c["parent"] == "0":
                insert(c["id"], "")

    # ── Goods list ───────────────────────────────────────────

    def _visible_cats(self):
        sel = self._cat_tree.selection()
        if not sel:
            return set()
        stack = list(sel)
        ids = set()
        while stack:
            cid = stack.pop()
            ids.add(cid)
            stack.extend(self._cat_tree.get_children(cid))
        return ids

    def _visible_goods(self):
        query    = self._search.get().lower()
        cat_ids  = self._visible_cats()
        result   = []
        for g in self._goods:
            if cat_ids and not any(str(c) in cat_ids for c in g.get("categories", [])):
                continue
            if query and query not in g.get("name", "").lower() \
                     and query not in (g.get("model") or "").lower():
                continue
            result.append(g)
        return result

    def _refresh_tree(self):
        self._gtree.delete(*self._gtree.get_children())
        field = self._settings["price_field"]
        for g in self._visible_goods():
            gid  = str(g["id"])
            chk  = "☑" if gid in self._selected else "☐"
            tags = ("checked",) if gid in self._selected else ()
            self._gtree.insert("", "end", iid=gid, tags=tags, values=(
                chk,
                g.get("name", ""),
                g.get("model") or "",
                g.get("manufacturer_name") or "",
                _fmt_price(g.get(field) or "0"),
            ))
        self._counter.config(text=f"Выбрано: {len(self._selected)}")

    def _on_click(self, event):
        item = self._gtree.identify_row(event.y)
        if not item:
            return
        if item in self._selected:
            self._selected.discard(item)
        else:
            self._selected.add(item)
        self._refresh_tree()

    def _reset_filter(self):
        self._cat_tree.selection_remove(*self._cat_tree.selection())
        self._refresh_tree()

    def _select_all(self):
        for item in self._gtree.get_children():
            self._selected.add(item)
        self._refresh_tree()

    def _deselect_all(self):
        self._selected.clear()
        self._refresh_tree()

    # ── Settings ─────────────────────────────────────────────

    def _open_settings(self):
        def on_save(new_settings):
            self._settings = new_settings
            self._refresh_tree()  # update price column if field changed
        SettingsDialog(self, self._settings, on_save)

    # ── PDF ──────────────────────────────────────────────────

    def _generate(self):
        if not self._selected:
            messagebox.showwarning("Нет товаров", "Выберите хотя бы один товар.")
            return

        path = filedialog.asksaveasfilename(
            defaultextension=".pdf",
            filetypes=[("PDF файлы", "*.pdf")],
            title="Сохранить ценники",
            initialfile="ценники.pdf",
        )
        if not path:
            return

        id_map = {str(g["id"]): g for g in self._goods}
        goods  = [id_map[gid] for gid in self._selected if gid in id_map]

        self._gen_btn.config(state="disabled", text="Создание…")
        self._status.set(f"Создание PDF для {len(goods)} товаров…")

        def run():
            try:
                self.pdf_gen.generate(goods, path, settings=self._settings)
                self.after(0, lambda: self._done(path))
            except Exception as e:
                self.after(0, lambda: self._error(str(e)))

        threading.Thread(target=run, daemon=True).start()

    def _done(self, path):
        self._gen_btn.config(state="normal", text="  Создать PDF  ")
        self._status.set(f"Готово: {path}")
        if messagebox.askyesno("Готово!", f"PDF сохранён:\n{path}\n\nОткрыть?"):
            os.startfile(path)

    def _error(self, err):
        self._gen_btn.config(state="normal", text="  Создать PDF  ")
        self._status.set(f"Ошибка: {err}")
        messagebox.showerror("Ошибка", err)


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────

def _fmt_price(value):
    try:
        return f"{int(float(value or 0)):,} ₽".replace(",", "\u202f")
    except Exception:
        return f"{value} ₽"


# ─────────────────────────────────────────────────────────────
# ROOT
# ─────────────────────────────────────────────────────────────

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Генератор ценников — dom-automation.ru")
        self.geometry("360x300")

        lf = LoginFrame(self, self._on_login)
        lf.pack(fill="both", expand=True)
        self._lf = lf

    def _on_login(self, api):
        self._lf.destroy()
        self.geometry("1150x680")
        self.minsize(800, 500)
        MainFrame(self, api).pack(fill="both", expand=True)


if __name__ == "__main__":
    App().mainloop()
