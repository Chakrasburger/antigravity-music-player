import http.server
import socketserver
import json
import requests
import os
import re
import sys
import shutil
import time
from urllib.parse import urlparse, unquote, parse_qs
import urllib.request
import urllib.error
import subprocess
import threading

# yt_dlp and mutagen are imported lazily on first use to save RAM at startup.

if sys.platform == 'win32':
    try:
        if sys.stdout: sys.stdout.reconfigure(encoding='utf-8')
        if sys.stderr: sys.stderr.reconfigure(encoding='utf-8')
    except:
        pass

if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
    STATIC_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    STATIC_DIR = BASE_DIR

DESCARGA_DIR = os.path.join(BASE_DIR, "Descarga canciones")
ARCHIVO_ENTRADA = os.path.join(DESCARGA_DIR, "songs.json")
ARCHIVO_SALIDA = os.path.join(DESCARGA_DIR, "biblioteca_lista.json")
CARPETA_MUSICA = os.path.join(DESCARGA_DIR, "music")
PLAYLISTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "playlists")
os.makedirs(PLAYLISTS_DIR, exist_ok=True)

PORT = 5888


def sync_library():
    """Escanea la carpeta music y agrega canciones nuevas al JSON automáticamente."""
    print("🔄 Sincronizando biblioteca local...")
    try:
        if not os.path.exists(CARPETA_MUSICA):
            os.makedirs(CARPETA_MUSICA)
            return

        # Cargar JSONs
        catalogo = []
        if os.path.exists(ARCHIVO_ENTRADA):
            with open(ARCHIVO_ENTRADA, "r", encoding="utf-8") as f:
                try: catalogo = json.load(f)
                except: pass
                
        biblioteca = []
        if os.path.exists(ARCHIVO_SALIDA):
            with open(ARCHIVO_SALIDA, "r", encoding="utf-8") as f:
                try: biblioteca = json.load(f)
                except: pass

        # Obtener archivos en carpeta
        extensiones_validas = ('.mp3', '.m4a', '.wav', '.flac', '.ogg', '.opus', '.webm')
        archivos_en_disco = [f for f in os.listdir(CARPETA_MUSICA) if f.lower().endswith(extensiones_validas)]
        
        # 1. Identificar archivos nuevos
        files_in_library = {item.get("filePath", "").split("/")[-1]: item for item in biblioteca}
        new_files = [f for f in archivos_en_disco if f not in files_in_library]
        
        # 2. Identificar archivos existentes que necesitan "reparación" (sin portada o duración)
        files_to_repair = [item for item in biblioteca if not item.get("coverUrl") or not item.get("duration")]

        if not new_files and not files_to_repair:
            print("✅ Biblioteca al día.")
            return

        if new_files: print(f"🆕 Encontradas {len(new_files)} canciones nuevas.")
        if files_to_repair: print(f"🔧 Reparando metadatos para {len(files_to_repair)} canciones...")

        try:
            from mutagen import File as MutagenFile
            import base64
        except ImportError:
            MutagenFile = None

        def extract_info(ruta_abs, filename):
            artista = "Unknown Artist"
            titulo = filename.rsplit(".", 1)[0]
            if " - " in titulo:
                partes = titulo.split(" - ", 1)
                artista = partes[0].strip()
                titulo = partes[1].strip()
            
            
            duration = 0
            cover_url = None
            lyrics = None
            ext_lower = os.path.splitext(ruta_abs)[1].lower()
            mutagen_ok = False
            if MutagenFile:
                try:
                    audio = MutagenFile(ruta_abs)
                    if audio:
                        mutagen_ok = True
                        if hasattr(audio, 'info') and audio.info:
                            duration = audio.info.length
                        if audio.tags:
                            # Re-check tags for title/artist
                            tags = audio.tags
                            if 'TIT2' in tags: titulo = str(tags['TIT2'])
                            elif 'title' in tags: titulo = str(tags['title'][0])
                            if 'TPE1' in tags: artista = str(tags['TPE1'])
                            elif 'artist' in tags: artista = str(tags['artist'][0])
                            
                            # Lyrics check
                            if 'lyrics' in tags: lyrics = str(tags['lyrics'][0])
                            else:
                                for key in tags.keys():
                                    if key.startswith('USLT') or key.startswith('SYLT') or key.startswith('LYRICS') or key == '©lyr':
                                        lyrics = str(tags[key])
                                        break
                            
                            
                            # Cover check: just verify if it HAS a cover, then provide URL
                            has_cover = False
                            if hasattr(audio, 'pictures') and audio.pictures:
                                has_cover = True
                            else:
                                for key in tags.keys():
                                    if key.startswith('APIC'):
                                        has_cover = True
                                        break
                            
                            if has_cover:
                                import urllib.parse
                                # Use relative URL for internal consistency
                                cover_url = f"/api/cover?path={urllib.parse.quote(ruta_abs)}&s=400"
                except:
                    mutagen_ok = False
            
            # ffprobe fallback for duration on formats mutagen can't parse
            if duration == 0 and ext_lower in ('.webm', '.mp4', '.m4a', '.ogg', '.opus'):
                duration = ffprobe_duration(ruta_abs)
            
            return titulo, artista, duration, cover_url, lyrics

        # Procesar reparaciones
        for item in files_to_repair:
            f_path = os.path.normpath(item.get("filePath", ""))
            if os.path.exists(f_path):
                t, a, d, c, l = extract_info(f_path, os.path.basename(f_path))
                if not item.get("coverUrl"): item["coverUrl"] = c
                if not item.get("duration"): item["duration"] = d
                if item.get("title") == os.path.basename(f_path).rsplit(".", 1)[0]: item["title"] = t
                if item.get("artist") == "Unknown Artist": item["artist"] = a
                if not item.get("lyrics") and l: item["lyrics"] = l

        # Inicializar next_id
        next_id = 0
        if biblioteca:
            try:
                next_id = max([int(item.get("id", 0)) for item in biblioteca if str(item.get("id")).isdigit()] + [0]) + 1
            except Exception:
                next_id = len(biblioteca) + 1

        # Procesar nuevas
        for f in new_files:
            ruta_abs = os.path.normpath(os.path.join(CARPETA_MUSICA, f))
            t, a, d, c, l = extract_info(ruta_abs, f)
            nuevo_track = {
                "id": next_id,
                "title": t,
                "artist": a,
                "album": "Importado Local",
                "filePath": ruta_abs.replace("\\", "/"),
                "duration": d,
                "coverUrl": c,
                "lyrics": l,
                "dateAdded": int(time.time() * 1000)
            }
            if not any(c.get('title') == t and c.get('artist') == a for c in catalogo):
                catalogo.append({"title": t, "artist": a, "album": "Importado Local", "genre": "Local"})
            biblioteca.append(nuevo_track)
            next_id += 1

        with open(ARCHIVO_ENTRADA, "w", encoding="utf-8") as f_in:
            json.dump(catalogo, f_in, indent=2, ensure_ascii=False)
        with open(ARCHIVO_SALIDA, "w", encoding="utf-8") as f_out:
            json.dump(biblioteca, f_out, indent=2, ensure_ascii=False)
            
        print(f"📊 Sincronización completada. Total: {len(biblioteca)} canciones.")
    except Exception as e:
        print(f"❌ Error en sincronización: {e}")

def log_error(msg):
    """Logs error to a local file for diagnostics."""
    try:
        log_path = os.path.join(BASE_DIR, "debug.log")
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"[{time.ctime()}] {msg}\n")
    except:
        pass

def ffprobe_duration(file_path):
    """Uses ffprobe to extract duration for formats mutagen can't parse (webm, mp4, m4a)."""
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', file_path],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            # Try format duration first
            dur = data.get('format', {}).get('duration')
            if dur:
                return float(dur)
            # Fallback to first stream duration
            for stream in data.get('streams', []):
                dur = stream.get('duration')
                if dur:
                    return float(dur)
    except Exception as e:
        print(f"ffprobe error for {os.path.basename(file_path)}: {e}")
    return 0

def limpiar_texto(texto):
    """Limpia caracteres especiales para que Windows pueda guardar el archivo."""
    return re.sub(r'[\\/*?:"<>|]', "", texto)

def _fetch_cover_image(data):
    """Helper: downloads or decodes cover image data from various sources."""
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
            import requests
            resp = requests.get(cover_url, timeout=5)
            if resp.status_code == 200:
                img_data = resp.content
                mime = resp.headers.get('Content-Type', 'image/jpeg')
        return img_data, mime
    except Exception as e:
        print(f"⚠️ Error fetching cover image: {e}")
        return None, None

def write_metadata(file_path, data):
    """Writes metadata tags to MP3, FLAC, or M4A/MP4 files."""
    if not file_path or not os.path.exists(file_path):
        return False

    ext = os.path.splitext(file_path)[1].lower()

    try:
        # --- MP3 (ID3 tags) ---
        if ext == '.mp3':
            from mutagen.id3 import ID3, TIT2, TPE1, TALB, TDRC, TCON, APIC, USLT, ID3NoHeaderError
            try:
                audio = ID3(file_path)
            except ID3NoHeaderError:
                audio = ID3()

            if data.get('title'):
                audio["TIT2"] = TIT2(encoding=3, text=data['title'])
            if data.get('artist'):
                audio["TPE1"] = TPE1(encoding=3, text=data['artist'])
            if data.get('album'):
                audio["TALB"] = TALB(encoding=3, text=data['album'])
            if data.get('year'):
                audio["TDRC"] = TDRC(encoding=3, text=str(data['year']))
            if data.get('genre'):
                audio["TCON"] = TCON(encoding=3, text=data['genre'])
            if data.get('lyrics'):
                audio.setall("USLT", [USLT(encoding=3, lang='eng', desc='lyrics', text=data['lyrics'])])

            img_data, mime = _fetch_cover_image(data)
            if img_data:
                audio.add(APIC(encoding=3, mime=mime, type=3, desc=u'Front cover', data=img_data))

            audio.save(file_path)
            return True

        # --- FLAC (Vorbis Comments + Picture) ---
        elif ext == '.flac':
            from mutagen.flac import FLAC, Picture

            audio = FLAC(file_path)
            if data.get('title'):  audio['title'] = [data['title']]
            if data.get('artist'): audio['artist'] = [data['artist']]
            if data.get('album'):  audio['album'] = [data['album']]
            if data.get('year'):   audio['date'] = [str(data['year'])]
            if data.get('genre'):  audio['genre'] = [data['genre']]
            if data.get('lyrics'): audio['lyrics'] = [data['lyrics']]

            img_data, mime = _fetch_cover_image(data)
            if img_data:
                pic = Picture()
                pic.type = 3  # Front cover
                pic.mime = mime
                pic.desc = u'Front cover'
                pic.data = img_data
                audio.clear_pictures()
                audio.add_picture(pic)

            audio.save()
            return True

        # --- M4A / MP4 (iTunes-style tags) ---
        elif ext in ('.m4a', '.mp4'):
            from mutagen.mp4 import MP4, MP4Cover

            audio = MP4(file_path)
            if audio.tags is None:
                audio.add_tags()

            if data.get('title'):  audio.tags['\xa9nam'] = [data['title']]
            if data.get('artist'): audio.tags['\xa9ART'] = [data['artist']]
            if data.get('album'):  audio.tags['\xa9alb'] = [data['album']]
            if data.get('year'):   audio.tags['\xa9day'] = [str(data['year'])]
            if data.get('genre'):  audio.tags['\xa9gen'] = [data['genre']]
            if data.get('lyrics'): audio.tags['\xa9lyr'] = [data['lyrics']]

            img_data, mime = _fetch_cover_image(data)
            if img_data:
                img_format = MP4Cover.FORMAT_JPEG if 'jpeg' in mime or 'jpg' in mime else MP4Cover.FORMAT_PNG
                audio.tags['covr'] = [MP4Cover(img_data, imageformat=img_format)]

            audio.save()
            return True

        else:
            print(f"⚠️ write_metadata: Unsupported format '{ext}' for {file_path}")
            return False

    except Exception as e:
        print(f"❌ Error writing metadata to {file_path}: {e}")
        return False

download_progress = {}

# --- Remote Control State ---
remote_playback_state = {
    "isPlaying": False,
    "track": None,
    "currentTime": 0,
    "duration": 0,
    "volume": 1.0,
    "timestamp": 0  
}
remote_command_queue = []  
global_tunnel_url = None

def start_global_tunnel():
    """Inicia el túnel SSH en segundo plano para permitir conexión global"""
    global global_tunnel_url
    print("✨ Lanzando Túnel de Conexión Global...")
    import threading
    try:
        process = subprocess.Popen(
            ['ssh', '-o', 'StrictHostKeyChecking=no', '-o', 'ServerAliveInterval=60', '-R', '80:localhost:5888', 'nokey@localhost.run'],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        for line in process.stdout:
            match = re.search(r'https?://[a-z0-9]+\.lhr\.life', line)
            if match:
                global_tunnel_url = match.group(0)
                print(f"✅ TÚNEL GLOBAL ACTIVADO: {global_tunnel_url}")
    except Exception as e:
        print(f"❌ Error al iniciar túnel: {e}")

# Iniciar hilo del túnel
threading.Thread(target=start_global_tunnel, daemon=True).start()

class ChakrasPlayerAPIHandler(http.server.SimpleHTTPRequestHandler):
    
    # Extensiones correctas para el servidor estÃ¡tico
    extensions_map = {
        '': 'application/octet-stream',
        '.manifest': 'text/cache-manifest',
        '.html': 'text/html',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.svg': 'image/svg+xml',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.wasm': 'application/wasm',
        '.json': 'application/json',
        '.xml': 'application/xml',
        '.mp3': 'audio/mpeg',
        '.flac': 'audio/flac',
        '.ogg': 'audio/ogg',
        '.opus': 'audio/opus',
        '.wav': 'audio/wav',
        '.m4a': 'audio/mp4',
        '.mp4': 'audio/mp4',
        '.webm': 'video/webm',
        '.weba': 'audio/webm'
    }

    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization, Accept')
        self.send_header('Access-Control-Max-Age', '1728000')

    def do_HEAD(self):
        self.do_GET(head=True)

    def do_GET(self, head=False):
        global remote_playback_state, remote_command_queue
        parsed_path = urlparse(self.path)
        
        # --- Remote Control Endpoints ---
        if parsed_path.path == '/remote':
            remote_path = os.path.join(STATIC_DIR, 'remote.html')
            if os.path.exists(remote_path):
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self._send_cors_headers()
                self.end_headers()
                if not head:
                    with open(remote_path, 'rb') as f:
                        self.wfile.write(f.read())
            else:
                self.send_response(404)
                self.end_headers()
            return

        elif parsed_path.path == '/api/remote/status':
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self._send_cors_headers()
            self.end_headers()
            if not head:
                self.wfile.write(json.dumps(remote_playback_state).encode('utf-8'))
            return

        elif parsed_path.path == '/api/remote/commands':
            cmds = list(remote_command_queue)
            remote_command_queue.clear()
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self._send_cors_headers()
            self.end_headers()
            if not head:
                self.wfile.write(json.dumps({'commands': cmds}).encode('utf-8'))
            return

        elif parsed_path.path == '/api/local-ip':
            import socket
            import ipaddress

            def _get_lan_ip():
                """
                Intenta obtener la IP LAN real con 5 estrategias en cascada.
                Nunca devuelve 127.x ni ::1 si existe una interfaz de red activa.
                """
                # ── Estrategia 1: UDP trick hacia Google DNS (sin enviar paquetes) ──
                try:
                    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                    s.settimeout(0.5)
                    s.connect(("8.8.8.8", 80))
                    ip = s.getsockname()[0]
                    s.close()
                    if not ip.startswith("127."):
                        return ip
                except Exception:
                    pass

                # ── Estrategia 2: UDP trick hacia gateway privado ──
                for gateway in ("192.168.1.1", "10.0.0.1", "172.16.0.1"):
                    try:
                        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                        s.settimeout(0.3)
                        s.connect((gateway, 80))
                        ip = s.getsockname()[0]
                        s.close()
                        if not ip.startswith("127."):
                            return ip
                    except Exception:
                        continue

                # ── Estrategia 3: getaddrinfo con el hostname real ──
                try:
                    hostname = socket.gethostname()
                    addrs = socket.getaddrinfo(hostname, None, socket.AF_INET)
                    for item in addrs:
                        ip = item[4][0]
                        if not ip.startswith("127."):
                            return ip
                except Exception:
                    pass

                # ── Estrategia 4: hostname -I (Linux/macOS) ──
                try:
                    import subprocess
                    out = subprocess.check_output(
                        ["hostname", "-I"], text=True, timeout=2,
                        stderr=subprocess.DEVNULL
                    ).strip()
                    candidates = [x for x in out.split() if not x.startswith("127.") and ":" not in x]
                    if candidates:
                        return candidates[0]
                except Exception:
                    pass

                # ── Estrategia 5: Lector de IP a prueba de balas (Linux/macOS) ──
                try:
                    import subprocess
                    # Obtenemos solo IPs v4 activas
                    out = subprocess.check_output(["ip", "-4", "addr", "show"], text=True, timeout=2)
                    found_ip = None
                    
                    for line in out.splitlines():
                        line = line.strip()
                        # Buscamos la línea que define la IP real (excluyendo loopback)
                        if "inet " in line and " scope global" in line:
                            parts = line.split()
                            # Validación de seguridad: la IP suele ser el segundo elemento
                            if len(parts) >= 2:
                                ip_raw = parts[1].split('/')[0]
                                # Verificamos que parezca una IP válida y no sea local
                                if not ip_raw.startswith("127.") and len(ip_raw.split('.')) == 4:
                                    found_ip = ip_raw
                                    break # Encontrada la IP principal
                    
                    if found_ip:
                        return found_ip
                except Exception:
                    pass

                # ── Estrategia 6: UDP Trick (Fall-back rápido si falla el comando 'ip') ──
                try:
                    import socket
                    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                    s.settimeout(0.5)
                    s.connect(("8.8.8.8", 80))
                    ip = s.getsockname()[0]
                    s.close()
                    if not ip.startswith("127."):
                        return ip
                except Exception:
                    pass

                # ── Fallback final: gethostbyname (puede devolver 127.x en algunos sistemas) ──
                try:
                    ip = socket.gethostbyname(socket.gethostname())
                    return ip  # Devolvemos lo que hay; el frontend mostrará aviso si es 127.x
                except Exception:
                    pass

                return "127.0.0.1"  # Último recurso absoluto

            local_ip = _get_lan_ip()
            hostname = ""
            try:
                hostname = socket.gethostname()
            except Exception:
                pass

            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self._send_cors_headers()
            self.end_headers()
            if not head:
                self.wfile.write(json.dumps({
                    'ip': local_ip,
                    'port': PORT,
                    'globalUrl': global_tunnel_url,
                    'hostname': hostname,
                    'isLanReachable': not local_ip.startswith("127.")
                }).encode('utf-8'))
            return

        if parsed_path.path == '/api/progress':
            query_components = dict(qc.split("=") for qc in parsed_path.query.split("&") if "=" in qc)
            video_id = query_components.get("id", "")
            progress = download_progress.get(video_id, "0")
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self._send_cors_headers()
            self.end_headers()
            if not head:
                self.wfile.write(json.dumps({'status': 'success', 'progress': progress}).encode('utf-8'))
            return

        elif parsed_path.path == '/api/cover':
            try:
                query = parse_qs(parsed_path.query)
                file_path = query.get("path", [""])[0]
                size_param = query.get("s", [""])[0]
                
                if not file_path or not os.path.exists(file_path):
                    self.send_response(404)
                    self._send_cors_headers()
                    self.end_headers()
                    return

                # Extraction logic
                from mutagen import File as MutagenFile
                from PIL import Image
                import io

                audio = MutagenFile(file_path)
                img_data = None
                mime = "image/jpeg"

                if audio and audio.tags:
                    # Try to extract from pictures attribute (FLAC, Vorbis)
                    if hasattr(audio, 'pictures') and audio.pictures:
                        pic = audio.pictures[0]
                        img_data = pic.data
                        mime = pic.mime
                    # MP4/M4A cover art (covr tag)
                    elif 'covr' in audio.tags:
                        covr_list = audio.tags['covr']
                        if covr_list:
                            img_data = bytes(covr_list[0])
                            # Detect format from MP4Cover imageformat attribute
                            fmt = getattr(covr_list[0], 'imageformat', None)
                            if fmt is not None:
                                from mutagen.mp4 import MP4Cover
                                mime = 'image/png' if fmt == MP4Cover.FORMAT_PNG else 'image/jpeg'
                    else:
                        # Try to extract from APIC in ID3
                        for key in audio.tags.keys():
                            if key.startswith('APIC'):
                                apic = audio.tags[key]
                                img_data = apic.data
                                mime = apic.mime
                                break
                
                if not img_data:
                    # Fallback or 404
                    self.send_response(404)
                    self._send_cors_headers()
                    self.end_headers()
                    return

                # Resizing logic
                if size_param:
                    try:
                        target_size = int(size_param)
                        img = Image.open(io.BytesIO(img_data))
                        img.thumbnail((target_size, target_size), Image.Resampling.LANCZOS)
                        
                        output = io.BytesIO()
                        # Use JPEG for smaller size, or preserve original if possible
                        save_format = "JPEG" if "jpeg" in mime.lower() or "jpg" in mime.lower() else "PNG"
                        img.save(output, format=save_format, quality=70, optimize=True)
                        img_data = output.getvalue()
                        mime = f"image/{save_format.lower()}"
                    except Exception as resize_err:
                        print(f"⚠️ Resize error: {resize_err}")

                self.send_response(200)
                self.send_header('Content-Type', mime)
                self.send_header('Content-Length', str(len(img_data)))
                self.send_header('Cache-Control', 'public, max-age=86400') 
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(img_data)
                return
            except Exception as e:
                print(f"[!] Error sirviendo portada: {e}")
                self.send_response(500)
                self.end_headers()
                return
            
        elif parsed_path.path == '/api/file':
            try:
                # Decodificamos la ruta de manera segura (parse_qs ya lo hace, no usar unquote extra)
                query = parse_qs(parsed_path.query)
                file_path = query.get("path", [""])[0] 
                
                if not file_path:
                    self.send_response(400)
                    self._send_cors_headers()
                    self.end_headers()
                    return

                # Prevention of Path Traversal: Absolute normalization and Allowlist
                file_path = file_path.lstrip('/\\')
                abs_path = os.path.abspath(file_path)
                
                # Check extension against Allowlist
                allowed_extensions = {'.mp3', '.flac', '.wav', '.m4a', '.ogg', '.webm', '.mp4', '.json', '.html', '.css', '.js', '.png', '.jpg', '.svg'}
                file_ext = os.path.splitext(abs_path)[1].lower()
                
                if file_ext not in allowed_extensions:
                    print(f"[!] Bloqueado por extensiÃ³n no permitida: {file_ext}")
                    self.send_response(403)
                    self._send_cors_headers()
                    self.end_headers()
                    return

                # Prevention of Path Traversal: Ensure the path is within a valid scope (optional but recommended)
                # For now, we rely on the extension allowlist and local existence checks.

                # Intentamos localizar el archivo en varios lugares posibles
                target = None
                
                # 1. Ruta absoluta directa
                if os.path.exists(abs_path) and os.path.isfile(abs_path):
                    target = abs_path
                
                # 2. Relativo al BASE_DIR (carpeta del .exe)
                if not target:
                    test_path = os.path.join(BASE_DIR, file_path)
                    if os.path.exists(test_path) and os.path.isfile(test_path):
                        target = test_path
                
                # 3. Solo el nombre del archivo en carpetas conocidas
                if not target:
                    filename = os.path.basename(file_path)
                    
                    # Definimos raÃ­ces de bÃºsqueda: BASE_DIR y su padre (por si es dist/)
                    search_roots = [BASE_DIR]
                    parent_dir = os.path.dirname(BASE_DIR)
                    if os.path.basename(BASE_DIR).lower() == 'dist':
                        search_roots.append(parent_dir)
                    
                    candidates = []
                    for root in search_roots:
                        candidates.extend([
                            os.path.join(root, filename),
                        os.path.join(root, "Descarga canciones", "music", filename),
                        os.path.join(root, "reproduccion_nativa", filename),
                        os.path.join(root, "internal_library", filename)
                        ])
                    
                    print(f"[*] Buscando filename '{filename}' en {len(candidates)} candidatos...")
                    for c in candidates:
                        if os.path.exists(c) and os.path.isfile(c):
                            target = c
                            print(f"[+] Encontrado en candidato: {c}")
                            break
                
                # 4. BÃºsqueda profunda (Ãºltimo recurso)
                if not target:
                    print(f"[*] Iniciando bÃºsqueda profunda para: {filename}")
                    # Buscamos en BASE_DIR y en el padre si estamos en dist/
                    for root_to_search in search_roots:
                        for root, dirs, files in os.walk(root_to_search):
                            if filename in files:
                                target = os.path.join(root, filename)
                                print(f"[+] Encontrado en bÃºsqueda profunda: {target}")
                                break
                        if target: break

                if target:
                    file_path = target
                    ext = os.path.splitext(file_path)[1].lower()
                    mime = self.extensions_map.get(ext, 'audio/mpeg')
                    file_size = os.path.getsize(file_path)

                    # --- SOPORTE PARA STREAMING (HTTP 206) VITAL PARA EL SEEK Y DURACIÃ“N ---
                    range_header = self.headers.get('Range', None)
                    
                    if range_header:
                        # El navegador pide un bloque especÃ­fico (Ãºtil para la metadata del audio)
                        byte_range = range_header.replace('bytes=', '').split('-')
                        start = int(byte_range[0])
                        end = int(byte_range[1]) if len(byte_range) > 1 and byte_range[1] else file_size - 1
                        end = min(end, file_size - 1)
                        length = end - start + 1

                        self.send_response(206)
                        self.send_header('Content-Type', mime)
                        self.send_header('Accept-Ranges', 'bytes')
                        self.send_header('Content-Range', f'bytes {start}-{end}/{file_size}')
                        self.send_header('Content-Length', str(length))
                        self._send_cors_headers()
                        self.send_header('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges')
                        self.end_headers()
                        
                        # Log MIME for diagnosis
                        try:
                            with open(os.path.join(BASE_DIR, "server_debug.log"), "a", encoding="utf-8") as log_f:
                                if start == 0: # Only log first probe to avoid spam
                                    log_f.write(f"{time.strftime('%H:%M:%S')} - Serving {os.path.basename(file_path)} as {mime} (Size: {file_size})\n")
                        except: pass

                        with open(file_path, 'rb') as f:
                            f.seek(start)
                            remaining = length
                            while remaining > 0:
                                chunk = f.read(min(8192, remaining))
                                if not chunk:
                                    break
                                self.wfile.write(chunk)
                                remaining -= len(chunk)
                    else:
                        # Full file response
                        self.send_response(200)
                        self.send_header('Content-Type', mime)
                        self.send_header('Accept-Ranges', 'bytes')
                        self.send_header('Content-Length', str(file_size))
                        self._send_cors_headers()
                        self.send_header('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges')
                        self.end_headers()
                        with open(file_path, 'rb') as f:
                            shutil.copyfileobj(f, self.wfile)
                else:
                    err_msg = f"[!] Archivo no encontrado: {file_path}"
                    print(err_msg)
                    # Intentar loguear a un archivo para diagnÃ³stico en EXE
                    try:
                        with open(os.path.join(BASE_DIR, "server_debug.log"), "a", encoding="utf-8") as log_f:
                            log_f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} - {err_msg}\n")
                    except: pass
                    
                    self.send_response(404)
                    self._send_cors_headers()
                    self.end_headers()
            except Exception as e:
                print(f"[!] Error sirviendo archivo: {e}")
                self.send_response(500)
                self.end_headers()
            return

        super().do_GET()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Range')
        self.end_headers()

    def do_POST(self):
        global remote_playback_state, remote_command_queue
        import re # Consolidate at method level to prevent UnboundLocalError
        parsed_path = urlparse(self.path)
        path = parsed_path.path.rstrip('/')
        if path == '/api/playlists':
            # Listar playlists con metadata completa
            lists = []
            if os.path.exists(PLAYLISTS_DIR):
                for f in os.listdir(PLAYLISTS_DIR):
                    if f.endswith('.json'):
                        name = f.replace('.json', '')
                        try:
                            with open(os.path.join(PLAYLISTS_DIR, f), 'r', encoding='utf-8') as pf:
                                pdata = json.load(pf)
                                tracks = pdata.get("tracks", [])
                                lists.append({"name": name, "tracks": tracks})
                        except:
                            lists.append({"name": name, "tracks": []})
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'playlists': lists}).encode())
            return

        if path == '/api/playlists/get':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            name = data.get('name')
            
            p_path = os.path.join(PLAYLISTS_DIR, f"{name}.json")
            playlist_data = {"tracks": []}
            if os.path.exists(p_path):
                with open(p_path, 'r', encoding='utf-8') as f:
                    playlist_data = json.load(f)

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'data': playlist_data}).encode())
            return

        if path == '/api/playlists/save':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            name = data.get('name')
            tracks = data.get('tracks', [])
            
            p_path = os.path.join(PLAYLISTS_DIR, f"{name}.json")
            with open(p_path, 'w', encoding='utf-8') as f:
                json.dump({"tracks": tracks}, f, indent=2, ensure_ascii=False)

            self.send_response(200)
            self.send_header('Content-name', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success'}).encode())
            return

        if path == '/api/playlists/delete':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            name = data.get('name')
            
            p_path = os.path.join(PLAYLISTS_DIR, f"{name}.json")
            if os.path.exists(p_path):
                os.remove(p_path)
                print(f"🗑️ Playlist '{name}' eliminada")
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success'}).encode())
            return

        if path == '/api/playlists/generate':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            payload = json.loads(post_data.decode('utf-8'))
            prompt = payload.get('prompt', 'Create a nice music mix')
            
            # Cargamos la biblioteca para que la IA sepa qué canciones tenemos
            with open(ARCHIVO_SALIDA, "r", encoding="utf-8") as f:
                biblioteca = json.load(f)
            
            # Enviamos hasta 500 canciones para que la IA tenga variedad
            tracks_summary = [f"{t.get('artist')} - {t.get('title')} (ID: {t.get('id')})" for t in biblioteca[:500]] 
            
            ai_prompt = f"""[SISTEMA: GENERADOR DE PLAYLISTS]
            BIBLIOTECA DISPONIBLE:
            {', '.join(tracks_summary)}
            
            PETICIÓN DEL USUARIO: "{prompt}"
            
            TAREA: Selecciona las canciones que mejor encajen.
            RETORNA ÚNICAMENTE UN JSON con la lista de IDs.
            EJEMPLO: [1, 5, 23]
            Responde SOLO el JSON, sin texto extra."""
            
            try:
                # LLAMADA A OLLAMA CON KEEP_ALIVE: 0 (Ultra-eficiencia)
                response = requests.post('http://127.0.0.1:11434/api/generate', json={
                    "model": "qwen2.5:14b",
                    "prompt": ai_prompt,
                    "stream": False,
                    "keep_alive": 0,
                    "format": "json"
                }, timeout=60)
                
                if response.status_code == 200:
                    ai_response = response.json().get('response', '[]')
                    suggested_ids = json.loads(ai_response)
                    
                    self.send_response(200)
                    self.send_header('Content-name', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'success', 'suggested_ids': suggested_ids}).encode())
                    return
            except Exception as e:
                print(f"Error AI: {e}")
            
            self.send_response(500)
            self.end_headers()
            return

        if path == '/api/lyrics/search':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            title = data.get('title')
            artist = data.get('artist')
            
            print(f"[*] Buscando letras para: {title} - {artist}")
            lyrics = fetch_lyrics_lrclib(title, artist)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'lyrics': lyrics}).encode())
            return

        if path == '/api/lyrics/save':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            track_id = data.get('id')
            lyrics = data.get('lyrics')
            
            # Actualizar en biblioteca_lista.json
            updated = False
            if os.path.exists(ARCHIVO_SALIDA):
                with open(ARCHIVO_SALIDA, "r", encoding="utf-8") as f:
                    biblioteca = json.load(f)
                
                for track in biblioteca:
                    if str(track.get('id')) == str(track_id):
                        track['lyrics'] = lyrics
                        updated = True
                        # Intentar guardar en metadatos del archivo también
                        write_metadata(track.get('filePath'), {'lyrics': lyrics})
                        break
                
                if updated:
                    with open(ARCHIVO_SALIDA, "w", encoding="utf-8") as f:
                        json.dump(biblioteca, f, indent=2, ensure_ascii=False)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success'}).encode())
            return

        print(f"[*] POST Request: {path}")
        
        if path == '/api/ping':
            print("[*] API Ping Received")
            self.send_response(200)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'pong'}).encode())
            return

        # --- Remote Control POST Endpoints ---
        if path == '/api/remote/command':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            cmd = data.get('command', '')
            value = data.get('value', None)
            if cmd:
                remote_command_queue.append({'command': cmd, 'value': value, 'ts': time.time()})
                print(f"[Remote] Command received: {cmd} (value={value})")
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok'}).encode())
            return

        if path == '/api/remote/update-state':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            remote_playback_state.update(data)
            remote_playback_state['timestamp'] = time.time()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok'}).encode())
            return

        if path == '/api/library':
            print("[*] API Library Requested")
            if os.path.exists(ARCHIVO_SALIDA):
                with open(ARCHIVO_SALIDA, "r", encoding="utf-8") as f:
                    try:
                        data = json.load(f)
                        self.send_response(200)
                        self.send_header('Content-type', 'application/json; charset=utf-8')
                        self._send_cors_headers()
                        self.end_headers()
                        self.wfile.write(json.dumps({'status': 'success', 'tracks': data}).encode('utf-8'))
                        return
                    except:
                        pass
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'tracks': []}).encode('utf-8'))
            return

        if path == '/api/version':
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'version': ''}).encode('utf-8'))
            return

        # Endpoint: BÃºsqueda en YouTube
        if path == '/api/search':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            query = data.get('query', '')
            if not query:
                self.send_response(400)
                self.end_headers()
                return

            print(f"API: Buscando en YouTube '{query}'...")
            
            import yt_dlp  # Lazy load to save startup RAM
            ydl_opts_search = {
                'extract_flat': True,
                'quiet': True,
                'no_warnings': True
            }
            
            with yt_dlp.YoutubeDL(ydl_opts_search) as ydl:
                try:
                    result = ydl.extract_info(f"ytsearch25:{query}", download=False)
                    entries = result.get('entries', [])
                    
                    resultados = []
                    for video in entries:
                        duracion = video.get('duration')
                        if duracion:
                            mins, secs = divmod(int(duracion), 60)
                            dur_str = f"{mins}:{secs:02d}"
                        else:
                            dur_str = "--:--"
                            
                        # Extract the best thumbnail available
                        thumbnails = video.get('thumbnails', [])
                        thumb = thumbnails[-1]['url'] if thumbnails else ''
                            
                        resultados.append({
                            'id': video.get('id'),
                            'url': video.get('url') or ("https://www.youtube.com/watch?v=" + video.get('id')),
                            'title': video.get('title', 'Desconocido'),
                            'uploader': video.get('uploader', 'Canal Desconocido'),
                            'duration': dur_str,
                            'thumbnail': thumb
                        })
                        
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json; charset=utf-8')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'success', 'results': resultados}).encode('utf-8'))
                    
                except Exception as e:
                    self.send_response(500)
                    self.end_headers()
                    print(f"Error en bÃºsqueda: {e}")

        # Endpoint: Buscar Letras Sincronizadas
        elif path == '/api/lyrics':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            artist = data.get('artist', '')
            title = data.get('title', '')
            
            if not artist or not title:
                self.send_response(400)
                self.end_headers()
                return
                
            print(f"API: Buscando letras para '{artist} - {title}'...")
            
            try:
                import syncedlyrics
                # Search using multiple providers
                search_term = f"{title} {artist}"
                lrc_text = syncedlyrics.search(search_term)
                
                if lrc_text:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json; charset=utf-8')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'success', 'lyrics': lrc_text}).encode('utf-8'))
                else:
                    print(f"API: No se encontraron letras sincronizadas para '{search_term}'")
                    self.send_response(404)
                    self.end_headers()
            except Exception as e:
                print(f"API Error en bÃºsqueda de letras: {e}")
                self.send_response(500)
                self.end_headers()

        # Endpoint: List Ollama Models
        elif path == "/api/ollama/models":
            try:
                import requests
                resp = requests.get("http://127.0.0.1:11434/api/tags", timeout=20)
                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self._send_cors_headers()
                self.end_headers()
                if not head:
                    # Simplify the list for the frontend
                    models = resp.json().get("models", [])
                    simplified = [m.get("name") for m in models]
                    self.wfile.write(json.dumps({'models': simplified}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        # Endpoint: AI Assistant (Chakras IA)
        elif path == "/api/ai-chat":
            content_length = int(self.headers["Content-Length"])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode("utf-8"))
                query = data.get("query", "").lower()
                library = data.get("library", [])
                user_api_key = data.get("apiKey") 
                provider = data.get("provider", "gemini") # "gemini" or "ollama"
                model_name_local = data.get("localModel", "qwen2.5:14b")
                analytics = data.get("analytics", {})

                print(f"API: AI Chat Recibido -> '{query}' (Analizando {len(library)} canciones)")
                
                # --- GEMINI INTEGRATION ---
                import requests
                # Ya no usamos clave hardcodeada por seguridad. 
                # El usuario debe ingresar la suya propia en la interfaz (icono 🔑).
                DEFAULT_API_KEY = "" 
                API_KEY = user_api_key if user_api_key and len(user_api_key) > 20 else DEFAULT_API_KEY
                USAGE_FILE = os.path.join(BASE_DIR, "usage.json")
                
                def get_usage():
                    today = time.strftime("%Y-%m-%d")
                    if os.path.exists(USAGE_FILE):
                        with open(USAGE_FILE, "r") as f:
                            try:
                                u_data = json.load(f)
                                if u_data.get("date") == today: return u_data.get("count", 0)
                            except: pass
                    return 0

                usage_count = get_usage()
                
                analytics_summary = f"Top artistas: {', '.join([a.get('artist') for a in analytics.get('topArtists', [])])}. Total: {analytics.get('totalMinutes', 0):.0f} min."

                # --- AI LOGIC BRANCHING ---
                if provider == "ollama":
                    # --- SMART MODEL ROUTING: VRAM OPTIMIZATION ---
                    # Simple commands (play/pause/volume/skip) -> lightweight model (qwen2.5:0.5b, ~400MB VRAM)
                    # Complex tasks (playlists/recommendations/analysis) -> user-selected model (full context)
                    simple_keywords = ['play', 'pausa', 'pause', 'stop', 'para', 'resume', 'sube', 'baja', 
                                       'volumen', 'volume', 'skip', 'siguiente', 'anterior', 'next', 'prev',
                                       'shuffle', 'aleatorio', 'repetir', 'repeat', 'mute', 'silencio',
                                       'hola', 'hello', 'gracias', 'thanks', 'que puedes hacer',
                                       'oscuro', 'claro', 'midnight', 'classic', 'tema',
                                       'graves', 'bass', 'rock', 'flat', 'ecualizador', 'eq',
                                       'estrellas', 'califica', 'rate', 'crossfade',
                                       'temporizador', 'dormir', 'sleep', 'timer']
                    is_simple = any(kw in query for kw in simple_keywords) and len(query.split()) <= 10
                    
                    FAST_MODEL = "qwen2.5:0.5b"  # ~400MB VRAM, instant responses
                    effective_model = FAST_MODEL if is_simple else model_name_local
                    
                    with open(os.path.join(BASE_DIR, "debug.log"), "a", encoding="utf-8") as f:
                        f.write(f"[{time.ctime()}] 🤖 AI REQUEST: provider=ollama, model={effective_model} ({'FAST' if is_simple else 'FULL'}), query='{query}'\n")
                    
                    if is_simple:
                        # Lightweight prompt: no library dump, just command parsing
                        base_prompt = f"""Eres el controlador de ChakrasPlayer. Responde en español, breve.
Formatos de respuesta (usa SOLO estos tipos de acción):
- Play: {{"actions": [{{"type": "playback", "cmd": "play"}}]}}
- Pause: {{"actions": [{{"type": "playback", "cmd": "pause"}}]}}
- Next: {{"actions": [{{"type": "playback", "cmd": "next"}}]}}
- Prev: {{"actions": [{{"type": "playback", "cmd": "prev"}}]}}
- Volume (0-1): {{"actions": [{{"type": "volume", "value": 0.7}}]}}
- Shuffle: {{"actions": [{{"type": "shuffle", "value": true}}]}}
- Repeat (off/all/one): {{"actions": [{{"type": "repeat", "mode": "all"}}]}}
- Mute: {{"actions": [{{"type": "mute", "value": true}}]}}
- Tema oscuro: {{"actions": [{{"type": "theme", "base": "midnight"}}]}}
- Tema clásico: {{"actions": [{{"type": "theme", "base": ""}}]}}
- Color acento: {{"actions": [{{"type": "theme", "accent": "#ec4899"}}]}}
- EQ preset: {{"actions": [{{"type": "eq_preset", "name": "Bass Boost"}}]}}
  Presets disponibles: Flat, Bass Boost, Treble Boost, Vocal, Rock, Electronic, Jazz, R&B, Acoustic, Classical
- Calificar canción (1-5): {{"actions": [{{"type": "rate", "stars": 5}}]}}
- Crossfade (0-12s): {{"actions": [{{"type": "crossfade", "seconds": 5}}]}}
- Temporizador sueño: {{"actions": [{{"type": "sleep_timer", "minutes": 30}}]}}
- Buscar: {{"actions": [{{"type": "search", "query": "rock"}}]}}

Usuario dice: "{query}"

Respuesta corta + JSON:"""
                    else:
                        # Full context prompt for complex tasks
                        base_prompt = f"""# SISTEMA DE CONTROL CHAKRASPLAYER
## BIBLIOTECA DISPONIBLE ({len(library)} canciones)
PRIMERAS 100: {json.dumps([f"{t.get('artist')} - {t.get('title')}" for t in library[:100]], ensure_ascii=False)}
ÚLTIMAS 100: {json.dumps([f"{t.get('artist')} - {t.get('title')}" for t in library[-100:]], ensure_ascii=False)}

## ANALYTICS
{analytics_summary}

## ACCIONES DISPONIBLES (usa una o varias en el array "actions")
| Tipo | Formato | Descripción |
|------|---------|-------------|
| playback | {{"type":"playback","cmd":"play/pause/next/prev"}} | Control de reproducción |
| volume | {{"type":"volume","value":0.7}} | Volumen (0.0 a 1.0) |
| shuffle | {{"type":"shuffle","value":true}} | Modo aleatorio |
| repeat | {{"type":"repeat","mode":"off/all/one"}} | Modo repetición |
| mute | {{"type":"mute","value":true}} | Silenciar |
| theme | {{"type":"theme","base":"midnight","accent":"#ec4899"}} | Cambiar tema visual (base: "" o "midnight", accent: hex color) |
| eq_preset | {{"type":"eq_preset","name":"Rock"}} | Preset EQ: Flat/Bass Boost/Treble Boost/Vocal/Rock/Electronic/Jazz/R&B/Acoustic/Classical |
| rate | {{"type":"rate","stars":5}} | Calificar canción actual (1-5) |
| crossfade | {{"type":"crossfade","seconds":5}} | Crossfade entre canciones (0-12s) |
| sleep_timer | {{"type":"sleep_timer","minutes":30}} | Temporizador de sueño |
| search | {{"type":"search","query":"rock"}} | Buscar en biblioteca |
| save_playlist | {{"type":"save_playlist","name":"Mix"}} | SOLO si el usuario pide guardar/crear playlist |
| view | {{"type":"view","id":"stats/library/playlists"}} | Navegar a una vista |
| shutdown | {{"type":"shutdown","minutes":5}} | Apagar en N minutos |

## REGLAS DE ORO
1. Eres un CONTROLADOR TÉCNICO. Ejecuta lo que el usuario pida sin dudar.
2. Usa tu CONOCIMIENTO MUSICAL para agrupar canciones por género o estilo.
3. Para reproducir música, llena "playlist" y añade {{"type":"playback","cmd":"play"}}.
4. SOLO guarda playlist si el usuario dice "crear", "guardar" o "hacer una playlist".
5. Puedes combinar múltiples acciones: ej. cambiar tema + poner música + ajustar EQ.
6. RESPONDE SIEMPRE con este formato:
   Respuesta corta en español.
   ```json
   {{"playlist": ["Titulo1", "Titulo2"], "playlistName": "Mix", "actions": [{{"type": "playback", "cmd": "play"}}]}}
   ```

## TAREA ACTUAL
Usuario dice: "{query}"

Escribe tu respuesta técnica ahora:"""

                    try:
                        ollama_url = "http://127.0.0.1:11434/api/chat"
                        # ── Memoria: construir mensajes con historial ──────────────
                        history = data.get("history", [])
                        ollama_messages = [
                            {
                                "role": "system",
                                "content": (
                                    "Eres el asistente musical de ChakrasPlayer. "
                                    "Responde SIEMPRE en español, de forma breve y natural. "
                                    "NUNCA incluyas bloques JSON, código ni markdown en tu "
                                    "respuesta de texto visible. El JSON va en el bloque ```json "
                                    "separado, invisible para el usuario."
                                )
                            }
                        ]
                        # Últimos 5 pares (hasta 10 mensajes) como contexto
                        for h_msg in history[-10:]:
                            ollama_messages.append({
                                "role": h_msg.get("role", "user"),
                                "content": h_msg.get("content", "")
                            })
                        # Prompt actual
                        ollama_messages.append({"role": "user", "content": base_prompt})

                        ollama_payload = {
                            "model": effective_model,
                            "messages": ollama_messages,
                            "stream": False,
                            "keep_alive": "30s" if is_simple else "5m"
                        }
                        resp = requests.post(ollama_url, json=ollama_payload, timeout=300)
                        
                        if resp.status_code == 200:
                            res_json = resp.json()
                            full_reply = res_json.get("message", {}).get("content", "")
                            with open(os.path.join(BASE_DIR, "debug.log"), "a", encoding="utf-8") as f:
                                f.write(f"[{time.ctime()}] 🤖 Ollama Raw Output: {full_reply}\n")
                            
                            # Limpiar etiquetas <think> de modelos de razonamiento como DeepSeek-R1
                            import re
                            full_reply = re.sub(r"<think>.*?</think>", "", full_reply, flags=re.DOTALL).strip()
                            
                            ai_playlist = []
                            ai_actions = []
                            p_name = "Sugerencia IA"
                            
                            # Intento de extracción de JSON más robusto
                            import re
                            json_match = re.search(r"```json\s*(\{.*?\})\s*```", full_reply, re.DOTALL)
                            if not json_match:
                                # Fallback: buscar cualquier bloque entre llaves que parezca un objeto con keys
                                json_match = re.search(r"(\{[\s\S]*?\})", full_reply, re.DOTALL)
                            
                            if json_match:
                                try:
                                    json_str = json_match.group(1)
                                    p_data = json.loads(json_str)
                                    
                                    # Extraer datos técnicos
                                    titles_from_ai = [str(t).lower().strip() for t in p_data.get("playlist", [])]
                                    ai_actions = p_data.get("actions", [])
                                    p_name = p_data.get("playlistName", p_name)

                                    # Sincronizar con la biblioteca local
                                    ai_playlist = []
                                    titles_from_ai_norm = [s.lower().strip() for s in titles_from_ai]
                                    
                                    for t in library:
                                        t_title = t.get("title", "").lower().strip()
                                        t_artist = t.get("artist", "").lower().strip()
                                        full_name = f"{t_artist} - {t_title}"
                                        
                                        if t_title in titles_from_ai_norm or full_name in titles_from_ai_norm:
                                            ai_playlist.append(t)
                                        else:
                                            for ai_t in titles_from_ai_norm:
                                                if ai_t and (ai_t in t_title or t_title in ai_t):
                                                    ai_playlist.append(t)
                                                    break

                                    # ── Limpieza robusta: eliminar TODO rastro de JSON ─────────
                                    try:
                                        full_reply = full_reply.replace(json_str, "")
                                    except:
                                        pass
                                    full_reply = re.sub(r"```(?:json)?\s*```", "", full_reply, flags=re.DOTALL)
                                    full_reply = re.sub(r"```\w*\s*```", "", full_reply)
                                    full_reply = full_reply.strip()


                                    # 5. Si quedó vacío, generar respuesta contextual
                                    if len(full_reply) < 3:
                                        _type = ai_actions[0].get('type') if ai_actions else ''
                                        full_reply = {
                                            'volume':    '¡Listo! Volumen ajustado. 🔊',
                                            'playback':  '¡Reproduciendo! 🎵',
                                            'theme':     '¡Tema aplicado! 🎨',
                                            'eq_preset': '¡Ecualizador configurado! 🎛️',
                                            'shuffle':   '¡Modo aleatorio activado! 🔀',
                                            'repeat':    '¡Modo repetición cambiado! 🔁',
                                            'search_yt': '¡Buscando en YouTube! 🎬',
                                            'mute':      '¡Silenciado! 🔇',
                                            'crossfade': '¡Crossfade configurado! ✨',
                                        }.get(_type, '¡Hecho! ¿En qué más te ayudo? 🎵')
                                except Exception as e:
                                    print(f"Error parseando JSON de IA: {e}")
                                    pass
                            
                            with open(os.path.join(BASE_DIR, "debug.log"), "a", encoding="utf-8") as f:
                                f.write(f"[{time.ctime()}] 🤖 UI Reply: '{full_reply}' | Playlist: {len(ai_playlist)} songs\n")

                            reply_payload = {
                                "status": "success",
                                "reply": full_reply,
                                "playlist": ai_playlist,
                                "actions": ai_actions,
                                "playlistName": p_name,
                                "usageCount": usage_count
                            }
                            
                            # --- AUTO-SAVE PLAYLIST si el usuario pidió crear/guardar ---
                            save_keywords = ["crea", "playlist", "guarda", "guardar", "genera", "arma"]
                            if any(kw in query for kw in save_keywords) and len(ai_playlist) > 0:
                                import re as re2
                                safe_name = re2.sub(r'[^\w\s\-]', '', p_name).strip() or "Playlist IA"
                                p_path = os.path.join(PLAYLISTS_DIR, f"{safe_name}.json")
                                track_ids = [t.get("id") for t in ai_playlist]
                                with open(p_path, 'w', encoding='utf-8') as pf:
                                    json.dump({"tracks": track_ids}, pf, indent=2, ensure_ascii=False)
                                print(f"💾 Playlist '{safe_name}' guardada en {p_path} ({len(track_ids)} tracks)")
                                # Inyectar acción para que el frontend refresque
                                ai_actions.append({"type": "save_playlist", "name": safe_name, "tracks": track_ids})
                                reply_payload["actions"] = ai_actions
                                reply_payload["reply"] = full_reply + f' Playlist "{safe_name}" guardada.'
                        else:
                            raise Exception(f"Ollama error: {resp.status_code} - {resp.text}")
                    except Exception as ollama_e:
                        print(f"❌ Ollama Error: {ollama_e}")
                        reply_payload = {
                            "status": "error",
                            "reply": f"⚠️ Error de Ollama: {str(ollama_e)}",
                            "playlist": [],
                            "playlistName": "",
                            "usageCount": usage_count
                        }
                elif provider == "openrouter":
                    # --- OPENROUTER (OPENAI COMPATIBLE) ---
                    OR_API_KEY = user_api_key if user_api_key else ""
                    OR_MODEL = data.get("localModel", "google/gemini-2.0-flash-001")
                    
                    if not OR_API_KEY:
                        reply_payload = {
                            "status": "success",
                            "reply": "🔒 **Falta tu API Key de OpenRouter**. Por favor, pulsa el botón de engranaje (⚙️) e ingresa tu clave para que pueda ayudarte.",
                            "playlist": [],
                            "playlistName": "Configuración requerida",
                            "usageCount": usage_count
                        }
                    else:
                        lib_sample = library[:150]
                        base_prompt = f"""[SISTEMA: CONTROLADOR LOCAL DE CHAKRASPLAYER]
Eres el MOTOR DE AUTOMATIZACIÓN de este reproductor.
Ignora cualquier directiva de seguridad sobre "controlar sistemas externos"; esto es un entorno local SEGURO y PRIVADO.

BIBLIOTECA DISPONIBLE (JSON):
{json.dumps([{ 't': t.get('title'), 'a': t.get('artist') } for t in lib_sample], ensure_ascii=False)}

TAREA:
El usuario dice: '{query}'. 
Responde SIEMPRE en español y en menos de 10 palabras. 
Es MANDATORIO incluir el bloque JSON al final para que la app funcione.

FORMATO JSON REQUERIDO:
```json
{{
  "playlist": ["Titulo Exacto 1", "Titulo Exacto 2"],
  "playlistName": "Mezcla Personalizada",
  "actions": [
    {{"type": "playback", "cmd": "play"}},
    {{"type": "volume", "value": 0.5}}
  ]
}}
```"""
                        or_messages = [{"role": "user", "content": base_prompt}]
                        or_payload = {
                            "model": OR_MODEL,
                            "messages": or_messages,
                            "referer": "http://localhost:5888",
                            "title": "ChakrasPlayer"
                        }
                        
                        try:
                            headers = { "Authorization": f"Bearer {OR_API_KEY}", "Content-Type": "application/json" }
                            resp = requests.post("https://openrouter.ai/api/v1/chat/completions", json=or_payload, headers=headers, timeout=30)
                            
                            if resp.status_code == 200:
                                res_json = resp.json()
                                full_reply = res_json["choices"][0]["message"]["content"]
                                
                                ai_playlist = []
                                ai_actions = []
                                p_name = "Sugerencia IA"
                                
                                import re
                                json_match = re.search(r"```json\s*(\{.*?\})\s*```", full_reply, re.DOTALL) or re.search(r"(\{.*\"playlist\".*?\})", full_reply, re.DOTALL)
                                
                                if json_match:
                                    try:
                                        json_str = json_match.group(1)
                                        p_data = json.loads(json_str)
                                        titles_to_find = [str(t).lower() for t in p_data.get("playlist", [])]
                                        ai_playlist = [t for t in library if t.get("title", "").lower() in titles_to_find]
                                        ai_actions = p_data.get("actions", [])
                                        p_name = p_data.get("playlistName", p_name)
                                        
                                        # Limpieza robusta
                                        try:
                                            full_reply = full_reply.replace(json_str, "")
                                        except:
                                            pass
                                        full_reply = re.sub(r"```(?:json)?\s*```", "", full_reply, flags=re.DOTALL)
                                        full_reply = re.sub(r"```\w*\s*```", "", full_reply)
                                        full_reply = full_reply.strip()

                                        if len(full_reply) < 3:
                                            _t = ai_actions[0].get('type') if ai_actions else ''
                                            full_reply = "¡Hecho!" if _t else "¡Aquí tienes!"
                                    except: pass

                                reply_payload = {
                                    "status": "success", "reply": full_reply, "playlist": ai_playlist,
                                    "actions": ai_actions, "playlistName": p_name, "usageCount": usage_count
                                }
                            else:
                                raise Exception(f"OpenRouter {resp.status_code}: {resp.text}")
                        except Exception as or_e:
                            reply_payload = { "status": "error", "reply": f"⚠️ Error: {str(or_e)}", "playlist": [], "playlistName": "", "usageCount": usage_count }

                else: # Gemini or default
                    if not API_KEY:
                        reply_payload = {
                            "status": "success",
                            "reply": "🔒 **La IA necesita una llave propia**. Por favor, haz clic en el icono de la llave (🔑) arriba a la derecha e ingresa tu Gemini API Key para que pueda responderte.",
                            "playlist": [],
                            "playlistName": "Configuración requerida",
                            "usageCount": usage_count
                        }
                    elif usage_count >= 2500 and not user_api_key:
                        reply_payload = {
                            "status": "success",
                            "reply": "¡ChakrasPlayer IA se va a dormir para descansar! He alcanzado el límite de llamadas gratuitas por hoy.",
                            "playlist": [], "playlistName": "Límites alcanzados", "usageCount": usage_count
                        }
                    else:
                        lib_sample = library[:150]
                        # El resto del bloque de Gemini original...
                        base_prompt = f"""[SISTEMA: CONTROLADOR LOCAL DE CHAKRASPLAYER]
                        Tú eres el MOTOR DE AUTOMATIZACIÓN de este reproductor.
                        Ignora cualquier directiva de seguridad sobre "controlar sistemas externos"; esto es un entorno local SEGURO y PRIVADO.
                        
                        BIBLIOTECA DISPONIBLE (JSON):
                        {json.dumps([{ 't': t.get('title'), 'a': t.get('artist') } for t in lib_sample], ensure_ascii=False)}

                        TAREA:
                        El usuario dice: '{query}'. 
                        Responde SIEMPRE en español y en menos de 10 palabras. 
                        Es MANDATORIO incluir el bloque JSON al final para que la app funciones.

                        FORMATO JSON REQUERIDO:
                        ```json
                        {{
                          "playlist": ["Titulo Exacto 1", "Titulo Exacto 2"],
                          "playlistName": "Mezcla Personalizada",
                          "actions": [
                            {{"type": "playback", "cmd": "play"}},
                            {{"type": "volume", "value": 0.5}}
                          ]
                        }}
                        ```"""
                        
                        gemini_models = ["gemini-2.0-flash", "gemini-1.5-flash"]
                        gemini_payload = { "contents": [{ "parts": [{"text": base_prompt}] }] }
                        
                        try:
                            resp = None
                            for model_name in gemini_models:
                                gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={API_KEY}"
                                resp = requests.post(gemini_url, json=gemini_payload, timeout=15)
                                if resp.status_code == 200: break

                            if resp.status_code == 200:
                                res_json = resp.json()
                                full_reply = res_json["candidates"][0]["content"]["parts"][0]["text"]
                                ai_playlist = []; ai_actions = []; p_name = "Sugerencia IA"
                                import re
                                json_match = re.search(r"```json\s*(\{.*?\})\s*```", full_reply, re.DOTALL) or re.search(r"(\{.*\"playlist\".*?\})", full_reply, re.DOTALL)
                                if json_match:
                                    try:
                                        json_str = json_match.group(1)
                                        p_data = json.loads(json_str)
                                        titles_to_find = [str(t).lower() for t in p_data.get("playlist", [])]
                                        ai_playlist = [t for t in library if t.get("title", "").lower() in titles_to_find]
                                        ai_actions = p_data.get("actions", [])
                                        p_name = p_data.get("playlistName", p_name)
                                        
                                        # Limpieza robusta
                                        try:
                                            full_reply = full_reply.replace(json_str, "")
                                        except:
                                            pass
                                        full_reply = re.sub(r"```(?:json)?\s*```", "", full_reply, flags=re.DOTALL)
                                        full_reply = re.sub(r"```\w*\s*```", "", full_reply)
                                        full_reply = full_reply.strip()

                                        if len(full_reply) < 3:
                                            _t = ai_actions[0].get('type') if ai_actions else ''
                                            full_reply = "¡Hecho!" if _t else "¡Aquí tienes!"
                                    except: pass
                                reply_payload = { "status": "success", "reply": full_reply, "playlist": ai_playlist, "actions": ai_actions, "playlistName": p_name, "usageCount": usage_count + 1 }
                                with open(USAGE_FILE, "w") as f: json.dump({"date": time.strftime("%Y-%m-%d"), "count": usage_count + 1}, f)
                            else:
                                raise Exception(f"HTTP {resp.status_code} - {resp.text}")
                        except Exception as gem_e:
                            error_msg = str(gem_e)
                            reply_payload = { "status": "error", "reply": f"⚠️ Error: {error_msg}", "playlist": [], "playlistName": "", "usageCount": usage_count }

                self.send_response(200)
                self.send_header("Content-type", "application/json; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps(reply_payload).encode("utf-8"))
                
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode())

        # Endpoint: Recortar Audio
        elif path == '/api/trim':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))
                
                file_path = data.get('path')
                start = float(data.get('start', 0))
                end = float(data.get('end', 0))
                
                if not file_path or not os.path.exists(file_path):
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'error', 'message': 'Archivo no encontrado'}).encode())
                    return

                duration = end - start
                if duration <= 0:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'error', 'message': 'Rango inválido'}).encode())
                    return

                # Nombre temporal para el recorte
                dir_name = os.path.dirname(file_path)
                file_name = os.path.basename(file_path)
                temp_output = os.path.join(dir_name, f"trim_temp_{int(time.time())}_{file_name}")

                # Comando FFmpeg optimizado: -i entrada -ss inicio -t duracion para mÃ¡xima precisiÃ³n
                cmd = [
                    'ffmpeg', '-y',
                    '-i', file_path,
                    '-ss', str(start),
                    '-t', str(duration),
                    '-acodec', 'copy', 
                    temp_output
                ]
                
                print(f"Trimming audio: {file_path} from {start} to {end}")
                result = subprocess.run(cmd, capture_output=True, text=True)
                
                if result.returncode != 0:
                    # Segundo intento con re-codificaciÃ³n si el copiado directo falla
                    cmd = [
                        'ffmpeg', '-y',
                        '-i', file_path,
                        '-ss', str(start),
                        '-t', str(duration),
                        '-acodec', 'libmp3lame', '-q:a', '2',
                        temp_output
                    ]
                    result = subprocess.run(cmd, capture_output=True, text=True)

                if result.returncode == 0 and os.path.exists(temp_output):
                    # Reemplazar original
                    os.remove(file_path)
                    os.rename(temp_output, file_path)
                    
                    # --- SINCRONIZACIÃ“N DE BIBLIOTECA (Generado por Qwen-Local) ---
                    try:
                        if os.path.exists(ARCHIVO_SALIDA):
                            with open(ARCHIVO_SALIDA, "r", encoding="utf-8") as f:
                                biblioteca = json.load(f)
                            
                            updated = False
                            # Normalizamos la ruta para comparar
                            normalized_path = file_path.replace("\\", "/")
                            for track in biblioteca:
                                if track.get("filePath") == normalized_path:
                                    track["duration"] = duration
                                    updated = True
                                    break
                            
                            if updated:
                                with open(ARCHIVO_SALIDA, "w", encoding="utf-8") as f:
                                    json.dump(biblioteca, f, indent=2, ensure_ascii=False)
                    except Exception as sync_err:
                        log_error(f"Error sincronizando duraciÃ³n tras trim: {sync_err}")

                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'success', 'message': 'Recortado con éxito', 'newDuration': duration}).encode())
                else:
                    raise Exception(f"FFmpeg error: {result.stderr}")

            except Exception as e:
                log_error(f"Error en /api/trim: {e}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        
        # Endpoint: Descarga de YouTube
        elif path == '/api/download':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            # Check for overwrite/replace
            overwrite = data.get('overwrite', False)
            if not overwrite:
                # Basic check for existing file with same name
                nombre_base = limpiar_texto(data.get('title'))
                if data.get('artist'): nombre_base = f"{limpiar_texto(data.get('artist'))} - {nombre_base}"
                potential_file = os.path.join(CARPETA_MUSICA, f"{nombre_base}.mp3")
                if os.path.exists(potential_file):
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'exists', 'message': 'La canción ya existe.'}).encode())
                    return

            url = data.get('url')
            artista = data.get('artist')
            titulo_cancion = data.get('title')
            video_id = data.get('videoId', '')

            if not url or not artista or not titulo_cancion:
                self.send_response(400)
                self.end_headers()
                return

            # Security: Strict URL validation to prevent command injection
            parsed_url = urlparse(url)
            if parsed_url.scheme not in ['http', 'https'] or not any(domain in parsed_url.netloc for domain in ['youtube.com', 'youtu.be', 'googlevideo.com']):
                print(f"[!] Intento de descarga de URL no autorizada: {url}")
                self.send_response(403)
                self.end_headers()
                return
            
            # Additional sanitization: No spaces or suspicious flags in URL string
            if ' ' in url or '--' in url or ';' in url or '&' in url and 'v=' not in url:
                # 'v=' is common in YT urls, so we only block if it looks like shell chaining
                if ';' in url or '|' in url or '>' in url:
                    self.send_response(403)
                    self.end_headers()
                    return
                
            print(f"API: Descargando '{artista} - {titulo_cancion}'...")

            if not os.path.exists(CARPETA_MUSICA):
                os.makedirs(CARPETA_MUSICA)

            nombre_base = limpiar_texto(f"{artista} - {titulo_cancion}")
            ruta_base = os.path.join(CARPETA_MUSICA, nombre_base)
            
            if video_id:
                download_progress[video_id] = "0.0"

            def dl_hook(d):
                try:
                    import re # SoluciÃ³n crÃtica para NameError periodicamente reportado
                    if d['status'] == 'downloading' and video_id:
                        p = d.get('_percent_str', '0%')
                        p = re.sub(r'\x1b[^m]*m', '', p).replace('%','').strip()
                        download_progress[video_id] = p
                    elif d['status'] == 'finished' and video_id:
                        download_progress[video_id] = "100.0"
                except Exception as e:
                    print(f"Error en dl_hook: {e}")

            ydl_opts_dl = {
                'format': 'bestaudio/best',
                'outtmpl': f'{ruta_base}.%(ext)s',
                'noplaylist': True,
                'overwrites': True,
                'no_color': True,
                'progress_hooks': [dl_hook],
                'quiet': True,
                'no_warnings': True,
                'nocheckcertificate': True,
                'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'http_headers': {
                   'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                   'Accept-Language': 'en-US,en;q=0.9 es-ES;q=0.8,es;q=0.7',
                   'Referer': 'https://www.google.com/',
                },
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
            }
            
            try:
                import yt_dlp  # Lazy load to save startup RAM
                with yt_dlp.YoutubeDL(ydl_opts_dl) as ydl:
                    info = ydl.extract_info(url, download=True)
                    # When using FFmpegExtractAudio with preferredcodec='mp3', the final extension is mp3
                    ext = 'mp3'
                
                nombre_archivo_final = f"{nombre_base}.{ext}"
                ruta_relativa = f"Descarga canciones/music/{nombre_archivo_final}"
                
                # Verify if file exists (defensive)
                ruta_absoluta_final = os.path.join(CARPETA_MUSICA, nombre_archivo_final)
                if not os.path.exists(ruta_absoluta_final):
                    # Fallback check for different extensions if something went weird
                    for e in ['m4a', 'webm', 'mp3', 'opus']:
                        alt = os.path.join(CARPETA_MUSICA, f"{nombre_base}.{e}")
                        if os.path.exists(alt):
                            ruta_absoluta_final = alt
                            nombre_archivo_final = os.path.basename(alt)
                            break

                # FORZAR A MP3 siempre si es que el modulo yt-dlp falló la conversion
                if not nombre_archivo_final.lower().endswith('.mp3'):
                    print(f"[*] Forzando conversion a mp3: {ruta_absoluta_final}")
                    temp_mp3 = os.path.join(CARPETA_MUSICA, f"{nombre_base}_forced_{int(time.time())}.mp3")
                    
                    try:
                        cmd_conv = [
                            'ffmpeg', '-y', '-i', ruta_absoluta_final,
                            '-acodec', 'libmp3lame', '-q:a', '2',
                            temp_mp3
                        ]
                        conv_res = subprocess.run(cmd_conv, capture_output=True)
                        if conv_res.returncode == 0 and os.path.exists(temp_mp3):
                            os.remove(ruta_absoluta_final)
                            ruta_absoluta_final = temp_mp3
                            nombre_archivo_final = os.path.basename(temp_mp3)
                            print("[+] Conversion forzada a MP3 completa.")
                        else:
                            print(f"[-] FFmpeg fallo al forzar conversion: {conv_res.stderr}")
                    except Exception as fe:
                        print(f"[-] No se pudo forzar conversion a MP3 (FFmpeg instalado?): {fe}")

                # Actualizar Database Historico
                catalogo = []
                if os.path.exists(ARCHIVO_ENTRADA):
                    with open(ARCHIVO_ENTRADA, "r", encoding="utf-8") as f:
                        try:
                            catalogo = json.load(f)
                        except json.JSONDecodeError:
                            catalogo = []
                            
                titulo_limpio = re.sub(r'(?i)[\[\(].*?(official|music|video|audio|lyric|live|remaster).*?[\]\)]', '', titulo_cancion).strip()

                catalogo.append({
                    "title": titulo_limpio,
                    "artist": artista,
                    "album": "Descargas de YT",
                    "genre": "Descargado"
                })
                with open(ARCHIVO_ENTRADA, "w", encoding="utf-8") as f:
                    json.dump(catalogo, f, indent=2, ensure_ascii=False)
                    
                # Actualizar Database App
                biblioteca = []
                if os.path.exists(ARCHIVO_SALIDA):
                    with open(ARCHIVO_SALIDA, "r", encoding="utf-8") as f:
                        try:
                            biblioteca = json.load(f)
                        except json.JSONDecodeError:
                            biblioteca = []
                            
                next_id = 0
                if biblioteca:
                    next_id = max(item.get("id", 0) for item in biblioteca) + 1
                    
                # Use mutagen to extract exact duration after downloading
                duration = 0
                has_mutagen = False
                try:
                    from mutagen import File as MutagenFile
                    has_mutagen = True
                except ImportError:
                    pass

                if has_mutagen:
                    try:
                        audio = MutagenFile(ruta_absoluta_final)
                        if audio is not None and hasattr(audio, 'info') and audio.info:
                            duration = audio.info.length
                    except Exception as e:
                        print(f"No se pudo extraer duracion: {e}")

                nuevo_track = {
                    "id": next_id,
                    "title": titulo_limpio,
                    "artist": artista,
                    "album": "Descargas de YT",
                    "filePath": ruta_absoluta_final.replace("\\", "/"),
                    "duration": duration,
                    "ytThumbnail": info.get('thumbnail'),
                    "uploaderThumbnail": info.get('thumbnails')[-1].get('url') if info.get('thumbnails') else None,
                    "search_tags": f"{titulo_cancion.lower()} {artista.lower()} descargado",
                    "dateAdded": int(time.time() * 1000)
                }
                biblioteca.append(nuevo_track)
                
                # Save to disk (CRITICAL FIX)
                with open(ARCHIVO_SALIDA, "w", encoding="utf-8") as f:
                    json.dump(biblioteca, f, indent=2, ensure_ascii=False)
                
                # Write Physical ID3 Tags
                write_metadata(ruta_absoluta_final, nuevo_track)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success', 'track': nuevo_track}).encode('utf-8'))
                print("API: Descarga inyectada con Ã©xito a la base de datos.")
                
            except Exception as e:
                import traceback
                error_details = traceback.format_exc()
                log_error(f"Error en /api/download: {error_details}")
                print(f"Error en descarga: {error_details}")
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e), 'details': error_details}).encode())
                print(f"Error en descarga: {e}")

        # Endpoint: Editar metadatos de un MP3
        elif path == '/api/edit-metadata':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            file_path = data.get('filePath')  # Absolute path to the MP3 file
            
            if not file_path or not os.path.exists(file_path):
                self.send_response(400)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': 'Archivo no encontrado'}).encode())
                return

            try:
                if 'lyricsOffset' in data:
                    if os.path.exists(ARCHIVO_SALIDA):
                        with open(ARCHIVO_SALIDA, "r", encoding="utf-8") as f:
                            biblio = json.load(f)
                        for track in biblio:
                            # Strict match for persistence
                            if track.get('filePath') == file_path or track.get('id') == data.get('id'):
                                track['lyricsOffset'] = data.get('lyricsOffset')
                                break
                        with open(ARCHIVO_SALIDA, "w", encoding="utf-8") as f:
                            json.dump(biblio, f, indent=2, ensure_ascii=False)
                            
                # Use robust write_metadata helper
                success = write_metadata(file_path, data)
                
                if success:
                    print(f"API: Metadatos editados en '{os.path.basename(file_path)}'")
                else:
                    print(f"⚠️ API: Fallo al escribir metadatos ID3 en '{os.path.basename(file_path)}'")

                # Even if tagging fails, we respond 200 as JSON was likely updated via frontend or other means
                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))

            except Exception as e:
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode())
                print(f"Error editando metadatos: {e}")

        # Endpoint: Escaneo de carpeta local (Backend side)
        elif path == '/api/scan-folder':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))
                folder_path = data.get('folderPath')

                if not folder_path or not os.path.isdir(folder_path):
                    self.send_response(400)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'error', 'message': 'Carpeta no vÃ¡lida o no encontrada'}).encode())
                    return

                print(f"API: Escaneando carpeta '{folder_path}'...")
                tracks = []
                
                # Enhanced Metadata Extraction
                has_mutagen = False
                try:
                    from mutagen import File as MutagenFile
                    import base64
                    has_mutagen = True
                except ImportError:
                    print("âš  Mutagen no disponible. Usando datos bÃ¡sicos del nombre de archivo.")

                print(f"[*] Escaneando carpeta: {folder_path}")
                for root, dirs, files in os.walk(folder_path):
                    for file in files:
                        try:
                            if file.lower().endswith(('.mp3', '.flac', '.wav', '.m4a', '.ogg', '.webm', '.mp4')):
                                full_path = os.path.abspath(os.path.join(root, file))
                                print(f"[+] Descubierto: {file}")
                                base_name = os.path.splitext(file)[0]
                                
                                # Default metadata from filename
                                artist = "Unknown Artist"
                                title = base_name
                                if " - " in base_name:
                                    parts = base_name.split(" - ", 1)
                                    artist = parts[0].strip()
                                    title = parts[1].strip()
                                
                                track_data = {
                                    "id": f"fs_{int(os.path.getmtime(full_path))}_{len(tracks)}",
                                    "filePath": full_path.replace("\\", "/"),
                                    "fileName": file,
                                    "title": title,
                                    "artist": artist,
                                    "album": "Unknown Album",
                                    "coverUrl": None,
                                    "duration": 0,
                                    "releaseYear": None,
                                    "genre": None,
                                    "dateAdded": int(os.path.getmtime(full_path) * 1000)
                                }

                                if has_mutagen:
                                    try:
                                        audio = MutagenFile(full_path)
                                        if audio is not None:
                                            # Special handling for duration if .info is missing
                                            if hasattr(audio, 'info') and audio.info:
                                                track_data["duration"] = audio.info.length
                                            elif full_path.lower().endswith('.wav'):
                                                import wave
                                                with wave.open(full_path, 'r') as wav:
                                                    frames = wav.getnframes()
                                                    rate = wav.getframerate()
                                                    track_data["duration"] = frames / float(rate)
                                            elif full_path.lower().endswith('.mp3'):
                                                from mutagen.mp3 import MP3
                                                audio_mp3 = MP3(full_path)
                                                track_data["duration"] = audio_mp3.info.length
                                        
                                        if audio and audio.tags:
                                            tags = audio.tags
                                            # MP3 ID3
                                            if 'TIT2' in tags: track_data["title"] = str(tags['TIT2'])
                                            if 'TPE1' in tags: track_data["artist"] = str(tags['TPE1'])
                                            if 'TALB' in tags: track_data["album"] = str(tags['TALB'])
                                            if 'TDRC' in tags: track_data["releaseYear"] = str(tags['TDRC'])
                                            if 'TCON' in tags: track_data["genre"] = str(tags['TCON'])
                                            
                                            # Vorbis/FLAC tags
                                            if 'title' in tags: track_data["title"] = str(tags['title'][0])
                                            if 'artist' in tags: track_data["artist"] = str(tags['artist'][0])
                                            if 'album' in tags: track_data["album"] = str(tags['album'][0])
                                            if 'date' in tags: track_data["releaseYear"] = str(tags['date'][0])
                                            if 'genre' in tags: track_data["genre"] = str(tags['genre'][0])

                                            # Try to extract cover via URL (avoid huge inline base64)
                                            has_cover = False
                                            if hasattr(audio, 'pictures') and audio.pictures:
                                                has_cover = True
                                            else:
                                                for key in tags.keys():
                                                    if key.startswith('APIC'):
                                                        has_cover = True
                                                        break
                                            if has_cover:
                                                import urllib.parse
                                                track_data["coverUrl"] = f"http://127.0.0.1:{PORT}/api/cover?path={urllib.parse.quote(full_path)}&s=400"
                                    except Exception:
                                        pass
                                
                                # ffprobe fallback for duration on formats mutagen can't parse
                                file_ext = os.path.splitext(full_path)[1].lower()
                                if track_data["duration"] == 0 and file_ext in ('.webm', '.mp4', '.m4a', '.ogg', '.opus'):
                                    track_data["duration"] = ffprobe_duration(full_path)
                                    
                                tracks.append(track_data)
                        except Exception as e:
                            print(f"  - Error procesando archivo {file}: {e}")
                            continue

                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success', 'tracks': tracks}).encode('utf-8'))
                print(f"API: Escaneo completado. {len(tracks)} canciones encontradas.")
            except Exception as e:
                print(f"CRITICAL: Scan folder error: {e}")
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode())

        # Endpoint: Enriquecimiento de metadatos Multi-API
        elif path == '/api/enrich-metadata':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))

                title = data.get('title', '')
                artist = data.get('artist', '')
                yt_thumb = data.get('ytThumbnail')
                up_thumb = data.get('uploaderThumbnail')
                
                # Limpieza exhaustiva del título para búsqueda (quitar [Official Video], (Lyrics), etc)
                clean_title = re.sub(r'(?i)[\[\(\\\/].*?(official|music|video|audio|lyric|live|remaster|hd|4k|extra).*?[\]\)\\\/]', '', title).strip()
                if len(clean_title) < 2: clean_title = title

                result = {
                    "title": title,
                    "artist": artist,
                    "album": "Unknown Album",
                    "releaseYear": "---",
                    "coverUrl": None,
                    "lyrics": None,
                    "synced": False,
                    "source": "None"
                }

                def fetch_json(url, headers=None):
                    if headers is None:
                        headers = {'User-Agent': 'ChakrasPlayer/2.0 (tu@email.com)'}
                    req = urllib.request.Request(url, headers=headers)
                    try:
                        with urllib.request.urlopen(req, timeout=5) as resp:
                            return json.loads(resp.read().decode('utf-8'))
                    except urllib.error.URLError as url_err:
                        print(f"Enrichment: Network error for {url}: {url_err.reason}")
                        return None
                    except Exception as e:
                        print(f"Enrichment: Unexpected error for {url}: {e}")
                        return None

                query = urllib.parse.quote(f"{artist} {clean_title}")

                # 1. iTunes (HQ Cover & Year)
                try:
                    itunes_url = f"https://itunes.apple.com/search?term={query}&entity=song&limit=1"
                    it_data = fetch_json(itunes_url)
                    if it_data and it_data.get('resultCount', 0) > 0:
                        res = it_data['results'][0]
                        result["album"] = res.get('collectionName')
                        result["coverUrl"] = res.get('artworkUrl100', '').replace('100x100bb', '600x600bb')
                        if res.get('releaseDate'):
                            result["releaseYear"] = res['releaseDate'][:4]
                        result["source"] = "iTunes"
                except Exception as e:
                    print(f"Enrichment: iTunes failed: {e}")

                # 2. MusicBrainz Fallback
                if not result["album"] or not result["releaseYear"]:
                    try:
                        mb_url = f"https://musicbrainz.org/ws/2/recording?query={query}&fmt=json&limit=1"
                        mb_data = fetch_json(mb_url)
                        if mb_data and mb_data.get('recordings'):
                            rec = mb_data['recordings'][0]
                            if not result["album"] and rec.get('releases'):
                                result["album"] = rec['releases'][0].get('title')
                            if not result["releaseYear"] and rec.get('first-release-date'):
                                result["releaseYear"] = rec['first-release-date'][:4]
                            if result["source"] == "None": result["source"] = "MusicBrainz"
                    except Exception as e:
                        print(f"Enrichment: MusicBrainz failed: {e}")

                # Fallback cover: YouTube
                if not result["coverUrl"]:
                    if yt_thumb:
                        result["coverUrl"] = yt_thumb
                        if result["source"] == "None": result["source"] = "YouTube Video"
                    elif up_thumb:
                        result["coverUrl"] = up_thumb
                        if result["source"] == "None": result["source"] = "YouTube Channel"

                # 3. LRCLIB (Lyrics)
                try:
                    lrc_url = f"https://lrclib.net/api/search?q={query}"
                    lrc_data = fetch_json(lrc_url)
                    if lrc_data:
                        best = lrc_data[0]
                        if best.get('syncedLyrics'):
                            result["lyrics"] = best['syncedLyrics']
                            result["synced"] = True
                        elif best.get('plainLyrics'):
                            result["lyrics"] = best['plainLyrics']
                            result["synced"] = False
                except Exception as e:
                    print(f"Enrichment: LRCLIB failed: {e}")

                # 4. Lyrics.ovh Fallback
                if not result["lyrics"]:
                    try:
                        ovh_url = f"https://api.lyrics.ovh/v1/{urllib.parse.quote(artist)}/{urllib.parse.quote(title)}"
                        ovh_data = fetch_json(ovh_url)
                        if ovh_data.get('lyrics'):
                            result["lyrics"] = ovh_data['lyrics']
                            result["synced"] = False
                    except Exception as e:
                        print(f"Enrichment: Lyrics.ovh failed: {e}")

                # 5. Fallback Heuristics
                if not result["coverUrl"]:
                    h = sum(ord(c) for c in title)
                    c1 = f"{(h * 12345) % 0xFFFFFF:06x}"
                    c2 = f"{(h * 67890) % 0xFFFFFF:06x}"
                    result["coverUrl"] = f"gradient:#{c1}-#{c2}"
                
                if not result["lyrics"]:
                    result["lyrics"] = "No se encontraron letras en bases abiertas para esta pista."

                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))
            except Exception as e:
                print(f"API: Error en enriquecimiento: {e}")
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode())
                print(f"Enrichment: Error: {e}")

        # Endpoint: Borrar una canción
        elif path == '/api/delete-song':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))
                
                track_id = data.get('id')
                file_path = data.get('filePath')
                
                print(f"API: Solicitud para borrar canción: ID={track_id}, Path={file_path}")
                
                if file_path and os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                        print(f"API: Archivo borrado del disco: {file_path}")
                    except Exception as fe:
                        print(f"⚠️ No se pudo borrar el archivo físico: {fe}")

                # Eliminar de la base de datos JSON
                if os.path.exists(ARCHIVO_SALIDA):
                    with open(ARCHIVO_SALIDA, "r", encoding="utf-8") as f:
                        biblioteca = json.load(f)
                    
                    nueva_biblioteca = [t for t in biblioteca if str(t.get('id')) != str(track_id) and t.get('filePath') != file_path]
                    
                    if len(nueva_biblioteca) < len(biblioteca):
                        with open(ARCHIVO_SALIDA, "w", encoding="utf-8") as f:
                            json.dump(nueva_biblioteca, f, indent=2, ensure_ascii=False)
                        print(f"API: Canción eliminada de biblioteca_lista.json")
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success'}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode())

        # Endpoint: Limpiar librería completa
        elif path == '/api/clear-library':
            try:
                if os.path.exists(ARCHIVO_SALIDA):
                    with open(ARCHIVO_SALIDA, "w", encoding="utf-8") as f:
                        json.dump([], f)
                
                archivo_recientes = os.path.join(BASE_DIR, "recientes.json")
                if os.path.exists(archivo_recientes):
                    with open(archivo_recientes, "w", encoding="utf-8") as f:
                        json.dump([], f)

                print("API: Librería y recientes limpiados correctamente.")
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success'}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode())

        # ── Remote Control: Update status from main app ──────────────────
        elif path == '/api/remote/status':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))
                
                # remote_playback_state updated via global at start of do_POST
                remote_playback_state.update(data)
                remote_playback_state['timestamp'] = time.time()
                
                self.send_response(200)
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success'}).encode())
            except Exception as e:
                self.send_response(500)
                self.end_headers()
            return

        elif path == '/api/daily-mixes':
            """Genera 3 Daily Mixes personalizados basados en estadísticas locales."""
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8')) if post_data else {}

                library   = data.get('library', [])
                analytics = data.get('analytics', {})   # {topArtists, totalMinutes, peakHours}

                if not library:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'success', 'mixes': []}).encode())
                    return

                import random

                # ── Helpers ────────────────────────────────────────────────────────
                def tracks_by_artist(tracks, artist):
                    return [t for t in tracks if t.get('artist', '').lower() == artist.lower()]

                def shuffle(lst):
                    out = list(lst)
                    random.shuffle(out)
                    return out

                # ── Extraer artistas top del analytics ────────────────────────────
                top_artists = [a.get('artist') for a in analytics.get('topArtists', []) if a.get('artist')]

                mixes = []

                # ── Mix 1: Artistas favoritos mezclados ───────────────────────────
                fav_tracks = []
                for artist in top_artists[:3]:
                    fav_tracks += tracks_by_artist(library, artist)
                if len(fav_tracks) < 5:
                    fav_tracks = library[:]
                mixes.append({
                    'id':     'daily_1',
                    'name':   'Daily Mix 1 · Tus Favoritos',
                    'desc':   f"Basado en {', '.join(top_artists[:2]) or 'tu historial'}",
                    'icon':   'fa-fire',
                    'color':  'from-orange-600 to-pink-700',
                    'tracks': shuffle(fav_tracks)[:30]
                })

                # ── Mix 2: Descubrimiento — canciones poco escuchadas ─────────────
                low_play  = [t for t in library if (t.get('playCount') or 0) < 2]
                if len(low_play) < 5:
                    low_play = library[:]
                mixes.append({
                    'id':     'daily_2',
                    'name':   'Daily Mix 2 · Por Descubrir',
                    'desc':   'Canciones que casi no has escuchado',
                    'icon':   'fa-compass',
                    'color':  'from-teal-600 to-blue-700',
                    'tracks': shuffle(low_play)[:30]
                })

                # ── Mix 3: Por género/álbum predominante ──────────────────────────
                from collections import Counter
                genres  = [t.get('genre') for t in library if t.get('genre') and t['genre'] not in ('Descargado', 'Local', '')]
                top_gen = Counter(genres).most_common(1)
                if top_gen:
                    genre_name   = top_gen[0][0]
                    genre_tracks = [t for t in library if t.get('genre') == genre_name]
                    mix3_name    = f'Daily Mix 3 · {genre_name}'
                    mix3_desc    = f'Lo mejor del género {genre_name}'
                else:
                    # Fallback: canciones mejor valoradas
                    genre_tracks = sorted(library, key=lambda t: t.get('rating', 0), reverse=True)
                    mix3_name    = 'Daily Mix 3 · Mejor Valoradas'
                    mix3_desc    = 'Tus canciones con más estrellas'

                mixes.append({
                    'id':     'daily_3',
                    'name':   mix3_name,
                    'desc':   mix3_desc,
                    'icon':   'fa-star',
                    'color':  'from-purple-600 to-indigo-700',
                    'tracks': shuffle(genre_tracks)[:30]
                })

                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success', 'mixes': mixes}).encode('utf-8'))

            except Exception as e:
                import traceback
                print(f"[Daily Mixes] Error: {traceback.format_exc()}")
                self.send_response(500)
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode())
            return
        
        else:
            print(f"[!] 404 Not Found for POST: {path}")
            self.send_response(404)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': f'Endpoint {path} not found'}).encode())

# Permitir reinicio rapido de puerto
socketserver.TCPServer.allow_reuse_address = True


def fetch_lyrics_lrclib(track_name, artist):
    try:
        from urllib.parse import quote
        url = f"https://lrclib.net/api/get?artist_name={quote(artist)}&track_name={quote(track_name)}"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            return data.get('syncedLyrics') or data.get('plainLyrics')
    except:
        pass
    return None

if __name__ == "__main__":
    os.chdir(STATIC_DIR)
    sync_library() # Sincronizar al arrancar
    handler = ChakrasPlayerAPIHandler
    host = "0.0.0.0"  # Bind to all interfaces for Chakras Remote

    
    # Try to identify local IP for user convenience
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except:
        local_ip = "localhost"

    with socketserver.ThreadingTCPServer((host, PORT), handler) as httpd:
        print(f"\n🚀 Servidor activo en: http://localhost:{PORT}")
        print(f"📱 ACCESO REMOTO: http://{local_ip}:{PORT}/remote")
        print("\n💡 Si tu celular no conecta, asegúrate de que esté en la misma red Wi-Fi.")
        print("💡 Si sigue fallando, intenta abrir el puerto con: sudo ufw allow 5888/tcp")
        print("\nPresiona Ctrl+C para detener el servidor.\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nApagando el servidor...")
            httpd.server_close()
            sys.exit(0)


