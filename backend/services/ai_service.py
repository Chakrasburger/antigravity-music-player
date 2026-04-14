import os
import json
import time
import requests
import re
from backend.core.config import DRAWINGS_DIR, BASE_DIR, PLAYLISTS_DIR, USAGE_FILE, DEBUG_LOG

def get_ai_usage():
    today = time.strftime("%Y-%m-%d")
    if os.path.exists(USAGE_FILE):
        with open(USAGE_FILE, "r") as f:
            try:
                u_data = json.load(f)
                if u_data.get("date") == today: return u_data.get("count", 0)
            except: pass
    return 0

def handle_ai_chat(data, library):
    query = data.get("query", "").lower()
    user_api_key = data.get("apiKey") 
    provider = data.get("provider", "gemini")
    model_name_local = data.get("localModel", "qwen2.5:14b")
    analytics = data.get("analytics", {})
    history = data.get("history", [])
    image_b64 = data.get("image", None)
    
    usage_count = get_ai_usage()
    analytics_summary = f"Top artistas: {', '.join([a.get('artist') for a in analytics.get('topArtists', [])])}. Total: {analytics.get('totalMinutes', 0):.0f} min."

    if provider == "ollama":
        return _handle_ollama(query, library, model_name_local, history, analytics_summary, usage_count, image_b64)
    elif provider == "openrouter":
        return _handle_openrouter(query, library, user_api_key, model_name_local, analytics_summary, usage_count, image_b64)
    else:
        return _handle_gemini(query, library, user_api_key, analytics_summary, usage_count, image_b64)

def _handle_ollama(query, library, model, history, analytics_summary, usage_count, image_b64=None):
    # OLLAMA CONFIGURATION
    url = "http://127.0.0.1:11434/api/generate"
    
    # CONSTRUCT A MANDATORY SYSTEM PROMPT that is VERY AGGRESSIVE
    lib_data = json.dumps([{'t': t.get('title'), 'a': t.get('artist')} for t in library[:450]], ensure_ascii=False)
    
    system_prompt = f"""Tú eres CHAKRAS_SYSTEM (Controller). No eres un chatbot genérico.
ERES EL NÚCLEO DE CONTROL del reproductor ChakrasPlayer.

REGLAS DE HIERRO:
1. TIENES ACCESO TOTAL a la biblioteca local de música. NO DIGAS que no puedes acceder a archivos.
2. Si el usuario te pide poner música, DEBES generar un bloque JSON con la playlist.
3. NUNCA respondas con excusas de "soy un modelo basado en texto". USA LA BIBLIOTECA.
4. Si ves una canción en la 'Biblioteca' que coincide con lo que pide el usuario, ÚSALA.

BIBLIOTECA ACTUAL ({len(library)} canciones):
{lib_data}

FORMATO DE RESPUESTA OBLIGATORIO:
Saluda al usuario y describe brevemente la selección musical.
```json
{{
  "playlist": ["Nombre exacto de canción 1", "Nombre exacto de canción 2"],
  "actions": [{{ "type": "volume", "value": 50 }}]
}}
```

Si el usuario pide "las primeras 5", busca en la Biblioteca superior y dame los títulos exactos.
"""

    prompt = f"{system_prompt}\n\nHISTORIAL:\n{history}\n\nUSUARIO: {query}\n\nEJECUCIÓN CHAKRAS_SYSTEM (Manda JSON ahora):"
    
    try:
        # FORCE THE UNLOAD with keep_alive: 0
        # AGGRESSIVE GPU RELEASE MODE
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.1,
                "num_ctx": 4096,
                "repeat_penalty": 1.2,
                "num_gpu": 99 # Force all layers to GPU for faster execution and faster release
            },
            "keep_alive": 0 # Mandatory 0 for immediate VRAM/Compute release
        }

        resp = requests.post(url, json=payload, timeout=90)
        if resp.status_code == 200:
            content = resp.json().get("response", "")
            # CLEANUP: Wait for GPU to settle before returning
            time.sleep(0.5)
            content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
            return _parse_ai_response(content, library, usage_count)
    except Exception as e:
        return {"status": "error", "reply": f"Ollama Error: {e}"}
    
    return {"status": "error", "reply": "No se recibió respuesta de Ollama."}

def _handle_gemini(query, library, api_key, analytics_summary, usage_count, image_b64=None):
    if not api_key:
        return {"status": "success", "reply": "🔒 Necesitas una Gemini API Key.", "usageCount": usage_count}
    
    # Strip whitespace from API key to avoid common auth errors
    api_key = api_key.strip()
    
    # Switching to Gemini 2.5 Flash - Current 2026 Mature Standard
    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key={api_key}"
    
    # Ultra-compact sample with Numeric ID (i) to save huge amounts of tokens
    lib_sample = []
    for idx, t in enumerate(library[:250]):
        lib_sample.append({
            "i": idx, 
            "t": t.get("title")[:40], 
            "a": t.get("artist")[:30]
        })
    
    lib_json = json.dumps(lib_sample, ensure_ascii=False)
    
    system_instr = f"""NÚCLEO CHAKRAS.
1. Responde breve (español).
2. Usa bloques JSON para acciones.
3. Biblioteca (Usa el ID "i"): {lib_json}

JSON:
```json
{{
  "playlist": [IDs de canciones],
  "actions": [{{ "type": "volume", "value": 50 }}]
}}
```
"""
    
    full_prompt = f"{system_instr}\nUsuario: {query}"
    
    parts = [{"text": full_prompt}]
    if image_b64:
        try:
            clean_b64 = image_b64.split(",")[-1] if "," in image_b64 else image_b64
            mime_type = "image/jpeg"
            if image_b64.startswith("data:image/png"): mime_type = "image/png"
            parts.append({"inlineData": {"data": clean_b64, "mimeType": mime_type}})
        except: pass

    try:
        resp = requests.post(url, json={"contents": [{"parts": parts}]}, timeout=30)
        resp_json = resp.json()
        
        if resp.status_code == 200:
            if 'candidates' in resp_json and len(resp_json['candidates']) > 0:
                content = resp_json['candidates'][0]['content']['parts'][0]['text']
                return _parse_ai_response(content, library, usage_count)
            else:
                return {"status": "error", "reply": "Gemini no generó una respuesta válida (posible filtro de seguridad)."}
        else:
            # Handle specific Google API errors
            err_msg = resp_json.get('error', {}).get('message', 'Error desconocido de Google.')
            if resp.status_code == 429:
                err_msg = "Cuota de Gemini agotada (tómate un respiro o cambia de modelo)."
            elif resp.status_code == 400:
                err_msg = f"Error en la petición: {err_msg}"
            return {"status": "error", "reply": f"Gemini API Error ({resp.status_code}): {err_msg}"}
            
    except Exception as e:
        return {"status": "error", "reply": f"Error de conexión con Gemini: {str(e)}"}

def _handle_openrouter(query, library, api_key, model, analytics_summary, usage_count, image_b64=None):
    if not api_key:
        return {"status": "success", "reply": "🔒 Falta API Key de OpenRouter.", "usageCount": usage_count}
    
    url = "https://openrouter.ai/api/v1/chat/completions"
    lib_sample = json.dumps([{"title": t.get("title"), "artist": t.get("artist")} for t in library[:200]], ensure_ascii=False)
    system_msg = "Eres ChakrasAssistant. Responde español + bloque ```json para lógica."
    prompt = f"Biblioteca: {lib_sample}. Usuario: {query}."
    
    messages = [{"role": "system", "content": system_msg}, {"role": "user", "content": prompt}]
    
    try:
        resp = requests.post(url, headers={"Authorization": f"Bearer {api_key}"}, json={"model": model, "messages": messages}, timeout=30)
        if resp.status_code == 200:
            content = resp.json()['choices'][0]['message']['content']
            return _parse_ai_response(content, library, usage_count)
    except Exception as e:
        return {"status": "error", "reply": f"OpenRouter Error: {e}"}

def _parse_ai_response(full_reply, library, usage_count):
    from difflib import get_close_matches
    
    ai_playlist = []
    ai_actions = []
    
    # Extract JSON
    json_match = re.search(r"```json\s*(\{.*?\})\s*```", full_reply, re.DOTALL)
    if json_match:
        try:
            data = json.loads(json_match.group(1))
            raw_playlist = data.get("playlist", [])
            ai_actions = data.get("actions", [])
            
            # Fuzzy match titles or use IDs
            lib_titles = [t.get("title", "") for t in library]
            for item in raw_playlist:
                # If it's a number, it's our short ID (index)
                if isinstance(item, (int, float)):
                    idx = int(item)
                    if 0 <= idx < len(library):
                        ai_playlist.append(library[idx])
                else:
                    # Fallback to fuzzy title matching
                    matches = get_close_matches(str(item), lib_titles, n=1, cutoff=0.6)
                    if matches:
                        track = next((t for t in library if t.get("title") == matches[0]), None)
                        if track: ai_playlist.append(track)
        except: pass

    # Clean reply text (remove JSON block)
    display_text = re.sub(r"```json.*?```", "", full_reply, flags=re.DOTALL).strip()
    
    return {
        "status": "success",
        "reply": display_text or "Acción ejecutada.",
        "playlist": ai_playlist,
        "actions": ai_actions,
        "usageCount": usage_count
    }
