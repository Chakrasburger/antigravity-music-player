import os
import time
import json
import threading
from backend.core.config import CARPETA_MUSICA, ARCHIVO_SALIDA
from backend.services.library_service import write_metadata, sync_library

download_progress = {}

def get_yt_search(query):
    import yt_dlp
    ydl_opts = {'extract_flat': True, 'quiet': True, 'no_warnings': True}
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            result = ydl.extract_info(f"ytsearch25:{query}", download=False)
            entries = result.get('entries', [])
            resultados = []
            for video in entries:
                duracion = video.get('duration')
                dur_str = f"{int(duracion)//60}:{int(duracion)%60:02d}" if duracion else "--:--"
                thumbnails = video.get('thumbnails', [])
                resultados.append({
                    'id': video.get('id'),
                    'url': video.get('url') or ("https://www.youtube.com/watch?v=" + video.get('id')),
                    'title': video.get('title', 'Desconocido'),
                    'uploader': video.get('uploader', 'Canal Desconocido'),
                    'duration': dur_str,
                    'thumbnail': thumbnails[-1]['url'] if thumbnails else ''
                })
            return resultados
        except Exception as e:
            print(f"Error en búsqueda YT: {e}")
            return []

def trigger_download(video_data):
    video_id = video_data.get('id')
    download_thread = threading.Thread(target=_download_worker, args=(video_data,))
    download_thread.start()
    return {"status": "started", "id": video_id}

def _download_worker(video_data):
    import yt_dlp
    video_id = video_data.get('id')
    title = video_data.get('title', 'Unknown')
    artist = video_data.get('uploader', 'Unknown')
    
    file_path_base = os.path.join(CARPETA_MUSICA, f"{video_id}")
    
    def progress_hook(d):
        if d['status'] == 'downloading':
            p = d.get('_percent_str', '0%').replace('%', '').strip()
            download_progress[video_id] = p

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': file_path_base + '.%(ext)s',
        'progress_hooks': [progress_hook],
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_data['url']])
        
        final_mp3 = file_path_base + ".mp3"
        if os.path.exists(final_mp3):
            # Write metadata
            write_metadata(final_mp3, {
                'title': title,
                'artist': artist,
                'coverUrl': video_data.get('thumbnail')
            })
            download_progress[video_id] = '100.0'
            sync_library()
    except Exception as e:
        print(f"Error downloading {video_id}: {e}")
        download_progress[video_id] = 'error'
