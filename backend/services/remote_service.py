import subprocess
import threading
import re

remote_playback_state = {
    "isPlaying": False, "track": None, "currentTime": 0,
    "duration": 0, "volume": 1.0, "timestamp": 0  
}
remote_command_queue = []  
global_tunnel_url = None

def start_global_tunnel():
    """Inicia el túnel SSH en segundo plano para permitir conexión global"""
    global global_tunnel_url
    print("✨ Lanzando Túnel de Conexión Global...")
    try:
        process = subprocess.Popen(
            ['ssh', '-o', 'StrictHostKeyChecking=no', '-o', 'ServerAliveInterval=60', '-R', '80:localhost:5888', 'nokey@localhost.run'],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1
        )
        for line in process.stdout:
            match = re.search(r'https?://[a-z0-9]+\.lhr\.life', line)
            if match:
                global_tunnel_url = match.group(0)
                print(f"✅ TÚNEL GLOBAL ACTIVADO: {global_tunnel_url}")
    except Exception as e:
        print(f"❌ Error al iniciar túnel: {e}")

def init_remote_service():
    threading.Thread(target=start_global_tunnel, daemon=True).start()

def get_remote_status():
    return remote_playback_state

def push_remote_command(cmd):
    remote_command_queue.append(cmd)

def pop_remote_commands():
    cmds = list(remote_command_queue)
    remote_command_queue.clear()
    return cmds
