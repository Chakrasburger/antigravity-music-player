import os
import re
import time
import json
import subprocess
import requests
from .config import DEBUG_LOG

def log_error(msg):
    """Logs error to a local file for diagnostics."""
    try:
        with open(DEBUG_LOG, "a", encoding="utf-8") as f:
            f.write(f"[{time.ctime()}] {msg}\n")
    except:
        pass

def ffprobe_duration(file_path):
    """Uses ffprobe to extract duration for formats mutagen can't parse."""
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', file_path],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            dur = data.get('format', {}).get('duration')
            if dur: return float(dur)
            for stream in data.get('streams', []):
                dur = stream.get('duration')
                if dur: return float(dur)
    except Exception as e:
        print(f"ffprobe error for {os.path.basename(file_path)}: {e}")
    return 0

def limpiar_texto(texto):
    """Limpia caracteres especiales para nombres de archivos."""
    return re.sub(r'[\\/*?:"<>|]', "", texto)

def fetch_cover_image(data):
    """Helper: downloads or decodes cover image data."""
    cover_url = data.get('coverUrl') or data.get('ytThumbnail') or data.get('uploaderThumbnail')
    if not cover_url:
        return None, None
    try:
        img_data = None
        mime = "image/jpeg"
        if cover_url.startswith('data:image'):
            import base64
            header, encoded = cover_url.split(",", 1)
            mime = header.split(":")[1].split(";")[0]
            img_data = base64.b64decode(encoded)
        elif cover_url.startswith('http'):
            resp = requests.get(cover_url, timeout=5)
            if resp.status_code == 200:
                img_data = resp.content
                mime = resp.headers.get('Content-Type', 'image/jpeg')
        return img_data, mime
    except Exception as e:
        print(f"⚠️ Error fetching cover image: {e}")
        return None, None
