import os
import sys

if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
    STATIC_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    # Adjust for being inside backend/core
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(BASE_DIR)))
    STATIC_DIR = BASE_DIR

DESCARGA_DIR = os.path.join(BASE_DIR, "Descarga canciones")
ARCHIVO_ENTRADA = os.path.join(DESCARGA_DIR, "songs.json")
ARCHIVO_SALIDA = os.path.join(DESCARGA_DIR, "biblioteca_lista.json")
CARPETA_MUSICA = os.path.join(DESCARGA_DIR, "music")
PLAYLISTS_DIR = os.path.join(BASE_DIR, "playlists")
DRAWINGS_DIR = os.path.join(BASE_DIR, "drawings")
USAGE_FILE = os.path.join(BASE_DIR, "usage.json")
DEBUG_LOG = os.path.join(BASE_DIR, "debug.log")

PORT = 5888

# Ensure directories exist
os.makedirs(DESCARGA_DIR, exist_ok=True)
os.makedirs(CARPETA_MUSICA, exist_ok=True)
os.makedirs(PLAYLISTS_DIR, exist_ok=True)
