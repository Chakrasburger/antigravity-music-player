import webview
import os
import sys
import shutil
import hashlib
import base64
import threading
import socketserver
import time

# ConfiguraciÃ³n del entorno PyInstaller
if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
    if sys._MEIPASS not in sys.path:
        sys.path.append(sys._MEIPASS)

# ConfiguraciÃ³n del servidor
host = "127.0.0.1"
PORT = 5888

# ImportaciÃ³n del handler del servidor
try:
    from server import ChakrasPlayerAPIHandler, sync_library
except Exception as e:
    ChakrasPlayerAPIHandler = None
    sync_library = None
    # We don't have safe_print yet, so we'll log this later in main
    _startup_error = e
else:
    _startup_error = None

def get_base_path():
    """Returns the base directory for persistent data (where the .exe is)."""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

def get_resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath("."), relative_path)

def safe_print(msg):
    """Prints to stdout and a log file."""
    log_msg = f"[{time.ctime()}] {msg}"
    try:
        print(log_msg)
    except:
        pass
    try:
        log_path = os.path.join(get_base_path(), "debug.log")
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(log_msg + "\n")
    except:
        pass

class Api:
    def __init__(self):
        self.base_dir = get_base_path()
        self.native_dir = os.path.join(self.base_dir, "reproduccion_nativa")
        if not os.path.exists(self.native_dir):
            os.makedirs(self.native_dir)

    def pick_folder(self):
        result = window.create_file_dialog(webview.FOLDER_DIALOG)
        return result[0] if result else None

    def sync_file(self, src_path):
        """Aggressively mirrors a file to the native reproduction folder."""
        try:
            if not os.path.exists(src_path): return None
            
            name_hash = hashlib.md5(src_path.encode('utf-8')).hexdigest()[:10]
            safe_name = "".join([c if c.isalnum() or c in '._-' else '_' for c in os.path.basename(src_path)])
            shadow_name = f"{name_hash}_{safe_name}"
            shadow_path = os.path.join(self.native_dir, shadow_name)

            if not os.path.exists(shadow_path):
                shutil.copy2(src_path, shadow_path)
                safe_print(f"[Sync] Mirrored: {safe_name}")
            
            return shadow_name 
        except Exception as e:
            safe_print(f"[Sync] Error: {e}")
            return None

    def read_file_base64(self, file_path):
        """Reads ANY local file and returns base64 string."""
        safe_print(f"[Bridge] Requesting: {file_path}")
        try:
            # Clean path from potential leading slashes
            clean_path = file_path.lstrip('/\\')
            
            candidates = [
                clean_path, 
                file_path,
                os.path.join(self.base_dir, clean_path),
                os.path.join(self.base_dir, "internal_library", clean_path),
                os.path.join(self.base_dir, "descarga_canciones", "music", clean_path),
                os.path.join(self.base_dir, "reproduccion_nativa", clean_path),
                os.path.join(self.native_dir, clean_path)
            ]

            target = None
            for p in candidates:
                p = os.path.normpath(p)
                if os.path.exists(p) and os.path.isfile(p):
                    target = p
                    break
            
            # Deep search fallback for Japanese/Unicode files that might have complex relative paths
            if not target:
                filename = os.path.basename(file_path)
                search_roots = [
                    self.base_dir,
                    os.path.join(self.base_dir, "internal_library"),
                    os.path.join(self.base_dir, "descarga_canciones")
                ]
                for root_dir in search_roots:
                    if not os.path.exists(root_dir): continue
                    for root, dirs, files in os.walk(root_dir):
                        if filename in files:
                            target = os.path.join(root, filename)
                            break
                    if target: break

            if target:
                safe_print(f"[Bridge] Found: {target}")
                with open(target, 'rb') as f:
                    data = f.read()
                    b64 = base64.b64encode(data).decode('utf-8')
                    safe_print(f"[Bridge] Sent {len(data)} bytes")
                    return b64
            
            safe_print(f"[Bridge] FAIL: File not found. Candidates checked: {len(candidates)}")
            return None
        except Exception as e:
            safe_print(f"[Bridge] ERROR: {e}")
            return None

    def scan_folder(self, folder_path):
        """Pure Native folder scanner - eliminates /api/scan-folder."""
        safe_print(f"[Scan] Starting: {folder_path}")
        tracks = []
        extensions = ('.mp3', '.flac', '.wav', '.ogg', '.webm', '.mp4', '.m4a')
        
        has_mutagen = False
        try:
            from mutagen import File as MutagenFile
            import base64
            has_mutagen = True
        except ImportError:
            safe_print("âš  Mutagen no disponible. Usando datos bÃ¡sicos del nombre de archivo.")

        try:
            for root, dirs, files in os.walk(folder_path):
                for file in files:
                    if file.lower().endswith(extensions):
                        full_path = os.path.join(root, file)
                        track_id = hashlib.md5(full_path.encode('utf-8')).hexdigest()[:12]
                        base_name = os.path.splitext(file)[0]
                        
                        artist = 'Unknown Artist'
                        title = base_name
                        if " - " in base_name:
                            parts = base_name.split(" - ", 1)
                            artist = parts[0].strip()
                            title = parts[1].strip()

                        track_data = {
                            'id': track_id,
                            'fileName': file,
                            'filePath': full_path,
                            'title': title,
                            'artist': artist,
                            'album': 'Unknown Album',
                            'coverUrl': None,
                            'duration': 0,
                            'releaseYear': None,
                            'genre': None
                        }

                        if has_mutagen:
                            try:
                                audio = MutagenFile(full_path)
                                if audio is not None:
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

                                    # Try to extract cover
                                    has_cover = False
                                    if hasattr(audio, 'pictures') and audio.pictures:
                                        has_cover = True
                                    else:
                                        # Look for APIC in ID3
                                        for key in tags.keys():
                                            if key.startswith('APIC'):
                                                has_cover = True
                                                break
                                    
                                    if has_cover:
                                        import urllib.parse
                                        # Use the local server URL (Port 5888)
                                        # Since this is the bridge, we provide the full localhost URL
                                        track_data["coverUrl"] = f"http://127.0.0.1:5888/api/cover?path={urllib.parse.quote(full_path)}&s=400"
                            except Exception as e:
                                safe_print(f"Error parseando metadatos para {file}: {e}")
                        
                        tracks.append(track_data)
            safe_print(f"[Scan] Success: {len(tracks)} files")
            return {'status': 'success', 'tracks': tracks}
        except Exception as e:
            safe_print(f"[Scan] ERROR: {e}")
            return {'status': 'error', 'message': str(e)}

    def edit_metadata(self, data):
        """Stub for metadata editing via bridge - avoids 405 error."""
        safe_print(f"[Bridge] Metadata Update requested: {data.get('id')}")
        return {'status': 'success', 'message': 'Metadata update received by bridge (Native)'}

    def extract_batch_metadata(self, file_content_b64):
        """Extracts track names/artist metadata from a base64 encoded file (.txt or .json)."""
        safe_print("[Bridge] Extracting batch metadata...")
        try:
            # Decode content
            content = base64.b64decode(file_content_b64).decode('utf-8')
            
            # Identify if it is JSON or TXT
            songs_to_download = []
            
            if content.strip().startswith('[') or content.strip().startswith('{'):
                try:
                    import json
                    data = json.loads(content)
                    if isinstance(data, list):
                        for item in data:
                            if isinstance(item, dict):
                                artist = item.get('artist', 'Unknown Artist')
                                title = item.get('title', item.get('name', 'Unknown Title'))
                                songs_to_download.append({'artist': artist, 'title': title})
                    elif isinstance(data, dict):
                        # Maybe a single track or a playlist object
                        tracks = data.get('tracks', [])
                        for item in tracks:
                            artist = item.get('artist', 'Unknown Artist')
                            title = item.get('title', item.get('name', 'Unknown Title'))
                            songs_to_download.append({'artist': artist, 'title': title})
                except:
                    pass
            
            # If nothing found or not JSON, parse as TXT (one per line)
            if not songs_to_download:
                lines = content.split('\n')
                for line in lines:
                    line = line.strip()
                    if not line: continue
                    
                    artist = "Unknown Artist"
                    title = line
                    
                    if " - " in line:
                        parts = line.split(" - ", 1)
                        artist = parts[0].strip()
                        title = parts[1].strip()
                    elif "-" in line:
                        parts = line.split("-", 1)
                        artist = parts[0].strip()
                        title = parts[1].strip()
                    
                    songs_to_download.append({'artist': artist, 'title': title})
            
            safe_print(f"[Bridge] Found {len(songs_to_download)} songs in batch.")
            return {'status': 'success', 'songs': songs_to_download}
            
        except Exception as e:
            safe_print(f"[Bridge] Batch extraction error: {e}")
            return {'status': 'error', 'message': str(e)}

    def safe_rename_file(self, old_path, suggested_name):
        """Physically renames a file to a safe ASCII-ish name."""
        safe_print(f"[Bridge] Rename requested: {old_path} -> {suggested_name}")
        try:
            target_old = None
            if os.path.exists(old_path):
                target_old = old_path
            else:
                # Try relative fallbacks
                clean_old = old_path.lstrip('/\\')
                candidates = [
                    os.path.join(self.base_dir, clean_old),
                    os.path.join(self.base_dir, "internal_library", clean_old),
                    os.path.join(self.base_dir, "descarga_canciones", "music", clean_old)
                ]
                for c in candidates:
                    if os.path.exists(c):
                        target_old = c
                        break
            
            if not target_old:
                return {'status': 'error', 'message': 'Original file not found'}

            # Sanitize suggested name
            ext = os.path.splitext(target_old)[1]
            # Remove non-ascii or weird chars, keeping spaces and dots
            safe_name = "".join([c if c.isalnum() or c in ' ._-' else '_' for c in suggested_name])
            safe_name = safe_name.strip()
            if not safe_name: safe_name = "renamed_track"
            
            new_basename = f"{safe_name}{ext}"
            new_path = os.path.join(os.path.dirname(target_old), new_basename)

            # Avoid collision
            counter = 1
            while os.path.exists(new_path) and new_path.lower() != target_old.lower():
                new_path = os.path.join(os.path.dirname(target_old), f"{safe_name}_{counter}{ext}")
                counter += 1

            os.rename(target_old, new_path)
            safe_print(f"[Bridge] Renamed successfully to: {new_path}")
            return {'status': 'success', 'newPath': new_path, 'newFileName': os.path.basename(new_path)}
        except Exception as e:
            safe_print(f"[Bridge] Rename error: {e}")
            return {'status': 'error', 'message': str(e)}

def main():
    global window
    application_path = get_base_path()
    os.chdir(application_path)

    if _startup_error:
        safe_print(f"[Main] FATAL STARTUP ERROR: {_startup_error}")
    
    api = Api()
    
    # Iniciar servidor de backend en un hilo separado
    def run_server():
        if sync_library:
            try:
                safe_print("[Backend] Sincronizando biblioteca...")
                sync_library()
            except Exception as e:
                safe_print(f"[Backend] Error en sync_library: {e}")

        if ChakrasPlayerAPIHandler is None:
            safe_print("[Backend] ERROR: No se pudo cargar ChakrasPlayerAPIHandler. El streaming de audio no aparecerÃ¡.")
            return
        try:
            socketserver.ThreadingTCPServer.allow_reuse_address = True
            with socketserver.ThreadingTCPServer((host, PORT), ChakrasPlayerAPIHandler) as httpd:
                safe_print(f"[Backend] Servidor iniciado en http://{host}:{PORT}")
                httpd.serve_forever()
        except Exception as e:
            safe_print(f"[Backend] CRITICAL ERROR: {e}")

    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    index_path = get_resource_path('index.html')
    safe_print(f"[Main] Buscando index.html en: {index_path}")
    if not os.path.exists(index_path):
        safe_print(f"[Main] ERROR: No se encontrÃ³ index.html en {index_path}")
    
    window = webview.create_window(
        title='ChakrasPlayer', 
        url=index_path,
        width=1320, 
        height=840,
        min_size=(1024, 600),
        background_color='#000000',
        js_api=api
    )
    
    webview.start(debug=False)

if __name__ == '__main__':
    main()
