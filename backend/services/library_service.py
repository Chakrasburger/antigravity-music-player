import os
import json
import time
from backend.core.config import CARPETA_MUSICA, ARCHIVO_ENTRADA, ARCHIVO_SALIDA
from backend.core.utils import ffprobe_duration, fetch_cover_image

def sync_library():
    """Escanea la carpeta music y agrega canciones nuevas al JSON automáticamente."""
    print("🔄 Sincronizando biblioteca local...")
    try:
        if not os.path.exists(CARPETA_MUSICA):
            os.makedirs(CARPETA_MUSICA)
            return
        
        catalogo = []
        if os.path.exists(ARCHIVO_ENTRADA):
            with open(ARCHIVO_ENTRADA, "r", encoding="utf-8") as f:
                try: catalogo = json.load(f)
                except: pass
                
        biblioteca = []
        if os.path.exists(ARCHIVO_SALIDA):
            with open(ARCHIVO_SALIDA, "r", encoding="utf-8") as f:
                try: biblioteca = json.load(f)
                except: pass

        extensiones_validas = ('.mp3', '.m4a', '.wav', '.flac', '.ogg', '.opus', '.webm')
        archivos_en_disco = [f for f in os.listdir(CARPETA_MUSICA) if f.lower().endswith(extensiones_validas)]
        
        files_in_library = {item.get("filePath", "").split("/")[-1]: item for item in biblioteca}
        new_files = [f for f in archivos_en_disco if f not in files_in_library]
        files_to_repair = [item for item in biblioteca if not item.get("coverUrl") or not item.get("duration")]

        if not new_files and not files_to_repair:
            print("✅ Biblioteca al día.")
            return

        from mutagen import File as MutagenFile
        import urllib.parse

        def extract_info(ruta_abs, filename):
            artista = "Unknown Artist"
            titulo = filename.rsplit(".", 1)[0]
            if " - " in titulo:
                partes = titulo.split(" - ", 1)
                artista = partes[0].strip()
                titulo = partes[1].strip()
            
            duration = 0
            cover_url = None
            lyrics = None
            ext_lower = os.path.splitext(ruta_abs)[1].lower()
            
            try:
                audio = MutagenFile(ruta_abs)
                if audio:
                    if hasattr(audio, 'info') and audio.info:
                        duration = audio.info.length
                    if audio.tags:
                        tags = audio.tags
                        if 'TIT2' in tags: titulo = str(tags['TIT2'])
                        elif 'title' in tags: titulo = str(tags['title'][0])
                        if 'TPE1' in tags: artista = str(tags['TPE1'])
                        elif 'artist' in tags: artista = str(tags['artist'][0])
                        
                        if 'lyrics' in tags: lyrics = str(tags['lyrics'][0])
                        else:
                            for key in tags.keys():
                                if key.startswith(('USLT', 'SYLT', 'LYRICS')) or key == '©lyr':
                                    lyrics = str(tags[key])
                                    break
                        
                        has_cover = hasattr(audio, 'pictures') and audio.pictures or any(k.startswith('APIC') for k in tags.keys())
                        if has_cover:
                            cover_url = f"/api/cover?path={urllib.parse.quote(ruta_abs)}&s=400"
            except: pass
            
            if duration == 0:
                duration = ffprobe_duration(ruta_abs)
            
            return titulo, artista, duration, cover_url, lyrics

        for item in files_to_repair:
            f_path = os.path.normpath(item.get("filePath", ""))
            if os.path.exists(f_path):
                t, a, d, c, l = extract_info(f_path, os.path.basename(f_path))
                if not item.get("coverUrl"): item["coverUrl"] = c
                if not item.get("duration"): item["duration"] = d
                if item.get("title") == os.path.basename(f_path).rsplit(".", 1)[0]: item["title"] = t
                if item.get("artist") == "Unknown Artist": item["artist"] = a
                if not item.get("lyrics"): item["lyrics"] = l

        next_id = max([int(item.get("id", 0)) for item in biblioteca if str(item.get("id")).isdigit()] + [0]) + 1 if biblioteca else 1

        for f in new_files:
            ruta_abs = os.path.normpath(os.path.join(CARPETA_MUSICA, f))
            t, a, d, c, l = extract_info(ruta_abs, f)
            nuevo_track = {
                "id": next_id, "title": t, "artist": a, "album": "Importado Local",
                "filePath": ruta_abs.replace("\\", "/"), "duration": d, "coverUrl": c,
                "lyrics": l, "dateAdded": int(time.time() * 1000)
            }
            if not any(c.get('title') == t and c.get('artist') == a for c in catalogo):
                catalogo.append({"title": t, "artist": a, "album": "Importado Local", "genre": "Local"})
            biblioteca.append(nuevo_track)
            next_id += 1

        with open(ARCHIVO_ENTRADA, "w", encoding="utf-8") as f_in:
            json.dump(catalogo, f_in, indent=2, ensure_ascii=False)
        with open(ARCHIVO_SALIDA, "w", encoding="utf-8") as f_out:
            json.dump(biblioteca, f_out, indent=2, ensure_ascii=False)
            
        print(f"📊 Sincronización completada. Total: {len(biblioteca)} canciones.")
    except Exception as e:
        print(f"❌ Error en sincronización: {e}")

def write_metadata(file_path, data):
    """Writes metadata tags to MP3, FLAC, or M4A/MP4 files."""
    if not file_path or not os.path.exists(file_path):
        return False

    ext = os.path.splitext(file_path)[1].lower()
    try:
        if ext == '.mp3':
            from mutagen.id3 import ID3, TIT2, TPE1, TALB, TDRC, TCON, APIC, USLT, ID3NoHeaderError
            try: audio = ID3(file_path)
            except ID3NoHeaderError: audio = ID3()
            if data.get('title'): audio["TIT2"] = TIT2(encoding=3, text=data['title'])
            if data.get('artist'): audio["TPE1"] = TPE1(encoding=3, text=data['artist'])
            if data.get('album'): audio["TALB"] = TALB(encoding=3, text=data['album'])
            if data.get('year'): audio["TDRC"] = TDRC(encoding=3, text=str(data['year']))
            if data.get('genre'): audio["TCON"] = TCON(encoding=3, text=data['genre'])
            if data.get('lyrics'): audio.setall("USLT", [USLT(encoding=3, lang='eng', desc='lyrics', text=data['lyrics'])])
            img_data, mime = fetch_cover_image(data)
            if img_data: audio.add(APIC(encoding=3, mime=mime, type=3, desc=u'Front cover', data=img_data))
            audio.save(file_path)
            return True
        elif ext == '.flac':
            from mutagen.flac import FLAC, Picture
            audio = FLAC(file_path)
            if data.get('title'):  audio['title'] = [data['title']]
            if data.get('artist'): audio['artist'] = [data['artist']]
            if data.get('album'):  audio['album'] = [data['album']]
            if data.get('year'):   audio['date'] = [str(data['year'])]
            if data.get('genre'):  audio['genre'] = [data['genre']]
            if data.get('lyrics'): audio['lyrics'] = [data['lyrics']]
            img_data, mime = fetch_cover_image(data)
            if img_data:
                pic = Picture()
                pic.type, pic.mime, pic.data = 3, mime, img_data
                audio.clear_pictures()
                audio.add_picture(pic)
            audio.save()
            return True
        elif ext in ('.m4a', '.mp4'):
            from mutagen.mp4 import MP4, MP4Cover
            audio = MP4(file_path)
            if audio.tags is None: audio.add_tags()
            if data.get('title'):  audio.tags['\xa9nam'] = [data['title']]
            if data.get('artist'): audio.tags['\xa9ART'] = [data['artist']]
            if data.get('album'):  audio.tags['\xa9alb'] = [data['album']]
            if data.get('year'):   audio.tags['\xa9day'] = [str(data['year'])]
            if data.get('genre'):  audio.tags['\xa9gen'] = [data['genre']]
            if data.get('lyrics'): audio.tags['\xa9lyr'] = [data['lyrics']]
            img_data, mime = fetch_cover_image(data)
            if img_data:
                img_format = MP4Cover.FORMAT_JPEG if 'jp' in mime else MP4Cover.FORMAT_PNG
                audio.tags['covr'] = [MP4Cover(img_data, imageformat=img_format)]
            audio.save()
            return True
    except Exception as e:
        print(f"❌ Metadata error for {file_path}: {e}")
    return False
