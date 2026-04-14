import os
import re
import mimetypes

def get_file_stream_data(filepath, request_headers):
    """
    Handles partial content (Range) requests for audio/video streaming.
    Returns (status_code, headers, stream_generator_or_bytes)
    """
    if not os.path.exists(filepath):
        return 404, {}, b"File not found"

    file_size = os.path.getsize(filepath)
    content_type, _ = mimetypes.guess_type(filepath)
    if not content_type:
        content_type = 'application/octet-stream'

    range_header = request_headers.get('Range')
    
    headers = {
        'Content-Type': content_type,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
    }

    if range_header:
        # Format: bytes=start-end
        match = re.search(r'bytes=(\d+)-(\d*)', range_header)
        if match:
            start = int(match.group(1))
            end = match.group(2)
            end = int(end) if end else file_size - 1

            if start >= file_size:
                return 416, {}, b"Requested range not satisfiable"
            
            if end >= file_size:
                end = file_size - 1
            
            content_length = end - start + 1
            headers['Content-Range'] = f'bytes {start}-{end}/{file_size}'
            headers['Content-Length'] = str(content_length)
            
            # We return a function that reads the file chunk by chunk
            def generate_chunks():
                with open(filepath, 'rb') as f:
                    f.seek(start)
                    remaining = content_length
                    while remaining > 0:
                        chunk_size = min(remaining, 64 * 1024) # 64KB chunks
                        data = f.read(chunk_size)
                        if not data:
                            break
                        yield data
                        remaining -= len(data)
            
            return 206, headers, generate_chunks()

    # No range requested, send full file
    headers['Content-Length'] = str(file_size)
    
    def generate_full():
        with open(filepath, 'rb') as f:
            while True:
                data = f.read(64 * 1024)
                if not data:
                    break
                yield data

    return 200, headers, generate_full()

def get_cover_data(filepath):
    """Extracts cover image from audio file tags."""
    try:
        from mutagen import File
        audio = File(filepath)
        if audio is None: return None, None

        # ID3 (MP3)
        if hasattr(audio, 'tags') and audio.tags:
            for key in audio.tags.keys():
                if key.startswith('APIC'):
                    apic = audio.tags[key]
                    return apic.data, apic.mime
        
        # FLAC / Vorbis
        if hasattr(audio, 'pictures') and audio.pictures:
            pic = audio.pictures[0]
            return pic.data, pic.mime
    except:
        pass
    return None, None
