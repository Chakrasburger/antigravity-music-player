import http.server
import socketserver
import json
import os
import re
import sys
import shutil
import time
from urllib.parse import urlparse, unquote, parse_qs
import urllib.request
import subprocess

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

PORT = 5888 # Usamos un puerto menos comÃºn para evitar conflictos con Live Server u otros servicios.

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
            if MutagenFile:
                try:
                    audio = MutagenFile(ruta_abs)
                    if audio:
                        if hasattr(audio, 'info') and audio.info:
                            duration = audio.info.length
                        if audio.tags:
                            # Re-check tags for title/artist
                            tags = audio.tags
                            if 'TIT2' in tags: titulo = str(tags['TIT2'])
                            elif 'title' in tags: titulo = str(tags['title'][0])
                            if 'TPE1' in tags: artista = str(tags['TPE1'])
                            elif 'artist' in tags: artista = str(tags['artist'][0])
                            
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
                except: pass
            return titulo, artista, duration, cover_url

        # Procesar reparaciones
        for item in files_to_repair:
            f_path = item.get("filePath", "").replace("/", "\\")
            if os.path.exists(f_path):
                t, a, d, c = extract_info(f_path, os.path.basename(f_path))
                if not item.get("coverUrl"): item["coverUrl"] = c
                if not item.get("duration"): item["duration"] = d
                if item.get("title") == os.path.basename(f_path).rsplit(".", 1)[0]: item["title"] = t
                if item.get("artist") == "Unknown Artist": item["artist"] = a

        # Procesar nuevas
        for f in new_files:
            ruta_abs = os.path.normpath(os.path.join(CARPETA_MUSICA, f))
            t, a, d, c = extract_info(ruta_abs, f)
            nuevo_track = {
                "id": next_id,
                "title": t,
                "artist": a,
                "album": "Importado Local",
                "filePath": ruta_abs.replace("\\", "/"),
                "duration": d,
                "coverUrl": c,
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

def limpiar_texto(texto):
    """Limpia caracteres especiales para que Windows pueda guardar el archivo."""
    return re.sub(r'[\\/*?:"<>|]', "", texto)

def write_metadata(file_path, data):
    """Writes metadata (ID3 tags) to an MP3 file."""
    if not file_path or not os.path.exists(file_path):
        return False
    
    # Only support MP3 for now (main format)
    if not file_path.lower().endswith('.mp3'):
        return False

    try:
        from mutagen.id3 import ID3, TIT2, TPE1, TALB, TDRC, TCON, APIC, USLT, ID3NoHeaderError
        import requests
        
        try:
            audio = ID3(file_path)
        except ID3NoHeaderError:
            audio = ID3()

        # Basic Tags
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
        
        # Lyrics (USLT)
        if data.get('lyrics'):
            audio.setall("USLT", [USLT(encoding=3, lang='eng', desc='lyrics', text=data['lyrics'])])

        # Cover Art
        cover_url = data.get('coverUrl') or data.get('ytThumbnail') or data.get('uploaderThumbnail')
        if cover_url:
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
                
                if img_data:
                    audio.add(APIC(
                        encoding=3,
                        mime=mime,
                        type=3, # front cover
                        desc=u'Front cover',
                        data=img_data
                    ))
            except Exception as e:
                print(f"⚠️ Error embedding cover: {e}")

        audio.save(file_path)
        return True
    except Exception as e:
        print(f"❌ Error writing metadata to {file_path}: {e}")
        return False

download_progress = {}

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
        parsed_path = urlparse(self.path)
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
        import re # Consolidate at method level to prevent UnboundLocalError
        parsed_path = urlparse(self.path)
        path = parsed_path.path.rstrip('/')
        print(f"[*] POST Request: {path}")
        
        if path == '/api/ping':
            print("[*] API Ping Received")
            self.send_response(200)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'pong'}).encode())
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

        # Endpoint: AI Assistant (Chakras IA)
        elif path == "/api/ai-chat":
            content_length = int(self.headers["Content-Length"])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode("utf-8"))
                query = data.get("query", "").lower()
                library = data.get("library", [])
                
                print(f"API: AI Chat Recibido -> '{query}' (Analizando {len(library)} canciones)")
                
                # --- GEMINI INTEGRATION ---
                import requests
                API_KEY = "AIzaSyDBl_ap8w4_yIwUqJTZFhtBLgLoJzCMlTg"
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
                if usage_count >= 1495:
                    reply_payload = {
                        "status": "success",
                        "reply": "¡ChakrasPlayer IA se va a dormir para descansar! He alcanzado el límite de llamadas gratuitas por hoy.",
                        "playlist": [],
                        "playlistName": "Limites alcanzados",
                        "usageCount": usage_count
                    }
                else:
                    lib_sample = library[:100] # Increased sample size
                    prompt = f"Eres el asistente de ChakrasPlayer. El usuario dice: '{query}'. " \
                             f"Aquí tienes su biblioteca (muestra): {json.dumps([{ 't': t.get('title'), 'a': t.get('artist') } for t in lib_sample], ensure_ascii=False)}. " \
                             f"IMPORTANTE: Si preparas una playlist, incluye al final de tu respuesta UNICAMENTE los nombres exactos en JSON: ```json {{\"playlist\": [\"titulo1\"]}} ```"
                    
                    # Using a more standard endpoint
                    gemini_url = f"https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={API_KEY}"
                    gemini_payload = { "contents": [{ "parts": [{"text": prompt}] }] }
                    
                    try:
                        resp = requests.post(gemini_url, json=gemini_payload, timeout=12)
                        
                        if resp.status_code != 200:
                            print(f"⚠️ Gemini API Error ({resp.status_code}): {resp.text}")
                            # Fallback if v1 fails, try v1beta as absolute fallback
                            if resp.status_code == 404:
                                gemini_url = gemini_url.replace("/v1/", "/v1beta/")
                                resp = requests.post(gemini_url, json=gemini_payload, timeout=12)

                        if resp.status_code == 200:
                            res_json = resp.json()
                            if "candidates" not in res_json:
                                raise Exception("Candidates not in response")

                            full_reply = res_json["candidates"][0]["content"]["parts"][0]["text"]
                            
                            ai_playlist = []
                            p_name = "Sugerencia IA"
                            if "```json" in full_reply:
                                try:
                                    json_part = re.search(r"```json\s*(.*?)\s*```", full_reply, re.DOTALL).group(1)
                                    p_data = json.loads(json_part)
                                    titles_to_find = [t.lower() for t in p_data.get("playlist", [])]
                                    ai_playlist = [t for t in library if t.get("title", "").lower() in titles_to_find or t.get("artist", "").lower() in titles_to_find]
                                    full_reply = full_reply.split("```json")[0].strip()
                                except: pass
                            
                            reply_payload = {
                                "status": "success",
                                "reply": full_reply,
                                "playlist": ai_playlist,
                                "playlistName": p_name,
                                "usageCount": usage_count + 1
                            }
                            today = time.strftime("%Y-%m-%d")
                            with open(USAGE_FILE, "w") as f:
                                json.dump({"date": today, "count": usage_count + 1}, f)
                        else:
                            raise Exception(f"HTTP {resp.status_code}")

                    except Exception as gem_e:
                        print(f"❌ Gemini Error: {gem_e}")
                        reply_payload = {
                            "status": "success", 
                            "reply": f"Chakras IA está experimentando turbulencias (Error: {str(gem_e)}). Intentaré reconectar pronto.", 
                            "playlist": library[:10], 
                            "playlistName": "Mezcla de respaldo", 
                            "usageCount": usage_count
                        }

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

                # Comando FFmpeg: -ss inicio -t duracion -i entrada -c:v copy -c:a copy salida
                cmd = [
                    'ffmpeg', '-y',
                    '-ss', str(start),
                    '-t', str(duration),
                    '-i', file_path,
                    '-acodec', 'copy', 
                    temp_output
                ]
                
                print(f"Trimming audio: {file_path} from {start} to {end}")
                result = subprocess.run(cmd, capture_output=True, text=True)
                
                if result.returncode != 0:
                    # Retry with re-encoding if copy fails
                    cmd = [
                        'ffmpeg', '-y',
                        '-ss', str(start),
                        '-t', str(duration),
                        '-i', file_path,
                        '-acodec', 'libmp3lame', '-q:a', '2',
                        temp_output
                    ]
                    result = subprocess.run(cmd, capture_output=True, text=True)

                if result.returncode == 0 and os.path.exists(temp_output):
                    # Reemplazar original
                    os.remove(file_path)
                    os.rename(temp_output, file_path)
                    
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
                if d['status'] == 'downloading' and video_id:
                    p = d.get('_percent_str', '0%')
                    p = re.sub(r'\x1b[^m]*m', '', p).replace('%','').strip()
                    download_progress[video_id] = p
                elif d['status'] == 'finished' and video_id:
                    download_progress[video_id] = "100.0"

            ydl_opts_dl = {
                'format': 'bestaudio/best',
                'outtmpl': f'{ruta_base}.%(ext)s',
                'noplaylist': True,
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
                                        else:
                                            print(f"  [!] Mutagen no pudo cargar {file}")
                                        
                                        if audio and audio.tags:
                                            tags = audio.tags
                                            # Common tag mapping across formats
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

                                            # Try to extract cover
                                            if hasattr(audio, 'pictures') and audio.pictures:
                                                pic = audio.pictures[0]
                                                track_data["coverUrl"] = f"data:{pic.mime};base64,{base64.b64encode(pic.data).decode('utf-8')}"
                                            else:
                                                # Look for APIC in ID3
                                                for key in tags.keys():
                                                    if key.startswith('APIC'):
                                                        apic = tags[key]
                                                        track_data["coverUrl"] = f"data:{apic.mime};base64,{base64.b64encode(apic.data).decode('utf-8')}"
                                                        break
                                    except Exception:
                                        pass
                                    
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

        # Endpoint: Recortar un MP3
        elif path == '/api/trim-audio':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            file_path = data.get('filePath')
            start_sec = float(data.get('start', 0))
            end_sec = float(data.get('end', 0))

            if not file_path or not os.path.exists(file_path):
                self.send_response(400)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': 'Archivo no encontrado'}).encode())
                return

            try:
                import subprocess
                duration = end_sec - start_sec
                base, ext = os.path.splitext(file_path)
                out_path = f"{base}_trim{ext}"

                cmd = [
                    'ffmpeg', '-y',
                    '-i', file_path,
                    '-ss', str(start_sec),
                    '-to', str(end_sec),
                    out_path
                ]
                result = subprocess.run(cmd, capture_output=True, text=True)
                
                if result.returncode != 0:
                    raise Exception(result.stderr)

                # Overwrite original with trimmed version
                os.replace(out_path, file_path)
                print(f"API: Audio recortado correctamente '{os.path.basename(file_path)}'")

                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success', 'newDuration': duration}).encode('utf-8'))

            except Exception as e:
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode())
                print(f"Error recortando audio: {e}")

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
                    with urllib.request.urlopen(req, timeout=5) as resp:
                        return json.loads(resp.read().decode('utf-8'))

                query = urllib.parse.quote(f"{artist} {clean_title}")

                # 1. iTunes (HQ Cover & Year)
                try:
                    itunes_url = f"https://itunes.apple.com/search?term={query}&entity=song&limit=1"
                    it_data = fetch_json(itunes_url)
                    if it_data.get('resultCount', 0) > 0:
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
                        if mb_data.get('recordings'):
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
        
        else:
            print(f"[!] 404 Not Found for POST: {path}")
            self.send_response(404)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': f'Endpoint {path} not found'}).encode())

# Permitir reinicio rapido de puerto
socketserver.TCPServer.allow_reuse_address = True

if __name__ == "__main__":
    os.chdir(STATIC_DIR)
    sync_library() # Sincronizar al arrancar
    handler = ChakrasPlayerAPIHandler
    host = "127.0.0.1" 
    with socketserver.ThreadingTCPServer((host, PORT), handler) as httpd:
        print(f"✨ Reproductor e Integración de YouTube sirviendo en: http://{host}:{PORT}")
        print("ðŸ’¡ Cierra el 'Live Server' (si lo tienes abierto) y ve a esta ruta en tu navegador.")
        print("Presiona Ctrl+C para detener el servidor.\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nApagando el servidor...")
            httpd.server_close()
            sys.exit(0)
