# -*- mode: python ; coding: utf-8 -*-
import os

_fonts_dir = os.path.join(os.environ.get('WINDIR', r'C:\Windows'), 'Fonts')

a = Analysis(
    ['price_tag_app.py'],
    pathex=[],
    binaries=[],
    datas=[
        (os.path.join(_fonts_dir, 'arial.ttf'),   'fonts'),
        (os.path.join(_fonts_dir, 'arialbd.ttf'), 'fonts'),
    ],
    hiddenimports=[
        'PIL._tkinter_finder',
        'qrcode.image.pil',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='price_tags',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
