import subprocess
import json
import time
import os
import re

try:
    import psutil
except ImportError:
    psutil = None

LAST_STATS = None
LAST_FETCH_TIME = 0.0
CACHE_DURATION = 2.0  # Faster for "gadget" feel

def get_process_list():
    """Returns top processes by CPU and RAM usage, cross-referenced with GPU data."""
    if not psutil: return []
    processes = []
    num_cores = psutil.cpu_count() or 1
    
    # 1. Get GPU process map
    gpu_map = {}
    try:
        gpu_procs = get_gpu_processes()
        for gp in gpu_procs:
            gpu_map[gp['pid']] = gp
    except: pass

    try:
        # Get all processes
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
            try:
                # Normalize CPU
                cpu_normalized = proc.info['cpu_percent'] / num_cores
                
                # Check if it has GPU data
                gpu_info = gpu_map.get(proc.info['pid'])
                gpu_vram = gpu_info['vram_mb'] if gpu_info else 0
                
                if cpu_normalized > 0.1 or proc.info['memory_percent'] > 0.1 or gpu_vram > 0:
                    processes.append({
                        "pid": proc.info['pid'],
                        "name": proc.info['name'],
                        "cpu": round(cpu_normalized, 1),
                        "ram": round(proc.info['memory_percent'], 1),
                        "gpu": gpu_vram, # MB for now
                        "is_player": "antigravity" in proc.info['name'].lower() or "python" in proc.info['name'].lower()
                    })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        # Sort by heaviest (Sum of CPU + RAM + weighted GPU)
        processes.sort(key=lambda x: x['cpu'] + x['ram'] + (x['gpu'] / 100), reverse=True)
    except:
        pass
    return processes[:10]

def get_gpu_processes():
    """Tries to identify what PIDs are using the AMD GPU."""
    gpu_procs = []
    try:
        result = subprocess.run(["rocm-smi", "--showprocs", "--json"], 
                                capture_output=True, text=True, timeout=2)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            # data is usually { "card0": { "processes": [...] } }
            for card, info in data.items():
                procs = info.get("processes", [])
                for p in procs:
                    pid = p.get("pid")
                    vram = p.get("vram", 0)
                    # Try to get name via /proc
                    name = "Unknown"
                    try:
                        with open(f"/proc/{pid}/comm", "r") as f:
                            name = f.read().strip()
                    except: pass
                    
                    gpu_procs.append({
                        "pid": pid,
                        "name": name,
                        "vram_mb": int(vram) // (1024 * 1024) if vram > 1000 else 0,
                        "is_player": "antigravity" in name.lower() or "python" in name.lower()
                    })
    except:
        pass
    return gpu_procs

CPU_EMA = None
GPU_EMA = None
ALPHA = 0.4  # Smoothing factor (0 to 1, lower is smoother)

def get_system_stats():
    global LAST_STATS, LAST_FETCH_TIME, CPU_EMA, GPU_EMA
    
    current_time = time.time()
    # If called too frequently, return cache to save resources
    if LAST_STATS is not None and (current_time - LAST_FETCH_TIME) < 1.0:
        return LAST_STATS

    stats = {
        "cpu_percent": 0.0,
        "ram_percent": 0.0,
        "gpu_percent": 0.0,
        "vram_percent": 0.0,
        "vram_used_mb": 0,
        "vram_total_mb": 0,
        "gpu_temp": 0.0,
        "gpu_name": "AMD Radeon RX 7900 XTX",
        "gpu_active": False,
        "processes": get_process_list(),
        "gpu_processes": get_gpu_processes(),
        "timestamp": current_time
    }
    
    # 1. Fetch RAW CPU/RAM
    raw_cpu = 0.0
    if psutil:
        raw_cpu = psutil.cpu_percent(interval=0.1)
        stats["ram_percent"] = psutil.virtual_memory().percent
    else:
        try:
            with open('/proc/stat', 'r') as f:
                cpu_line = f.readline().split()
                raw_cpu = round(100 - (float(cpu_line[4]) * 100 / sum(map(float, cpu_line[1:]))), 1)
            with open('/proc/meminfo', 'r') as f:
                mem = {line.split(':')[0]: int(line.split(':')[1].split()[0]) for line in f.readlines()[:5]}
                stats["ram_percent"] = round(100 - (mem.get('MemAvailable', 0) * 100 / mem.get('MemTotal', 1)), 1)
        except: pass

    # Apply EMA to CPU
    if CPU_EMA is None: CPU_EMA = raw_cpu
    else: CPU_EMA = (raw_cpu * ALPHA) + (CPU_EMA * (1 - ALPHA))
    stats["cpu_percent"] = round(CPU_EMA, 1)

    # 2. Fetch GPU via rocm-smi
    raw_gpu = 0.0
    try:
        result = subprocess.run(["rocm-smi", "-a", "-m", "--json"], 
                                capture_output=True, text=True, timeout=1.5)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            for card, info in data.items():
                if card.startswith("card") or card.startswith("device"):
                    usage = info.get("GPU use (%)") or info.get("GPU use")
                    if usage: raw_gpu = float(usage)
                    
                    temp = info.get("Temperature (Sensor edge) (C)") or info.get("Temperature (sensor edge)")
                    if temp: stats["gpu_temp"] = float(temp)
                    
                    # NEW: Get Power usage in Watts
                    power = info.get("Average Graphics Package Power (W)") or info.get("Average Graphics Package Power") or info.get("Current Socket Graphics Package Power (W)")
                    if power: stats["gpu_power"] = float(power)
                    
                    # GPU Memory Fallback (Aggressive)
                    v_total = info.get("VRAM Total Memory (B)") or info.get("VRAM Total Memory")
                    if not v_total:
                        # Fallback for 7900 XTX specifically or general AMD logic
                        stats["vram_total_mb"] = 24576 # 24GB default for this card
                    else:
                        stats["vram_total_mb"] = int(v_total) // (1024 * 1024)
                    
                    v_used = info.get("VRAM Total Used Memory (B)") or info.get("VRAM Total Used Memory")
                    if v_used:
                        stats["vram_used_mb"] = int(v_used) // (1024 * 1024)
                    
                    # Recalculate percent if possible
                    if stats["vram_total_mb"] > 0:
                        stats["vram_percent"] = round((stats["vram_used_mb"] / stats["vram_total_mb"]) * 100, 1)
                    else:
                        stats["vram_percent"] = 0

                    stats["gpu_active"] = True
                    break

        # Fallback to plain text if JSON is empty or missing keys
        if not stats.get("vram_used_mb") or stats.get("vram_total_mb") == 0:
            try:
                raw = subprocess.check_output(["rocm-smi", "--showmeminfo", "vram"], text=True)
                # Standard output parsing: "GPU[0] : VRAM Total Memory (B): 25752109056"
                import re
                t_match = re.search(r"Total Memory \(B\):\s+(\d+)", raw)
                u_match = re.search(r"Used Memory \(B\):\s+(\d+)", raw)
                
                if t_match: stats["vram_total_mb"] = int(t_match.group(1)) // (1024 * 1024)
                if u_match: stats["vram_used_mb"] = int(u_match.group(1)) // (1024 * 1024)
                
                if not stats.get("vram_total_mb"): stats["vram_total_mb"] = 24576
                if stats["vram_total_mb"] > 0:
                    stats["vram_percent"] = round((stats.get("vram_used_mb", 0) / stats["vram_total_mb"]) * 100, 1)
            except:
                if not stats.get("vram_total_mb"): stats["vram_total_mb"] = 24576
            try:
                with open("/sys/class/drm/card0/device/gpu_busy_percent", "r") as f:
                    raw_gpu = float(f.read().strip())
                    stats["gpu_active"] = True
            except: pass

    except:
        try:
            with open("/sys/class/drm/card0/device/gpu_busy_percent", "r") as f:
                raw_gpu = float(f.read().strip())
                stats["gpu_active"] = True
        except: pass

    # Apply EMA to GPU
    if GPU_EMA is None: GPU_EMA = raw_gpu
    else: GPU_EMA = (raw_gpu * ALPHA) + (GPU_EMA * (1 - ALPHA))
    stats["gpu_percent"] = round(GPU_EMA, 1)
        
    LAST_STATS = stats
    LAST_FETCH_TIME = current_time
    return stats
