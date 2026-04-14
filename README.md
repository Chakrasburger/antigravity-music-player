# AntiGravity 🎵

A modern, local-first music player built with Python + Web Technologies.

## Features

- 🎵 Plays local MP3, FLAC, WAV, M4A, OGG files
- 🔊 10-band parametric EQ with presets (Bass Boost, Electronic, Vocal, etc.)
- 📃 Synced Lyrics (karaoke-style)
- 💿 Album / Artist browser
- 🎛️ Smart Playlists (Recently Added, Most Played)
- 📥 YouTube download integration (via yt-dlp)
- 🎨 Liquid Glass theme builder (blur, opacity, accent color)
- 📊 Listening analytics dashboard
- ✂️ Track trimmer

## Requirements

- Python 3.10+
- Dependencies: `pip install -r requirements.txt`

## Run Locally

```bash
py server.py
# Open http://localhost:5888
```

## Build Executable

```bash
py -m PyInstaller --clean AntiGravity_v2.spec
```

The `.exe` will be available in `dist/AntiGravity_v2.exe`.

## Tech Stack

| Layer | Tech |
|---|---|
| UI | React (via Babel CDN), Tailwind CSS |
| Backend | Python `http.server` |
| Desktop Shell | `pywebview` |
| Build | PyInstaller |
| Audio | Web Audio API + MediaElement |
| DB | Dexie.js (IndexedDB) |
| Metadata | Mutagen |
| Downloads | yt-dlp |
