import http.server
import socketserver
import json
import os
import sys
from urllib.parse import urlparse

# Ensure we can import from the current directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.core.config import PORT, STATIC_DIR
from backend.services.library_service import sync_library
from backend.services.remote_service import init_remote_service
from backend.handlers.get_handlers import handle_local_ip, handle_remote_status, handle_remote_html, handle_system_monitor, handle_file_api, handle_cover_api
from backend.handlers.post_handlers import handle_yt_search_api, handle_download_api, handle_ai_chat_api, handle_sync_api, handle_lyrics_search_api

class ModularChakrasHandler(http.server.SimpleHTTPRequestHandler):
    
    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/local-ip':
            handle_local_ip(self)
        elif parsed_path.path == '/api/remote/status':
            handle_remote_status(self)
        elif parsed_path.path == '/remote':
            handle_remote_html(self)
        elif parsed_path.path == '/api/system-monitor':
            handle_system_monitor(self)
        elif parsed_path.path == '/api/file':
            handle_file_api(self)
        elif parsed_path.path == '/api/cover':
            handle_cover_api(self)
        else:
            # Serve static files from STATIC_DIR
            os.chdir(STATIC_DIR)
            return super().do_GET()

    def do_POST(self):
        parsed_path = urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode('utf-8')) if post_data else {}

        if parsed_path.path == '/api/search':
            handle_yt_search_api(self, data)
        elif parsed_path.path == '/api/download':
            handle_download_api(self, data)
        elif parsed_path.path == '/api/ai-chat':
            handle_ai_chat_api(self, data)
        elif parsed_path.path == '/api/sync':
            handle_sync_api(self)
        elif parsed_path.path == '/api/lyrics/search':
            handle_lyrics_search_api(self, data)
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == "__main__":
    print(f"🚀 Iniciando Servidor Modular en puerto {PORT}...")
    init_remote_service()
    sync_library()
    
    with socketserver.TCPServer(("", PORT), ModularChakrasHandler) as httpd:
        print(f"✨ ChakrasPlayer Backend Online: http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Servidor detenido.")
            httpd.server_close()
