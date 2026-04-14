const HardwareMonitor = ({ stats }) => {
    if (!stats) return null;

    const vramColor = stats.vram_percent > 90 ? '#ef4444' : stats.vram_percent > 70 ? '#f59e0b' : '#10b981';
    
    // Calculate useful VRAM info
    const totalVramMB = stats.vram_total_mb || 24576; // Default to 24GB for 7900 XTX if 0
    const vramUsedGB = (stats.vram_used_mb / 1024).toFixed(1);
    const vramTotalGB = (totalVramMB / 1024).toFixed(0);
    const vramFreeGB = Math.max(0, (totalVramMB - stats.vram_used_mb) / 1024).toFixed(1);
    
    // Safety percentage
    const vramPerc = stats.vram_percent || (stats.vram_used_mb / totalVramMB * 100);

    return (
        <div className="hardware-monitor-card glass-panel p-4 rounded-xl border border-white/5 shadow-2xl animate-in fade-in zoom-in duration-500 overflow-hidden">
            {/* Header: Pro Admin Style */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
                        <i className="fa-solid fa-microchip text-lg"></i>
                    </div>
                    <div>
                        <h3 className="text-xs font-black text-white uppercase tracking-wider">Chakras Performance</h3>
                        <p className="text-[9px] text-white/30 font-mono">AMD ROCM 6.0 • 7900 XTX</p>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                        <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-widest">Master Monitor</span>
                    </div>
                </div>
            </div>

            {/* Top Stats Bar: Dashboard Style */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-white/[0.03] p-2.5 rounded-lg border border-white/5 text-center">
                    <div className="text-[9px] font-bold text-white/20 uppercase mb-1">CPU Total</div>
                    <div className="text-sm font-mono font-bold text-white/90">{stats.cpu_percent}%</div>
                </div>
                <div className="bg-white/[0.03] p-2.5 rounded-lg border border-white/5 text-center">
                    <div className="text-[9px] font-bold text-white/20 uppercase mb-1">RAM Total</div>
                    <div className="text-sm font-mono font-bold text-white/90">{stats.ram_percent}%</div>
                </div>
                <div className="bg-white/[0.03] p-2.5 rounded-lg border border-white/5 text-center">
                    <div className="text-[9px] font-bold text-white/20 uppercase mb-1">Potencia</div>
                    <div className="text-sm font-mono font-bold text-emerald-400">{stats.gpu_power ? Math.round(stats.gpu_power) : '32'}W</div>
                </div>
            </div>

            {/* GPU Detail: Windows Center Style */}
            <div className="relative p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 via-black/40 to-purple-950/40 border border-white/10 shadow-inner mb-4 overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10">
                    <i className="fa-solid fa-bolt-lightning text-4xl text-indigo-400"></i>
                </div>
                
                <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-bold text-indigo-300 flex items-center gap-2">
                        <i className="fa-solid fa-server"></i> {stats.gpu_name}
                    </span>
                    <span className="text-xs font-mono text-white/80">{stats.gpu_temp}°C</span>
                </div>

                <div className="space-y-4">
                    {/* GPU Utilization */}
                    <div>
                        <div className="flex justify-between text-[10px] items-end mb-1.5">
                            <span className="text-white/40 uppercase font-bold tracking-tight">Utilización de GPU</span>
                            <span className="text-white font-mono">{stats.gpu_percent}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5 p-[1px]">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-700" 
                                 style={{ width: `${stats.gpu_percent}%` }}></div>
                        </div>
                    </div>

                    {/* VRAM Dashboard */}
                    <div>
                        <div className="flex justify-between text-[10px] items-end mb-1.5">
                            <span className="text-white/40 uppercase font-bold tracking-tight">Memoria de Video (VRAM)</span>
                            <div className="text-right leading-tight">
                                <div className="text-white font-mono text-xs">{vramUsedGB} GB <span className="text-white/20">/ {vramTotalGB} GB</span></div>
                                <div className="text-[8px] text-emerald-400 font-mono uppercase">Libre: {vramFreeGB} GB</div>
                            </div>
                        </div>
                        <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5 p-[1px]">
                            <div className="h-full rounded-full transition-all duration-1000" 
                                 style={{ width: `${vramPerc}%`, backgroundColor: vramColor, boxShadow: `0 0 10px ${vramColor}44` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Administrador de Tareas (Expanded List) */}
            <div className="task-manager-view bg-black/40 rounded-xl border border-white/5 overflow-hidden">
                <div className="bg-white/5 p-2 px-3 border-b border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <i className="fa-solid fa-rectangle-list text-indigo-400 text-[10px]"></i>
                        <span className="text-[9px] font-black text-white/50 uppercase">Procesos en Tiempo Real</span>
                    </div>
                    <span className="text-[8px] font-mono text-white/30 tracking-widest">{stats.processes?.length || 0} ACTIVOS</span>
                </div>
                
                <div className="max-h-[180px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-[9px] text-left border-collapse">
                        <thead className="sticky top-0 bg-zinc-900 border-b border-white/5 z-10">
                            <tr className="text-white/20 font-mono uppercase text-[8px]">
                                <th className="p-2 pl-3 font-normal">Aplicación</th>
                                <th className="p-2 font-normal text-right">CPU %</th>
                                <th className="p-2 font-normal text-right pr-3">Mem %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.processes?.map((proc, i) => (
                                <tr key={i} className={`border-b border-white/[0.02] hover:bg-white/[0.04] transition-colors ${proc.is_player ? 'bg-indigo-500/[0.03]' : ''}`}>
                                    <td className="p-2 pl-3 truncate max-w-[170px]">
                                        <div className="flex items-center gap-2">
                                            {proc.is_player ? 
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> : 
                                                <div className="w-1.5 h-1.5 rounded-full bg-white/10"></div>
                                            }
                                            <span className={`truncate text-[10px] ${proc.is_player ? 'text-indigo-300 font-bold' : 'text-white/60 text-[10px]'}`}>{proc.name}</span>
                                        </div>
                                    </td>
                                    <td className={`p-2 font-mono text-right text-[10px] ${proc.cpu > 5 ? 'text-orange-400 font-bold' : 'text-white/40'}`}>{proc.cpu.toFixed(1)}%</td>
                                    <td className="p-2 pr-3 font-mono text-right text-[10px] text-white/30">{proc.ram.toFixed(1)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-4 flex flex-col items-center gap-1 border-t border-white/5 pt-3">
                <div className="flex items-center gap-2 opacity-20">
                    <span className="text-[7px] font-black text-white uppercase tracking-[0.3em]">Hardware Abstraction Layer</span>
                </div>
                <div className="text-[7px] text-white/10 font-mono">NODE_ID: {stats.timestamp?.toString().slice(-4)} • ROCM_ACTIVE</div>
            </div>
        </div>
    );
};

window.HardwareMonitor = React.memo(HardwareMonitor);
