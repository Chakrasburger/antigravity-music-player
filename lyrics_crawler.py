import os
import json
import re
import urllib.parse
import requests
import time
from server import write_metadata

# Rutas
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "Descarga canciones", "biblioteca_lista.json")

def clean_title(title):
    return re.sub(r'(?i)[\[\(].*?(official|music|video|audio|lyric|remaster).*?[\]\)]', '', title).strip()

def has_synced_time(lyrics):
    if not lyrics: return False
    return bool(re.search(r'\[\d{2}:\d{2}\.\d{2,3}\]', lyrics))

def run_crawler():
    print("🎶 Iniciando ChakrasPlayer Lyrics Crawler 🎶")
    print("------------------------------------------")
    
    if not os.path.exists(DB_PATH):
        print("[!] No se encontro la biblioteca_lista.json")
        return

    with open(DB_PATH, 'r', encoding='utf-8') as f:
        biblioteca = json.load(f)

    total = len(biblioteca)
    modificados = 0

    print(f"[*] Analizando {total} pistas para agregar Synced Lyrics...")

    try:
        for i, track in enumerate(biblioteca):
            # Verificar si ya tiene letras sincronizadas validas
            if has_synced_time(track.get('lyrics')):
                continue
    
            title = track.get('title', 'Unknown Title')
            artist = track.get('artist', 'Unknown Artist')
            album = track.get('album', '')
            duration = float(track.get('duration', 0))
    
            if artist == "Unknown Artist" or title == "Unknown Title":
                continue
    
            c_title = clean_title(title)
            
            # Consultar LRCLIB
            try:
                album_q = f"&album_name={urllib.parse.quote(album)}" if album and album != 'Unknown Album' else ""
                dur_q = f"&duration={round(duration)}" if duration > 0 else ""
                url = f"https://lrclib.net/api/get?track_name={urllib.parse.quote(c_title)}&artist_name={urllib.parse.quote(artist)}{album_q}{dur_q}"
                
                res = requests.get(url, timeout=5)
                if res.status_code == 200:
                    data = res.json()
                    synced_lyrics = data.get('syncedLyrics')
                    
                    if synced_lyrics:
                        track['lyrics'] = synced_lyrics
                        
                        # Escribir metadatos fisicos al MP3 directamente
                        file_path = track.get('filePath')
                        if file_path and os.path.exists(file_path):
                            # Escribir a ID3 usando la funcion existente de server.py
                            write_ok = write_metadata(file_path, track)
                            if write_ok:
                                modificados += 1
                                print(f"[{i}/{total}] [+] SYNCED: {artist} - {title}")
                            else:
                                print(f"[{i}/{total}] [-] Falló insersión ID3: {artist} - {title}")
                    else:
                        # Alternativa texto plano si no se ubica sincronizada
                        plain = data.get('plainLyrics')
                        if plain:
                            if track.get('lyrics') != plain:
                                track['lyrics'] = plain
                                file_path = track.get('filePath')
                                if file_path and os.path.exists(file_path):
                                    write_metadata(file_path, track)
                                print(f"[{i}/{total}] [~] PLAIN : {artist} - {title}")
                        else:
                            pass
            except Exception as e:
                pass # Ignoramos timeout o limites, continua
    
            # Pequeno delay para no saturar LRCLIB y ser baneados
            time.sleep(0.3)
    except KeyboardInterrupt:
        print("\n\n[!] Detenido manualmente. Guardando progreso...")

    # Guardar en BD para que la proxima lectura nativa lo tenga todo
    with open(DB_PATH, 'w', encoding='utf-8') as f:
        json.dump(biblioteca, f, indent=2, ensure_ascii=False)
    print(f"\n✨ ¡Crawler terminado! Se sincronizaron {modificados} pistas con formato de Karaoke.")

if __name__ == '__main__':
    run_crawler()
