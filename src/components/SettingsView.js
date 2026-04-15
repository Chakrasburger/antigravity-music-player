// src/components/SettingsView.js
// ChakrasPlayer - Settings View Component
// Requiere globals: React

const SettingsView = ({
    settingsTab,
    setSettingsTab,
    remoteEnabled,
    setRemoteEnabled,
    globalTunnelUrl,
    isLanReachable,
    localIp,
    serverPort,
    addToast,
    themeSettings,
    setThemeSettings,
    handleManualSaveTheme,
    performanceMode,
    togglePerformanceMode,
    isEqEnabled,
    toggleEq,
    eqPreset,
    applyEqPreset,
    eqBands,
    handleEqChange,
    handleDeviceSelect,
    audioDeviceId,
    clearLibrary,
    setLibrary,
    crossfade,
    setCrossfade,
    isAutoplay,
    setIsAutoplay,
    isNormalize,
    setIsNormalize,
    isGapless,
    setIsGapless,
    library,
    userPlaylists,
    aiProvider,
    localModel
}) => {
    const safeTheme = {
        primaryColor: themeSettings?.primaryColor || '#5865f2',
        blur: themeSettings?.blur !== undefined ? themeSettings.blur : 30,
        saturate: themeSettings?.saturate !== undefined ? themeSettings.saturate : 210,
        opacity: themeSettings?.opacity !== undefined ? themeSettings.opacity : 70,
        baseTheme: themeSettings?.baseTheme || '',
        backgroundColor: themeSettings?.backgroundColor || ''
    };

    const [sysStats, setSysStats] = React.useState(null);
    const [libAnalytics, setLibAnalytics] = React.useState({ hours: 0, enriched: 0 });

    React.useEffect(() => {
        let interval;
        if (settingsTab === 'advanced') {
            const fetchStats = async () => {
                try {
                    const res = await fetch('http://127.0.0.1:5888/api/system-monitor');
                    if (res.ok) setSysStats(await res.json());
                } catch (e) {}
            };
            fetchStats();
            interval = setInterval(fetchStats, 2000);
        }
        return () => { if (interval) clearInterval(interval); };
    }, [settingsTab]);

    React.useEffect(() => {
        if (settingsTab === 'about') {
            let dur = 0;
            let enr = 0;
            library.forEach(t => {
                if (t.duration) dur += t.duration;
                if (t.is_enriched) enr++;
            });
            setLibAnalytics({ hours: Math.floor(dur / 3600), enriched: enr });
        }
    }, [settingsTab, library]);

    const ToggleSwitch = ({ active, onClick, iconOn, iconOff }) => (
        <button onClick={onClick} className={`relative w-14 h-7 rounded-full shadow-inner transition-colors duration-400 ${active ? 'bg-discord-blurple' : 'bg-black/50 border border-white/10'}`}>
            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-400 flex items-center justify-center ${active ? 'translate-x-7' : 'translate-x-0.5'}`}>
                {iconOn && iconOff && <i className={`fa-solid ${active ? iconOn + ' text-discord-blurple' : iconOff + ' text-black/40'} text-[10px]`}></i>}
            </div>
        </button>
    );

    const IosSlider = ({ min, max, value, onChange, accentColor }) => {
        const val = value !== undefined ? value : min;
        const perc = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
        return (
            <div className="relative w-full h-8 bg-black/40 rounded-xl overflow-hidden shadow-inner border border-white/5 mt-2 group">
                <div 
                    className="absolute top-0 left-0 h-full transition-all duration-75 ease-out pointer-events-none"
                    style={{ width: `${perc}%`, backgroundColor: accentColor || '#5865f2' }}
                >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                    <div className="absolute top-0 right-0 h-full w-1.5 bg-white/30 rounded-r-full shadow-[-2px_0_4px_rgba(0,0,0,0.3)] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                <input 
                    type="range" min={min} max={max} value={val} onChange={onChange} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer m-0" 
                />
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-6 w-full min-h-[100vh] p-6 md:p-10 animate-in fade-in duration-700 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 rounded-3xl border border-white/5 shadow-lg" style={{ 
                background: 'rgba(0,0,0,0.7)', 
                backdropFilter: 'blur(20px)', 
                WebkitBackdropFilter: 'blur(20px)',
                marginBottom: '20px'
            }}>
                <div className="relative z-10 flex-1">
                    <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-4" style={{ 
                        textShadow: '0 2px 8px rgba(0,0,0,0.8)', 
                        justifySelf: 'center',
                        margin: '0 auto'
                    }}>
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-discord-blurple text-white shadow-[0_0_25px_rgba(88,101,242,0.5)]" style={{ marginBottom: '0' }}>
                           <i className="fa-solid fa-gear text-xl"></i>
                        </div>
                        Configuración
                    </h2>
                    <p className="text-sm mt-2" style={{ 
                        color: '#ffffff', 
                        opacity: 0.9,
                        textAlign: 'center',
                        width: '100%',
                        display: 'block'
                    }}>Personaliza tu experiencia auditiva y sistema motorizado de IA.</p>
                </div>
            </div>

            {/* Navigation Pills */}
            <div className="flex flex-wrap p-2 rounded-[20px] border border-white/10 w-fit shadow-[0_8px_32px_rgba(0,0,0,0.3)] gap-2 z-10 sticky top-0 mx-auto sm:mx-0" style={{ background: 'rgba(0,0,0,0.6)' }}>
                {[
                    { id: 'appearance', icon: 'fa-wand-magic-sparkles', label: 'Apariencia' },
                    { id: 'audio', icon: 'fa-headphones-simple', label: 'Audio' },
                    { id: 'playback', icon: 'fa-circle-play', label: 'Reproducción' },
                    { id: 'connection', icon: 'fa-satellite-dish', label: 'Conexión' },
                    { id: 'advanced', icon: 'fa-microchip', label: 'Sistema' },
                    { id: 'about', icon: 'fa-circle-info', label: 'Acerca de' },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setSettingsTab(tab.id)}
                        className={`px-5 py-2.5 text-[13px] font-bold rounded-xl transition-all duration-300 flex items-center gap-2 ${settingsTab === tab.id ? 'bg-white text-black shadow-[0_4px_15px_rgba(255,255,255,0.2)] scale-[1.02]' : 'text-white/60 hover:text-white hover:bg-white/10'}`}>
                        <i className={`fa-solid ${tab.icon}`}></i> {tab.label}
                    </button>
                ))}
            </div>

            <div className="mt-2 text-white" style={{ color: '#ffffff', opacity: 1 }}>
                {/* APARIENCIA */}
                {settingsTab === 'appearance' && (
                    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700" style={{ minHeight: '500px', background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '20px' }}>
                        {/* Rendimiento */}
                        <div className="flex justify-between items-center bg-gradient-to-r from-yellow-500/10 to-transparent p-5 rounded-2xl border border-yellow-500/20 shadow-inner group transition-all hover:bg-yellow-500/20">
                             <div className="flex items-center gap-4">
                                 <div className="w-10 h-10 rounded-full flex items-center justify-center bg-yellow-400/20 text-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)] group-hover:scale-110 transition-transform"><i className="fa-solid fa-bolt"></i></div>
<div>
                                      <h4 className="text-base font-black text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>Modo Máximo Rendimiento</h4>
                                      <p className="text-xs" style={{ color: '#ffffff', opacity: 0.7 }}>Desactiva animaciones avanzadas, efectos de vidrio e IA difuminada para PCs ligeras.</p>
                                  </div>
                             </div>
                             <ToggleSwitch active={performanceMode} onClick={togglePerformanceMode} iconOn="fa-check" iconOff="fa-times" />
                        </div>

                        <div className="flex justify-end gap-3 mb-2">
<button onClick={() => setThemeSettings({ blur: 30, saturate: 210, opacity: 70, primaryColor: '#5865f2', backgroundColor: '', baseTheme: '' })}
                                     className="text-xs border border-white/10 px-5 py-2.5 rounded-xl font-semibold transition-all shadow-md" style={{ background: 'rgba(0,0,0,0.5)', color: '#ffffff', opacity: 0.8 }}><i className="fa-solid fa-undo mr-1.5"></i> Restaurar</button>
                             <button onClick={handleManualSaveTheme} className="bg-gradient-to-r from-discord-blurple to-purple-600 hover:from-purple-500 hover:to-discord-blurple text-white text-xs font-black py-2.5 px-6 rounded-xl shadow-[0_0_20px_rgba(88,101,242,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-white/20" style={{ color: '#ffffff' }}>
                                <i className="fa-solid fa-floppy-disk"></i> GUARDAR DISEÑO PERMANENTE
                             </button>
                        </div>

                        {/* Temas Base */}
                        <section className="glass-panel p-6 rounded-3xl border border-white/10 relative overflow-hidden shadow-2xl">
                            <div className="mb-6 relative z-10">
                                <h3 className="text-lg font-black text-white flex items-center gap-2 mb-1" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}><i className="fa-solid fa-moon text-discord-blurple"></i> Base del Sistema</h3>
                                <p className="text-xs text-white/40">Estructura colorimétrica global.</p>
                            </div>
                            <div className="flex gap-4 relative z-10">
                                {[
                                    { theme: '', color: 'linear-gradient(135deg, #2f3136, #202225)', label: 'Chakras UI', icon: 'fa-compact-disc' },
                                    { theme: 'midnight', color: 'linear-gradient(135deg, #09090b, #000000)', label: 'OLED Midnight', icon: 'fa-moon' },
                                ].map(t => (
                                    <button key={t.theme} onClick={() => setThemeSettings({ ...safeTheme, baseTheme: t.theme })} className="flex flex-col items-center gap-3 group">
                                        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-xl relative overflow-hidden group-hover:-translate-y-1 ${safethemebase(safeTheme.baseTheme, t.theme) ? 'border-2 border-white ring-4 ring-white/10' : 'border border-white/10'}`} style={{ background: t.color }}>
                                            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                            <i className={`fa-solid ${t.icon} text-white/70 text-2xl drop-shadow-md`}></i>
                                        </div>
                                        <span className={`text-[11px] font-black tracking-wide ${safethemebase(safeTheme.baseTheme, t.theme) ? 'text-white' : 'text-white/40'}`}>{t.label}</span>
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Liquid Builder */}
                        <section className="glass-panel p-8 rounded-3xl border border-white/10 shadow-2xl relative">
                            <div className="mb-8">
                                <h3 className="text-lg font-black text-white flex items-center gap-2 mb-1" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}><i className="fa-solid fa-palette text-discord-blurple"></i> Liquid Glass Builder</h3>
                                <p className="text-xs text-white/40">Modifica la refracción y el tinte del reproductor en tiempo real.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {[
                                    { label: 'Color de Acento', icon: 'fa-paint-brush', key: 'primaryColor', type: 'color' },
                                    { label: 'Fondo General', icon: 'fa-image', key: 'backgroundColor', type: 'color' },
                                    { label: 'Intensidad Blur', icon: 'fa-droplet', key: 'blur', type: 'range', min: 0, max: 60, suffix: 'px' },
                                    { label: 'Saturación', icon: 'fa-sun', key: 'saturate', type: 'range', min: 100, max: 300, suffix: '%' },
                                    { label: 'Opacidad del Panel', icon: 'fa-eye-slash', key: 'opacity', type: 'range', min: 10, max: 100, suffix: '%' },
                                ].map(opt => (
                                    <div key={opt.key} className="flex flex-col gap-3 p-5 rounded-2xl bg-black/30 border border-white/5 hover:bg-black/50 transition-colors">
                                         <div className="flex justify-between items-center text-sm font-bold text-white/90">
                                              <span className="flex items-center gap-2"><i className={`fa-solid ${opt.icon} text-discord-blurple/80 w-5 text-center`}></i> {opt.label}</span>
                                              <span className="text-xs font-mono text-white/30 uppercase bg-black/40 px-2 py-1 rounded-md">{safeTheme[opt.key] || 'Default'}{opt.suffix || ''}</span>
                                         </div>
                                         {opt.type === 'color' ? (
                                              <div className="flex items-center gap-3">
                                                  <input type="color" value={safeTheme[opt.key] || '#000000'} onChange={(e) => setThemeSettings({ ...safeTheme, [opt.key]: e.target.value })} className="h-10 w-full cursor-pointer rounded-xl border-none outline-none overflow-hidden bg-transparent" />
                                                  {opt.key === 'backgroundColor' && (
                                                      <button onClick={() => setThemeSettings({ ...safeTheme, backgroundColor: '' })} className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-lg text-white font-semibold transition-colors"><i className="fa-solid fa-eraser"></i></button>
                                                  )}
                                              </div>
                                         ) : (
                                              <IosSlider min={opt.min} max={opt.max} value={safeTheme[opt.key]} onChange={(e) => setThemeSettings({ ...safeTheme, [opt.key]: Number(e.target.value) })} accentColor={safeTheme.primaryColor || '#5865f2'} />
                                         )}
                                    </div>
                                ))}

                                <div className="flex flex-col gap-3 p-5 rounded-2xl bg-black/30 border border-white/5 hover:bg-black/50 transition-colors">
                                    <h4 className="text-sm font-bold text-white/90 mb-1 flex items-center gap-2"><i className="fa-solid fa-swatchbook text-discord-blurple/80 w-5"></i> Presets de Acento</h4>
                                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                                        {['#5865f2', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#94a3b8', '#ffffff'].map(c => (
                                            <button key={c} onClick={() => setThemeSettings({ ...safeTheme, primaryColor: c })}
                                                className={`w-full aspect-square rounded-full shadow-lg transition-all relative overflow-hidden group ${safeTheme.primaryColor === c ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-black' : 'hover:scale-110 hover:ring-2 hover:ring-white/30 hover:ring-offset-1 ring-offset-black'}`} style={{ background: c }}>
                                                {safeTheme.primaryColor === c && <div className="absolute inset-0 flex items-center justify-center"><i className="fa-solid fa-check text-black text-[10px] mix-blend-color-burn font-black"></i></div>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {/* AUDIO */}
                {settingsTab === 'audio' && (
                    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700" style={{ minHeight: '500px' }}>
                        <section className="glass-panel p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-discord-blurple/20 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-discord-blurple/30 pointer-events-none"></div>
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10 mb-6">
                                 <div>
                                      <h3 className="text-xl font-black text-white flex items-center gap-3 tracking-tight" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}><i className="fa-solid fa-headphones text-discord-blurple text-2xl"></i> Ruteo de Audio</h3>
                                      <p className="text-xs text-white/50 mt-1">Modifica el dispositivo de salida físico.</p>
                                 </div>
                                 <button onClick={handleDeviceSelect} className="px-6 py-3 bg-white hover:bg-gray-200 text-black rounded-xl text-sm font-black transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                                      <i className="fa-solid fa-desktop"></i> CAMBIAR SALIDA
                                 </button>
                            </div>
                            <div className="bg-black/30 p-4 rounded-2xl border border-white/5 flex items-center gap-4 relative z-10 mt-2 shadow-inner">
                                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                                    <i className="fa-solid fa-volume-high"></i>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] text-white/40 uppercase font-black tracking-widest">Canal Principal</div>
                                    <div className="text-sm font-bold text-white drop-shadow-md">{audioDeviceId ? 'Dispositivo de Hardware Externo / Personalizado' : 'Salida Predeterminada del Sistema (DirectSound/WASAPI)'}</div>
                                </div>
                            </div>
                        </section>
                        
                        <div className="rounded-3xl shadow-2xl border border-white/10 overflow-hidden bg-black/20">
                             <Equalizer isEqEnabled={isEqEnabled} toggleEq={toggleEq} eqPreset={eqPreset} applyEqPreset={applyEqPreset} eqBands={eqBands} handleEqChange={handleEqChange} />
                        </div>
                    </div>
                )}

                {/* PLAYBACK */}
                {settingsTab === 'playback' && (
                    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700" style={{ minHeight: '500px' }}>
                        <section className="glass-panel p-8 md:p-10 rounded-3xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
                            <div className="flex items-center gap-4 mb-10 pb-6 border-b border-white/10">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-discord-blurple to-purple-600 flex items-center justify-center text-white shadow-lg"><i className="fa-solid fa-sliders text-2xl"></i></div>
                                <div>
                                    <h3 className="text-2xl font-black text-white tracking-tight" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Dinámica de Reproducción</h3>
                                    <p className="text-xs text-white/50 mt-1">Flujo y experiencia continua</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="flex flex-col gap-6">
                                    <div className="bg-black/20 p-6 rounded-2xl border border-white/5 shadow-inner group">
                                        <div className="flex justify-between items-center text-base font-black text-white mb-6">
                                            <span className="flex items-center gap-3"><i className="fa-solid fa-shuffle text-discord-blurple"></i> Cruce (Crossfade)</span>
                                            <span className="bg-discord-blurple/20 text-discord-blurple px-3 py-1 rounded-lg text-xs font-mono">{crossfade} seg</span>
                                        </div>
                                        <IosSlider min="0" max="15" value={crossfade} onChange={(e) => setCrossfade(Number(e.target.value))} accentColor={safeTheme.primaryColor || '#5865f2'} />
                                        <p className="text-xs text-white/40 mt-4 italic flex items-center gap-1.5"><i className="fa-solid fa-info-circle text-discord-blurple"></i> Suaviza la transición entre el final y el inicio de canciones.</p>
                                    </div>

                                    <div className="bg-black/20 p-6 rounded-2xl border border-white/5 shadow-inner">
                                        <h4 className="text-sm font-bold text-white mb-4">Tamaño de Búfer Interno</h4>
                                        <select className="w-full bg-black/50 border border-white/10 hover:border-discord-blurple rounded-xl p-3 text-sm text-white font-semibold outline-none transition-all cursor-pointer shadow-md">
                                            <option>512ms (Respuesta Inmediata)</option>
                                            <option selected>2048ms (Equilibrado)</option>
                                            <option>4096ms (Red de Alta Latencia)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4">
                                    {[
                                        { title: 'Auto-reproducción Inicial', desc: 'Comenzar a sonar al arrancar la aplicación', state: isAutoplay, toggle: setIsAutoplay, icon: 'fa-play' },
                                        { title: 'Normalización Inteligente', desc: 'Ajuste de volumen EBU R 128 dinámico', state: isNormalize, toggle: setIsNormalize, icon: 'fa-scale-balanced' },
                                        { title: 'Motor Gapless', desc: 'Cero silencios entre carga de pistas', state: isGapless, toggle: setIsGapless, icon: 'fa-link' }
                                    ].map(opt => (
                                        <div key={opt.title} className="flex justify-between items-center bg-black/20 p-5 rounded-2xl border border-white/5 hover:bg-white/5 hover:border-white/10 transition-all cursor-pointer group" onClick={() => opt.toggle(!opt.state)}>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${opt.state ? 'bg-discord-blurple text-white shadow-lg shadow-discord-blurple/30' : 'bg-white/5 text-white/40 group-hover:bg-white/10'}`}>
                                                    <i className={`fa-solid ${opt.icon} text-sm`}></i>
                                                </div>
                                                <div>
                                                    <h4 className={`text-sm font-black transition-colors ${opt.state ? 'text-white' : 'text-white/70'}`}>{opt.title}</h4>
                                                    <p className="text-[10px] text-white/40 mt-1 uppercase tracking-widest">{opt.desc}</p>
                                                </div>
                                            </div>
                                            <ToggleSwitch active={opt.state} onClick={(e) => { e.stopPropagation(); opt.toggle(!opt.state) }} iconOn="fa-check" iconOff="fa-power-off" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {/* CONNECTION */}
                {settingsTab === 'connection' && (
                    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700" style={{ minHeight: '500px' }}>
                        <section className="glass-panel p-8 rounded-3xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
                            <div className="flex justify-between items-center mb-8 pb-6 border-b border-white/10">
                                <div>
                                    <h3 className="text-2xl font-black text-white flex items-center gap-3 tracking-tight" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}><i className="fa-solid fa-satellite-dish text-discord-blurple"></i> Control Remoto Web</h3>
                                    <p className="text-xs text-white/50 mt-2">Maneja todo tu reproductor desde un navegador en el teléfono (LAN recomendada).</p>
                                </div>
                                <ToggleSwitch active={remoteEnabled} onClick={() => setRemoteEnabled(!remoteEnabled)} iconOn="fa-wifi" iconOff="fa-ban" />
                            </div>
                            
                            {remoteEnabled ? (
                                <div className="flex flex-col lg:flex-row items-center gap-10 mt-6 animate-in zoom-in-95 duration-500">
                                    <div className="p-6 bg-white rounded-[2rem] shadow-[0_0_50px_rgba(255,255,255,0.1)] hover:shadow-[0_0_50px_rgba(255,255,255,0.2)] transition-shadow">
                                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(globalTunnelUrl || `http://${localIp}:${serverPort}/remote`)}`} className="w-56 h-56 lg:w-48 lg:h-48 rounded-xl object-contain" alt="QR Code" />
                                    </div>
                                    <div className="flex-1 w-full space-y-6">
                                        <div className="bg-gradient-to-r from-blue-500/10 to-transparent p-5 rounded-2xl border border-blue-500/20 shadow-inner">
                                            <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2"><i className="fa-solid fa-router"></i> Acceso en Red Local (LAN)</h4>
                                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                                <code className="flex-1 bg-black/50 text-white/90 text-sm font-mono break-all p-4 rounded-xl border border-white/10 shadow-inner text-center sm:text-left select-all">http://{localIp}:{serverPort}/remote</code>
                                                <button onClick={() => { navigator.clipboard.writeText(`http://${localIp}:${serverPort}/remote`); addToast("IP Copiada", "success"); }} className="px-6 py-4 bg-discord-blurple hover:bg-indigo-500 rounded-xl transition-colors shadow-lg font-bold flex items-center justify-center gap-2">
                                                    <i className="fa-solid fa-copy"></i> Copiar
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-white/40 mt-3 pt-3 border-t border-white/5"><i className="fa-solid fa-triangle-exclamation text-yellow-500 mr-1"></i> Asegúrate de abrir el puerto en el firewall si no puedes conectar.</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-16 text-center bg-black/20 rounded-2xl border border-white/5 border-dashed">
                                    <i className="fa-solid fa-signal-slash text-5xl text-white/10 mb-4 block"></i>
                                    <h4 className="text-lg font-bold text-white/50">Servidor Remoto Desactivado</h4>
                                    <p className="text-sm text-white/30 mt-1 max-w-sm mx-auto">Activa el switch para ver tu código QR y enlazar dispositivos móviles para controlar la reproducción.</p>
                                </div>
                            )}
                        </section>
                    </div>
                )}

                {/* ADVANCED - EXPERT */}
                {settingsTab === 'advanced' && (
                    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700" style={{ minHeight: '500px' }}>
                        <section className="glass-panel p-8 rounded-3xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-discord-blurple/20">
                                <h3 className="text-xl font-black text-white flex items-center gap-3" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}><i className="fa-solid fa-microchip text-discord-blurple"></i> Monitor del Motor Principal</h3>
                                <span className="flex items-center gap-2 bg-red-500/10 text-red-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Sistema Online</span>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                {[
                                    { label: 'Uso de CPU', val: `${sysStats?.cpu_percent || 0}%`, perc: sysStats?.cpu_percent || 0, color: 'bg-blue-500' },
                                    { label: 'RAM / VRAM', val: `${sysStats?.ram_percent || 0}%`, perc: sysStats?.ram_percent || 0, color: 'bg-purple-500' },
                                    { label: 'Hilos Audio', val: `${sysStats?.gpu_percent || 0}%`, perc: sysStats?.gpu_percent || 0, color: 'bg-green-500' },
                                    { label: 'Disco (I/O)', val: `${sysStats?.vram_percent || 0}%`, perc: sysStats?.vram_percent || 0, color: 'bg-yellow-500' }
                                ].map(st => (
                                    <div key={st.label} className="bg-black/30 p-5 rounded-2xl border border-white/5 flex flex-col justify-between shadow-inner group hover:bg-white/5 transition-all">
                                        <div className="flex justify-between items-end mb-4">
                                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{st.label}</span>
                                            <span className="text-xl font-mono font-bold text-white drop-shadow-md">{st.val}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden shadow-inner isolate">
                                            <div className={`h-full ${st.color} transition-all duration-1000 ease-out`} style={{ width: `${st.perc}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <section className="glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden group">
                                <h3 className="text-sm font-black text-white mb-4 uppercase tracking-widest flex items-center gap-2" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}><i className="fa-solid fa-brain text-discord-blurple"></i> Configuración de IA</h3>
                                <div className="space-y-4">
                                    <div className="bg-black/30 p-4 rounded-xl border border-white/5 flex flex-col gap-1">
                                        <span className="text-[10px] font-black uppercase text-white/40">Proveedor Activo</span>
                                        <span className="text-sm font-bold text-white flex items-center gap-2">
                                            <i className="fa-solid fa-server text-green-400 text-xs"></i> {aiProvider === 'local' ? 'Ollama Local' : 'Google Gemini API'}
                                        </span>
                                    </div>
                                    <div className="bg-black/30 p-4 rounded-xl border border-white/5 flex flex-col gap-1">
                                        <span className="text-[10px] font-black uppercase text-white/40">Modelo de Procesamiento</span>
                                        <span className="text-sm font-bold text-white flex items-center gap-2">
                                            <i className="fa-solid fa-microchip text-discord-blurple text-xs"></i> {localModel || 'gemini-1.5-flash'}
                                        </span>
                                    </div>
                                </div>
                            </section>

                            <section className="glass-panel p-6 rounded-3xl border border-red-500/20 shadow-2xl relative overflow-hidden group bg-gradient-to-br from-transparent to-red-500/5">
                                 <div className="flex flex-col h-full justify-between">
                                     <div>
                                         <h3 className="text-sm font-black text-red-500 mb-2 uppercase tracking-widest flex items-center gap-2" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}><i className="fa-solid fa-triangle-exclamation"></i> Zona de Peligro</h3>
                                         <p className="text-[10px] text-white/50 leading-relaxed max-w-[90%]">Maneja la base de datos de manera irreversible. Borrar la biblioteca eliminará todo el metadata almacenado, listas de reprodución locales y la memoria de escaneo de IA.</p>
                                     </div>
                                     <button onClick={clearLibrary} className="mt-4 bg-red-500/10 hover:bg-red-500/30 text-red-400 hover:text-red-300 text-xs px-6 py-4 rounded-xl border border-red-500/30 transition-all font-black flex items-center justify-center gap-2 shadow-lg">
                                        <i className="fa-solid fa-trash-can"></i> REINICIAR BIBLIOTECA LOCAL
                                     </button>
                                 </div>
                            </section>
                        </div>
                    </div>
                )}

                {/* ABOUT */}
                {settingsTab === 'about' && (
                    <div className="flex flex-col items-center gap-6 p-8 md:p-14 text-center animate-in zoom-in duration-700 max-w-3xl mx-auto" style={{ minHeight: '500px' }}>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-discord-blurple/10 rounded-full blur-[100px] pointer-events-none"></div>
                        
                        <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.5em] mb-4 relative z-10 drop-shadow-md">SISTEMA CÚANTICO</p>
                        
                        <div className="w-32 h-32 bg-gradient-to-tr from-discord-blurple to-purple-600 rounded-[2rem] flex items-center justify-center shadow-[0_20px_50px_rgba(88,101,242,0.4)] mb-4 relative z-10 group overflow-hidden">
                            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <i className="fa-solid fa-compact-disc text-white text-6xl animate-spin-slow drop-shadow-2xl"></i>
                        </div>
                        
                        <div className="relative z-10 space-y-2">
                            <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none drop-shadow-xl">CHAKRAS<span className="text-discord-blurple text-transparent bg-clip-text bg-gradient-to-r from-discord-blurple to-purple-400">PLAYER</span></h1>
                            <p className="text-white/60 font-black text-xs md:text-sm uppercase tracking-[0.3em]">ANTIGRAVITY MUSIC ENGINE</p>
                        </div>
                        
                        <div className="bg-white/5 border border-white/10 px-8 py-3 rounded-full text-xs font-mono text-white/60 uppercase tracking-widest mt-6 relative z-10 shadow-inner backdrop-blur-md">
                            Version 2.7.4-Stable (Build 2026)
                        </div>

                        {/* Elegance Analytics Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-2xl mt-12 relative z-10">
                             <div className="bg-black/30 p-6 rounded-3xl border border-white/5 shadow-2xl flex flex-col items-center gap-2 hover:translate-y-[-5px] transition-transform">
                                 <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 mb-2"><i className="fa-solid fa-compact-disc text-xl"></i></div>
                                 <span className="text-3xl font-black text-white">{library.length}</span>
                                 <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Pistas Totales</span>
                             </div>
                             <div className="bg-black/30 p-6 rounded-3xl border border-white/5 shadow-2xl flex flex-col items-center gap-2 hover:translate-y-[-5px] transition-transform">
                                 <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 mb-2"><i className="fa-solid fa-robot text-xl"></i></div>
                                 <span className="text-3xl font-black text-white">{libAnalytics.enriched}</span>
                                 <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">IA Procesadas</span>
                             </div>
                             <div className="bg-black/30 p-6 rounded-3xl border border-white/5 shadow-2xl flex flex-col items-center gap-2 hover:translate-y-[-5px] transition-transform">
                                 <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 mb-2"><i className="fa-solid fa-clock text-xl"></i></div>
                                 <span className="text-3xl font-black text-white">{libAnalytics.hours}h</span>
                                 <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Tiempo Musical</span>
                             </div>
                        </div>

                        <div className="mt-12 max-w-lg text-center relative z-10 border-t border-white/10 pt-8">
                            <p className="text-xs text-white/40 leading-relaxed font-semibold">Diseñado con <i className="fa-solid fa-heart text-discord-blurple mx-1"></i> para amantes de la alta fidelidad y exploradores estelares. La estética de cristal líquido es una marca registrada de Antigravity Engineering.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

function safethemebase(current, target) {
    if (!current && !target) return true;
    return current === target;
}

window.SettingsView = SettingsView;
