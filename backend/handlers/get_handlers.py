import json
import os
import socket
from urllib.parse import parse_qs
from backend.core.config import STATIC_DIR, BASE_DIR, PORT
from backend.services.remote_service import get_remote_status, pop_remote_commands, global_tunnel_url
from backend.services.stream_service import get_file_stream_data, get_cover_data

def handle_remote_html(handler):
    remote_path = os.path.join(STATIC_DIR, 'remote.html')
    if os.path.exists(remote_path):
        handler.send_response(200)
        handler.send_header('Content-Type', 'text/html; charset=utf-8')
        handler._send_cors_headers()
        handler.end_headers()
        with open(remote_path, 'rb') as f:
            handler.wfile.write(f.read())
    else:
        handler.send_response(404)
        handler.end_headers()

def handle_remote_status(handler):
    handler.send_response(200)
    handler.send_header('Content-type', 'application/json; charset=utf-8')
    handler._send_cors_headers()
    handler.end_headers()
    handler.wfile.write(json.dumps(get_remote_status()).encode('utf-8'))

def handle_local_ip(handler):
    def _get_lan_ip():
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except: return "127.0.0.1"

    handler.send_response(200)
    handler.send_header('Content-type', 'application/json; charset=utf-8')
    handler._send_cors_headers()
    handler.end_headers()
    handler.wfile.write(json.dumps({
        'ip': _get_lan_ip(),
        'port': PORT,
        'globalUrl': global_tunnel_url,
        'hostname': socket.gethostname()
    }).encode('utf-8'))

def handle_system_monitor(handler):
    from backend.services.hardware_service import get_system_stats
    handler.send_response(200)
    handler.send_header('Content-type', 'application/json; charset=utf-8')
    handler._send_cors_headers()
    handler.end_headers()
    handler.wfile.write(json.dumps(get_system_stats()).encode('utf-8'))

def handle_file_api(handler):
    from urllib.parse import urlparse, parse_qs
    query = parse_qs(urlparse(handler.path).query)
    filepath = query.get('path', [None])[0]
    
    if not filepath or not os.path.exists(filepath):
        handler.send_response(404)
        handler.end_headers()
        return

    status, headers, data_gen = get_file_stream_data(filepath, handler.headers)
    
    handler.send_response(status)
    for k, v in headers.items():
        handler.send_header(k, v)
    handler.end_headers()
    
    if hasattr(data_gen, '__iter__'):
        for chunk in data_gen:
            try:
                handler.wfile.write(chunk)
            except (ConnectionResetError, BrokenPipeError):
                break
    else:
        handler.wfile.write(data_gen)

def handle_cover_api(handler):
    from urllib.parse import urlparse, parse_qs
    query = parse_qs(urlparse(handler.path).query)
    filepath = query.get('path', [None])[0]
    
    if not filepath:
        handler.send_response(400)
        handler.end_headers()
        return

    img_data, mime = get_cover_data(filepath)
    if img_data:
        handler.send_response(200)
        handler.send_header('Content-Type', mime or 'image/jpeg')
        handler.send_header('Cache-Control', 'max-age=86400')
        handler._send_cors_headers()
        handler.end_headers()
        handler.wfile.write(img_data)
    else:
        # Fallback to no-cover image or 404
        handler.send_response(404)
        handler.end_headers()
