import threading
import webview
import socketserver
import time
import os
import sys
from server import AntiGravityAPIHandler, PORT, BASE_DIR, STATIC_DIR

def start_server():
    os.chdir(STATIC_DIR)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), AntiGravityAPIHandler) as httpd:
        httpd.serve_forever()

class Api:
    def pick_folder(self):
        result = window.create_file_dialog(webview.FOLDER_DIALOG)
        return result[0] if result else None

    def read_file_base64(self, file_path):
        import base64
        import os
        try:
            # Normalize path for Windows
            file_path = os.path.normpath(file_path)
            if not os.path.isabs(file_path):
                 # Fallback to descarga_canciones if relative
                 file_path = os.path.join(os.getcwd(), "descarga_canciones", file_path)
            
            if os.path.exists(file_path):
                with open(file_path, 'rb') as f:
                    return base64.b64encode(f.read()).decode('utf-8')
            return None
        except Exception as e:
            print(f"Error reading file via bridge: {e}")
            return None

if __name__ == '__main__':
    # Configurar el directorio de trabajo según si es .exe o no
    if getattr(sys, 'frozen', False):
        application_path = os.path.dirname(sys.executable)
    else:
        application_path = os.path.dirname(os.path.abspath(__file__))
    
    os.chdir(application_path)

    # Iniciar el servidor local en un hilo paralelo
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    time.sleep(0.5) # Esperar a que el puerto se abra

    api = Api()

    # Abrir la ventana de la aplicación web nativa
    window = webview.create_window(
        title='AntiGravity Music Player', 
        url=f'http://localhost:{PORT}',
        width=1280, 
        height=800,
        min_size=(1024, 600),
        background_color='#000000',
        js_api=api
    )
    
    webview.start()
