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

def handle_lyrics_search_api(handler, data):
    """Search for lyrics using LRCLIB API"""
    title = data.get('title', '')
    artist = data.get('artist', '')
    
    if not title or not artist:
        handler.send_response(400)
        handler.send_header('Content-type', 'application/json')
        handler._send_cors_headers()
        handler.end_headers()
        handler.wfile.write(json.dumps({'status': 'error', 'message': 'Title and artist are required'}).encode())
        return
    
    lyrics = fetch_lyrics_lrclib(title, artist)
    
    handler.send_response(200)
    handler.send_header('Content-type', 'application/json; charset=utf-8')
    handler._send_cors_headers()
    handler.end_headers()
    handler.wfile.write(json.dumps({'status': 'success', 'lyrics': lyrics}).encode('utf-8'))

def fetch_lyrics_lrclib(track_name, artist):
    """Fetch lyrics from LRCLIB API"""
    try:
        import requests
        from urllib.parse import quote
        
        url = f"https://lrclib.net/api/get?artist_name={quote(artist)}&track_name={quote(track_name)}"
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            # Prefer synced lyrics, fallback to plain lyrics
            return data.get('syncedLyrics') or data.get('plainLyrics')
    except Exception as e:
        print(f"[Lyrics] Error fetching from LRCLIB: {e}")
    return None
