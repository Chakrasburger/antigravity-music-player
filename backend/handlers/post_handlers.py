import json
from backend.services.download_service import get_yt_search, trigger_download
from backend.services.ai_service import handle_ai_chat
from backend.services.library_service import sync_library

def handle_yt_search_api(handler, data):
    query = data.get('query', '')
    if not query:
        handler.send_response(400)
        handler.end_headers()
        return
    results = get_yt_search(query)
    handler.send_response(200)
    handler.send_header('Content-type', 'application/json; charset=utf-8')
    handler._send_cors_headers()
    handler.end_headers()
    handler.wfile.write(json.dumps({'status': 'success', 'results': results}).encode('utf-8'))

def handle_download_api(handler, data):
    res = trigger_download(data)
    handler.send_response(200)
    handler.send_header('Content-type', 'application/json; charset=utf-8')
    handler._send_cors_headers()
    handler.end_headers()
    handler.wfile.write(json.dumps(res).encode('utf-8'))

def handle_ai_chat_api(handler, data):
    # This expects library data from the frontend
    library = data.get("library", [])
    res = handle_ai_chat(data, library)
    handler.send_response(200)
    handler.send_header('Content-type', 'application/json; charset=utf-8')
    handler._send_cors_headers()
    handler.end_headers()
    handler.wfile.write(json.dumps(res).encode('utf-8'))

def handle_sync_api(handler):
    sync_library()
    handler.send_response(200)
    handler._send_cors_headers()
    handler.end_headers()
    handler.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))
