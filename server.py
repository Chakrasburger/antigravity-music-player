import http.server
import socketserver
import json
import os
import re
import sys
import shutil
import time
from urllib.parse import urlparse, unquote, parse_qs

# yt_dlp and mutagen are imported lazily on first use to save RAM at startup.

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

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

PORT = 5888 # Usamos un puerto menos común para evitar conflictos con Live Server u otros servicios.

def limpiar_texto(texto):
    """Limpia caracteres especiales para que Windows pueda guardar el archivo."""
    return re.sub(r'[\\/*?:"<>|]', "", texto)

download_progress = {}

class AntiGravityAPIHandler(http.server.SimpleHTTPRequestHandler):
    
    # Extensiones correctas para el servidor estático
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
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Range')

    def do_HEAD(self):
        self.do_GET(head=True)

    def do_GET(self, head=False):
        parsed_path = urlparse(self.path)
        if parsed_path.path == '/api/progress':
            query_components = dict(qc.split("=") for qc in parsed_path.query.split("&") if "=" in qc)
            video_id = query_components.get("id", "")
            progress = download_progress.get(video_id, "0")
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            if not head:
                self.wfile.write(json.dumps({'status': 'success', 'progress': progress}).encode('utf-8'))
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

                # Limpiamos posibles barras iniciales que confunden a abspath en Windows
                file_path = file_path.lstrip('/\\')
                
                # Normalizamos la ruta a absoluta para evitar ambigüedades en Windows
                abs_path = os.path.abspath(file_path)

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
                    
                    # Definimos raíces de búsqueda: BASE_DIR y su padre (por si es dist/)
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
                
                # 4. Búsqueda profunda (último recurso)
                if not target:
                    print(f"[*] Iniciando búsqueda profunda para: {filename}")
                    # Buscamos en BASE_DIR y en el padre si estamos en dist/
                    for root_to_search in search_roots:
                        for root, dirs, files in os.walk(root_to_search):
                            if filename in files:
                                target = os.path.join(root, filename)
                                print(f"[+] Encontrado en búsqueda profunda: {target}")
                                break
                        if target: break

                if target:
                    file_path = target
                    ext = os.path.splitext(file_path)[1].lower()
                    mime = self.extensions_map.get(ext, 'audio/mpeg')
                    file_size = os.path.getsize(file_path)

                    # --- SOPORTE PARA STREAMING (HTTP 206) VITAL PARA EL SEEK Y DURACIÓN ---
                    range_header = self.headers.get('Range', None)
                    
                    if range_header:
                        # El navegador pide un bloque específico (útil para la metadata del audio)
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
                    # Intentar loguear a un archivo para diagnóstico en EXE
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
        parsed_path = urlparse(self.path)
        path = parsed_path.path.rstrip('/')
        print(f"[*] POST Request: {path}")
        
        if path == '/api/ping':
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'pong'}).encode())
            return

        if path == '/api/version':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'version': '1.0.4'}).encode('utf-8'))
            return

        # Endpoint: Búsqueda en YouTube
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
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'success', 'results': resultados}).encode('utf-8'))
                    
                except Exception as e:
                    self.send_response(500)
                    self.end_headers()
                    print(f"Error en búsqueda: {e}")

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
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'success', 'lyrics': lrc_text}).encode('utf-8'))
                else:
                    print(f"API: No se encontraron letras sincronizadas para '{search_term}'")
                    self.send_response(404)
                    self.end_headers()
            except Exception as e:
                print(f"API Error en búsqueda de letras: {e}")
                self.send_response(500)
                self.end_headers()

        # Endpoint: AI Assistant (Chakras Guru)
        elif path == '/api/ai-chat':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                query = data.get('query', '').lower()
                library = data.get('library', [])
                
                print(f"API: AI Chat Recibido -> '{query}' (Analizando {len(library)} canciones)")
                
                # --- HEURÍSTICA OFFLINE (NLP Básico) ---
                response_text = "No entendí muy bien. Intenta pedirme algo como 'Música para relajarme' o 'Dame rock intenso'."
                playlist = []
                playlist_name = "Playlist de AI"
                
                # 1. Definir Diccionarios de Ánimo/Frecuencia
                moods = {
                    "relax": {"keywords": ["relajar", "dormir", "calma", "chill", "tranquilo", "sad", "triste", "estudiar", "432hz"], "genres": ["ambient", "lo-fi", "lofi", "chill", "classical", "jazz", "acoustic"]},
                    "energy": {"keywords": ["entrenar", "gym", "correr", "fiesta", "feliz", "alegre", "euforia", "energia", "528hz"], "genres": ["rock", "pop", "metal", "electronic", "dance", "edm", "hip hop", "trap"]},
                    "focus": {"keywords": ["trabajar", "programar", "foco", "concentrar", "leer", "estudiar"], "genres": ["synthwave", "instrumental", "soundtrack", "ambient", "electronic", "lofi"]},
                    "love": {"keywords": ["romantico", "amor", "pareja", "cita", "love"], "genres": ["r&b", "pop", "bolero", "acoustic", "soul"]}
                }
                
                # 2. Detectar Intención Primaria
                matched_mood = None
                for mood, config in moods.items():
                    if any(kw in query for kw in config["keywords"]):
                        matched_mood = mood
                        break
                        
                # 3. Filtrar Librería basada en Intención + Rating
                if library:
                    if matched_mood == "relax":
                        response_text = "He preparado una mezcla muy tranquila para bajar las revoluciones y fluir. ¡Ideal para relajarte!"
                        playlist_name = "Chakras Guru: Relax & Chill"
                        target_genres = moods["relax"]["genres"]
                    elif matched_mood == "energy":
                        response_text = "¡Vamos arriba! Seleccioné frecuencias altas y ritmos potentes para llenarte de energía. ¡A romperla!"
                        playlist_name = "Chakras Guru: High Energy"
                        target_genres = moods["energy"]["genres"]
                    elif matched_mood == "focus":
                        response_text = "Modo concentración activado. Aquí tienes frecuencias continuas para mantenerte inmerso en tu zona."
                        playlist_name = "Chakras Guru: Deep Focus"
                        target_genres = moods["focus"]["genres"]
                    elif matched_mood == "love":
                        response_text = "El amor está en el aire. Dejé listas las pistas más románticas de tu colección."
                        playlist_name = "Chakras Guru: Romantic Vibes"
                        target_genres = moods["love"]["genres"]
                    elif "favorit" in query or "gusta" in query or "corazon" in query:
                        response_text = "Entendido. Aquí tienes lo mejor de lo mejor, tus pistas marcadas como favoritas (♥)."
                        playlist_name = "Chakras Guru: Tus Favoritos"
                        # Filtro especial por rating
                        playlist = [t for t in library if t.get('rating', 0) == 1]
                        target_genres = [] # Evitar el filtro general
                        matched_mood = "favorites"
                    elif "sorprende" in query or "aleatorio" in query or "random" in query or "cualquier" in query:
                        response_text = "Voy a sacar algunas joyas al azar de tu bóveda musical. ¡Déjate sorprender!"
                        playlist_name = "Chakras Guru: Sorpresa"
                        import random
                        playlist = random.sample(library, min(20, len(library)))
                        target_genres = []
                        matched_mood = "random"
                    
                    # Filtro General si hubo match de ánimos (y no fue "favoritos" ni "random")
                    if matched_mood and matched_mood not in ["favorites", "random"]:
                        for track in library:
                            genre = str(track.get('genre', '')).lower()
                            title = str(track.get('title', '')).lower()
                            artist = str(track.get('artist', '')).lower()
                            
                            is_match = False
                            # Match por Género explícito
                            if any(g in genre for g in target_genres):
                                is_match = True
                            # Heurística: Si no hay género, buscar palabras clave en el título/artista
                            elif any(kw in title for kw in moods[matched_mood]["keywords"]):
                                is_match = True
                                
                            # Boost si tiene "rating" y cuadra con el género
                            if is_match:
                                playlist.append(track)
                        
                        # Limitar a máximo 30 pistas y ordenarlas un poco por rating
                        playlist = sorted(playlist, key=lambda x: x.get('rating', 0), reverse=True)[:30]
                        
                        # Fallback si el filtro fue muy estricto y no encontró nada
                        if not playlist:
                            import random
                            response_text = f"Sabes, no encontré exactamente ese estilo en tu librería actual, pero te preparé algo genial de todos modos."
                            playlist = random.sample(library, min(15, len(library)))
                
                else:
                    response_text = "Aún no tienes canciones en tu librería local. Intenta agregar una carpeta primero o busca música en la pestaña de YouTube."
                
                # Armar el JSON puro para React
                reply_payload = {
                    'status': 'success',
                    'reply': response_text,
                    'playlist': playlist,  # Array completo de objetos Track pasados desde JS
                    'playlistName': playlist_name
                }
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(reply_payload).encode('utf-8'))
                
            except Exception as e:
                print(f"Error procesando AI Chat: {e}")
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode())
        
        # Endpoint: Descarga de YouTube
        elif path == '/api/download':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            url = data.get('url')
            artista = data.get('artist')
            titulo_cancion = data.get('title')
            video_id = data.get('videoId', '')

            if not url or not artista or not titulo_cancion:
                self.send_response(400)
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
                'format': 'bestaudio[ext=m4a]/bestaudio/best',
                'outtmpl': f'{ruta_base}.%(ext)s',
                'noplaylist': True,
                'progress_hooks': [dl_hook],
                'quiet': True,
                'no_warnings': True
            }
            
            try:
                import yt_dlp  # Lazy load to save startup RAM
                with yt_dlp.YoutubeDL(ydl_opts_dl) as ydl:
                    info = ydl.extract_info(url, download=True)
                    ext = info.get('ext', 'm4a')
                
                nombre_archivo_final = f"{nombre_base}.{ext}"
                ruta_relativa = f"descarga_canciones/music/{nombre_archivo_final}"
                
                # Actualizar Database Historico
                catalogo = []
                if os.path.exists(ARCHIVO_ENTRADA):
                    with open(ARCHIVO_ENTRADA, "r", encoding="utf-8") as f:
                        try:
                            catalogo = json.load(f)
                        except json.JSONDecodeError:
                            catalogo = []
                            
                import re
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
                        audio = MutagenFile(os.path.join(CARPETA_MUSICA, nombre_archivo_final))
                        if audio is not None and hasattr(audio, 'info') and audio.info:
                            duration = audio.info.length
                    except Exception as e:
                        print(f"No se pudo extraer duracion: {e}")

                nuevo_track = {
                    "id": next_id,
                    "title": titulo_limpio,
                    "artist": artista,
                    "album": "Descargas de YT",
                    "filePath": ruta_relativa,
                    "duration": duration,
                    "search_tags": f"{titulo_cancion.lower()} {artista.lower()} descargado",
                    "dateAdded": 9999999999999 # Place-holder to be overwritten in JS or will appear very large
                }
                biblioteca.append(nuevo_track)
                
                with open(ARCHIVO_SALIDA, "w", encoding="utf-8") as f:
                    json.dump(biblioteca, f, indent=2, ensure_ascii=False)
                    
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success', 'track': nuevo_track}).encode('utf-8'))
                print("API: Descarga inyectada con éxito a la base de datos.")
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode())
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
                try:
                    from mutagen.id3 import ID3, TIT2, TPE1, TALB, TDRC, TCON, ID3NoHeaderError  # Lazy load
                except ImportError:
                    raise Exception("Mutagen no está instalado. Ejecuta: pip install mutagen")
                
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
                
                audio.save(file_path)
                print(f"API: Metadatos editados en '{os.path.basename(file_path)}'")
                
                # Support for saving cover art if provided
                cover_url = data.get('coverUrl')
                if cover_url and cover_url.startswith('data:image'):
                    try:
                        import base64
                        from mutagen.id3 import APIC
                        header, encoded = cover_url.split(",", 1)
                        mime = header.split(":")[1].split(";")[0]
                        image_data = base64.b64decode(encoded)
                        
                        audio = ID3(file_path)
                        audio.add(APIC(
                            encoding=3, # utf-8
                            mime=mime,
                            type=3, # album front cover
                            desc=u'Front cover',
                            data=image_data
                        ))
                        audio.save(file_path)
                        print(f"API: Portada guardada en '{os.path.basename(file_path)}'")
                    except Exception as e:
                        print(f"Error guardando portada: {e}")

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
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
                    self.wfile.write(json.dumps({'status': 'error', 'message': 'Carpeta no válida o no encontrada'}).encode())
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
                    print("⚠ Mutagen no disponible. Usando datos básicos del nombre de archivo.")

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
                                    "filePath": full_path,
                                    "fileName": file,
                                    "title": title,
                                    "artist": artist,
                                    "album": "Unknown Album",
                                    "coverUrl": None,
                                    "duration": 0,
                                    "releaseYear": None,
                                    "genre": None
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
                self.send_header('Content-type', 'application/json')
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
                    '-t', str(duration),
                    '-c', 'copy',
                    out_path
                ]
                result = subprocess.run(cmd, capture_output=True, text=True)
                
                if result.returncode != 0:
                    raise Exception(result.stderr)

                # Overwrite original with trimmed version
                os.replace(out_path, file_path)
                print(f"API: Audio recortado correctamente '{os.path.basename(file_path)}'")

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success', 'newDuration': duration}).encode('utf-8'))

            except Exception as e:
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode())
                print(f"Error recortando audio: {e}")
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
    handler = AntiGravityAPIHandler
    host = "127.0.0.1" # Forzar IPv4 para evitar problemas de resolución de 'localhost' en WebView2
    with socketserver.TCPServer((host, PORT), handler) as httpd:
        print(f"✨ Reproductor e Integración de YouTube sirviendo en: http://{host}:{PORT}")
        print("💡 Cierra el 'Live Server' (si lo tienes abierto) y ve a esta ruta en tu navegador.")
        print("Presiona Ctrl+C para detener el servidor.\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nApagando el servidor...")
            httpd.server_close()
            sys.exit(0)
