# -*- mode: python ; coding: utf-8 -*-


from PyInstaller.utils.hooks import collect_submodules
mutagen_hidden = collect_submodules('mutagen')

a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=[('index.html', '.'), ('server.py', '.'), ('remote.html', '.'), ('assets', 'assets')],
    hiddenimports=mutagen_hidden + ['yt_dlp', 'yt_dlp.extractor', 'syncedlyrics', 'PIL'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='ChakrasPlayer',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='app_icon.ico',
)
