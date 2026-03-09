import webview
import os
import sys
import shutil
import hashlib
import base64
import threading
import socketserver

# Configuración del entorno PyInstaller
if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
    if sys._MEIPASS not in sys.path:
        sys.path.append(sys._MEIPASS)

# Configuración del servidor
host = "127.0.0.1"
PORT = 5888

# Importación del handler del servidor
try:
    from server import AntiGravityAPIHandler
except ImportError:
    AntiGravityAPIHandler = None

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
    """Prints to stdout with fallbacks for Unicode characters on Windows console."""
    try:
        print(msg)
    except UnicodeEncodeError:
        try:
            # Fallback for Windows consoles that don't support UTF-8
            print(msg.encode('ascii', 'replace').decode('ascii'))
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
        try:
            for root, dirs, files in os.walk(folder_path):
                for file in files:
                    if file.lower().endswith(extensions):
                        full_path = os.path.join(root, file)
                        track_id = hashlib.md5(full_path.encode('utf-8')).hexdigest()[:12]
                        tracks.append({
                            'id': track_id,
                            'fileName': file,
                            'filePath': full_path,
                            'title': os.path.splitext(file)[0],
                            'artist': 'Unknown Artist',
                            'album': 'Unknown Album',
                            'duration': 0,
                            'genre': 'Unknown'
                        })
            safe_print(f"[Scan] Success: {len(tracks)} files")
            return {'status': 'success', 'tracks': tracks}
        except Exception as e:
            safe_print(f"[Scan] ERROR: {e}")
            return {'status': 'error', 'message': str(e)}

    def edit_metadata(self, data):
        """Stub for metadata editing via bridge - avoids 405 error."""
        safe_print(f"[Bridge] Metadata Update requested: {data.get('id')}")
        return {'status': 'success', 'message': 'Metadata update received by bridge (Native)'}

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

    api = Api()
    
    # Iniciar servidor de backend en un hilo separado
    def run_server():
        if AntiGravityAPIHandler is None:
            safe_print("[Backend] ERROR: No se pudo cargar AntiGravityAPIHandler. El streaming de audio no funcionará.")
            return
        try:
            socketserver.TCPServer.allow_reuse_address = True
            with socketserver.TCPServer((host, PORT), AntiGravityAPIHandler) as httpd:
                safe_print(f"[Backend] Servidor iniciado en http://{host}:{PORT}")
                httpd.serve_forever()
        except Exception as e:
            safe_print(f"[Backend] Error: {e}")

    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    index_path = get_resource_path('index.html')
    safe_print(f"[Main] Buscando index.html en: {index_path}")
    if not os.path.exists(index_path):
        safe_print(f"[Main] ERROR: No se encontró index.html en {index_path}")
    
    window = webview.create_window(
        title='AntiGravity Music Player', 
        url=index_path,
        width=1320, 
        height=840,
        min_size=(1024, 600),
        background_color='#000000',
        js_api=api
    )
    
    webview.start(debug=True)

if __name__ == '__main__':
    main()
