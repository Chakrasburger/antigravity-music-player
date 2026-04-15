// src/components/Modals.js
// ChakrasPlayer - Modals and Context Menus
// Requiere globals: React

const YtPromptModal = ({ ytPromptData, setYtPromptData, confirmYtDownload }) => {
    if (!ytPromptData.visible) return null;
    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-200">
            <div className="glass-panel border border-discord-blurple/30 shadow-[0_0_50px_rgba(88,101,242,0.15)] rounded-2xl max-w-md w-full p-7 mx-4 transform scale-100 transition-transform">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#FF0000] to-transparent opacity-50"></div>

                <h3 className="text-xl font-bold text-discord-text mb-2 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#FF0000]/20 flex items-center justify-center text-[#FF0000]">
                        <i className="fa-brands fa-youtube text-sm"></i>
                    </div>
                    Metadatos de la Pista
                </h3>
                <p className="text-sm text-discord-muted mb-6 leading-relaxed">
                    Define cómo quieres que esta pista sea indexada en tu biblioteca de <strong>Chakras IA</strong>.
                </p>

                <div className="space-y-5 mb-8">
                    <div>
                        <label className="block text-[11px] font-bold text-discord-muted uppercase mb-2 ml-1 tracking-wider">Artista Oficial</label>
                        <div className="relative">
                            <i className="fa-solid fa-user absolute left-3 top-1/2 -translate-y-1/2 text-discord-muted text-sm"></i>
                            <input
                                type="text"
                                value={ytPromptData.artist}
                                onChange={e => setYtPromptData({ ...ytPromptData, artist: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 focus:border-[#FF0000]/50 rounded-lg py-3 pl-9 pr-4 text-discord-text outline-none transition-colors shadow-inner"
                                autoFocus
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-discord-muted uppercase mb-2 ml-1 tracking-wider">Título de la Canción</label>
                        <div className="relative">
                            <i className="fa-solid fa-music absolute left-3 top-1/2 -translate-y-1/2 text-discord-muted text-sm"></i>
                            <input
                                type="text"
                                value={ytPromptData.title}
                                onChange={e => setYtPromptData({ ...ytPromptData, title: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 focus:border-[#FF0000]/50 rounded-lg py-3 pl-9 pr-4 text-discord-text outline-none transition-colors shadow-inner"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 justify-end border-t border-white/5 pt-5 mt-2">
                    <button
                        onClick={() => setYtPromptData({ visible: false, artist: '', title: '', url: '', videoId: null })}
                        className="px-6 py-2.5 font-bold text-discord-muted hover:text-white transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={confirmYtDownload}
                        disabled={!ytPromptData.artist.trim() || !ytPromptData.title.trim()}
                        className="bg-[#FF0000] hover:bg-[#CC0000] disabled:opacity-50 text-white font-bold px-8 py-2.5 rounded-lg transition-all shadow-lg hover:shadow-[#FF0000]/20 active:scale-95 flex items-center gap-2"
                    >
                        <i className="fa-solid fa-cloud-arrow-down"></i>
                        Extraer e Inyectar
                    </button>
                </div>
            </div>
        </div>
    );
};

const TrackContextMenu = ({ contextMenu, closeContextMenu, openMetaEditor, openTrimmer, replaceFromYoutube, deleteSong }) => {
    if (!contextMenu) return null;
    return (
        <>
            <div className="fixed inset-0 z-[9998]" onClick={closeContextMenu} />
            <div className="fixed z-[9999] animate-in fade-in slide-in-from-top-1 duration-150" style={{ top: contextMenu.y, left: contextMenu.x }}>
                <div className="glass-panel border border-white/10 shadow-2xl rounded-xl overflow-hidden min-w-[210px]">
                    <div className="px-4 py-3 border-b border-white/5">
                        <p className="text-xs font-bold text-discord-muted uppercase tracking-widest">Opciones de Pista</p>
                        <p className="text-sm font-semibold text-discord-text truncate mt-0.5">{contextMenu.track.title}</p>
                    </div>
                    <button onClick={() => openMetaEditor(contextMenu.track)} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-discord-text hover:bg-white/5 transition-colors">
                        <i className="fa-solid fa-pen-to-square w-4 text-discord-blurple"></i>Editar Metadatos
                    </button>
                    <button onClick={() => openTrimmer(contextMenu.track)} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-discord-text hover:bg-white/5 transition-colors">
                        <i className="fa-solid fa-scissors w-4 text-yellow-400"></i>Recortar Audio
                    </button>
                    <div className="h-[1px] bg-white/5 mx-2 my-1"></div>
                    <button onClick={() => replaceFromYoutube(contextMenu.track)} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-discord-text hover:bg-white/5 transition-colors">
                        <i className="fa-brands fa-youtube w-4 text-[#FF0000]"></i>Reemplazar desde YT
                    </button>
                    <button onClick={() => deleteSong(contextMenu.track)} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                        <i className="fa-solid fa-trash-can w-4 text-red-500"></i>Borrar Canción
                    </button>
                </div>
            </div>
        </>
    );
};

const EditMetaModal = ({ editMetaModal, setEditMetaModal, editorMsg, editorSaving, saveMetadata }) => {
    if (!editMetaModal) return null;
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setEditMetaModal(null)}>
            <div className="glass-panel border border-white/15 shadow-2xl rounded-2xl p-6 w-full max-w-md animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-discord-blurple/20 flex items-center justify-center"><i className="fa-solid fa-tag text-discord-blurple"></i></div>
                    <div><h3 className="font-bold text-lg">Editar Metadatos</h3><p className="text-xs text-discord-muted">{editMetaModal.track.title}</p></div>
                </div>
                <div className="space-y-3">
                    {[{ label: 'Título', key: 'title' }, { label: 'Artista', key: 'artist' }, { label: 'Álbum', key: 'album' }, { label: 'Año', key: 'year' }, { label: 'Género', key: 'genre' }].map(({ label, key }) => (
                        <input key={key} type="text" placeholder={label} value={editMetaModal.meta[key]}
                            onChange={e => setEditMetaModal(prev => ({ ...prev, meta: { ...prev.meta, [key]: e.target.value } }))}
                            className="w-full bg-black/40 border border-white/10 rounded-lg py-2.5 px-3 text-sm text-discord-text" />
                    ))}
                </div>
                {editorMsg && <p className={`mt-3 text-sm text-center font-semibold ${editorMsg.startsWith("?") ? "text-green-400" : "text-red-400"}`}>{editorMsg}</p>}
                <div className="flex gap-3 mt-5">
                    <button onClick={() => setEditMetaModal(null)} className="flex-1 py-2.5 rounded-lg bg-discord-secondary/50 text-discord-muted text-sm font-semibold">Cancelar</button>
                    <button onClick={saveMetadata} disabled={editorSaving} className="flex-1 py-2.5 rounded-lg bg-discord-blurple text-white text-sm font-bold flex items-center justify-center gap-2">
                        {editorSaving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-floppy-disk"></i>} Guardar
                    </button>
                </div>
            </div>
        </div>
    );
};

const TrimModal = ({ trimModal, setTrimModal, trimPreviewPlaying, setTrimPreviewPlaying, trimRange, setTrimRange, editorMsg, editorSaving, trimAudio }) => {
    if (!trimModal) return null;

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${mins}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
    };

    const totalDuration = trimModal.track.duration || 300;
    const trimDuration = trimRange.end - trimRange.start;
    const trimPercentage = (trimDuration / totalDuration) * 100;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => { setTrimModal(null); setTrimPreviewPlaying(false); }}>
            <div className="glass-panel border border-white/15 shadow-2xl rounded-2xl p-6 w-full max-w-lg animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                            <i className="fa-solid fa-scissors text-yellow-400 text-lg"></i>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">Recortar Audio</h3>
                            <p className="text-xs text-discord-muted truncate max-w-[200px]">{trimModal.track.title}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setTrimPreviewPlaying(!trimPreviewPlaying)}
                        className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${trimPreviewPlaying ? 'bg-discord-blurple text-white' : 'bg-discord-blurple/20 hover:bg-discord-blurple/40 text-discord-blurple'}`}
                        title={trimPreviewPlaying ? 'Pausar preview' : 'Reproducir preview'}
                    >
                        <i className={`fa-solid ${trimPreviewPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                    </button>
                </div>

                {/* Visual Waveform Placeholder */}
                <div className="relative mb-6 bg-discord-dark/50 rounded-lg p-4 border border-white/5">
                    <div className="flex items-center justify-center h-16 gap-0.5 opacity-50">
                        {Array.from({ length: 60 }).map((_, i) => {
                            const isInRange = i >= (trimRange.start / totalDuration * 60) && i <= (trimRange.end / totalDuration * 60);
                            return (
                                <div
                                    key={i}
                                    className={`w-1 rounded-full transition-all ${isInRange ? 'bg-yellow-400 h-8' : 'bg-gray-600 h-4'}`}
                                    style={{ height: `${Math.random() * 40 + 20}px` }}
                                ></div>
                            );
                        })}
                    </div>
                    <div className="absolute top-4 left-4 text-xs text-discord-muted">
                        <i className="fa-solid fa-wave-square mr-1"></i>
                        Preview
                    </div>
                </div>

                {/* Controls */}
                <div className="space-y-4">
                    {/* Start Time */}
                    <div className="bg-discord-dark/30 rounded-lg p-3 border border-white/5">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs text-discord-muted font-semibold uppercase tracking-wider">
                                <i className="fa-solid fa-play mr-1 text-discord-blurple"></i>
                                Inicio
                            </label>
                            <span className="font-mono font-bold text-discord-blurple text-lg">{formatTime(trimRange.start)}</span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={totalDuration}
                            step={0.1}
                            value={trimRange.start}
                            onChange={e => setTrimRange(p => ({ ...p, start: Math.min(Number(e.target.value), p.end - 0.5) }))}
                            className="w-full accent-discord-blurple"
                        />
                        <div className="flex justify-between text-[10px] text-discord-muted mt-1">
                            <span>0:00</span>
                            <span>{formatTime(totalDuration)}</span>
                        </div>
                    </div>

                    {/* End Time */}
                    <div className="bg-discord-dark/30 rounded-lg p-3 border border-white/5">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs text-discord-muted font-semibold uppercase tracking-wider">
                                <i className="fa-solid fa-stop mr-1 text-yellow-400"></i>
                                Fin
                            </label>
                            <span className="font-mono font-bold text-yellow-400 text-lg">{formatTime(trimRange.end)}</span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={totalDuration}
                            step={0.1}
                            value={trimRange.end}
                            onChange={e => setTrimRange(p => ({ ...p, end: Math.max(Number(e.target.value), p.start + 0.5) }))}
                            className="w-full accent-yellow-400"
                        />
                        <div className="flex justify-between text-[10px] text-discord-muted mt-1">
                            <span>0:00</span>
                            <span>{formatTime(totalDuration)}</span>
                        </div>
                    </div>

                    {/* Trim Duration Info */}
                    <div className="bg-black/30 rounded-lg p-4 border border-white/5 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-discord-muted font-semibold uppercase">Duración resultante</span>
                            <span className="text-lg font-mono font-bold text-green-400">{formatTime(trimDuration)}</span>
                        </div>
                        <div className="w-full bg-discord-dark rounded-full h-2">
                            <div
                                className="bg-gradient-to-r from-discord-blurple to-green-400 h-2 rounded-full transition-all"
                                style={{ width: `${trimPercentage}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-discord-muted">
                            <span>Original: {formatTime(totalDuration)}</span>
                            <span className="text-yellow-400">{trimPercentage.toFixed(1)}% conservado</span>
                            <span>Recortado: {formatTime(totalDuration - trimDuration)}</span>
                        </div>
                    </div>

                    {/* Quick Presets */}
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => setTrimRange({ start: 0, end: Math.min(30, totalDuration) })}
                            className="py-2 px-3 rounded-lg bg-discord-dark/50 hover:bg-discord-dark text-xs font-semibold transition-colors border border-white/5"
                            title="Primeros 30 segundos"
                        >
                            <i className="fa-solid fa-forward mr-1"></i>
                            Intro (30s)
                        </button>
                        <button
                            onClick={() => {
                                const mid = totalDuration / 2;
                                setTrimRange({ start: Math.max(0, mid - 30), end: Math.min(totalDuration, mid + 30) });
                            }}
                            className="py-2 px-3 rounded-lg bg-discord-dark/50 hover:bg-discord-dark text-xs font-semibold transition-colors border border-white/5"
                            title="Parte central de 60s"
                        >
                            <i className="fa-solid fa-object-group mr-1"></i>
                            Centro (60s)
                        </button>
                        <button
                            onClick={() => setTrimRange({ start: Math.max(0, totalDuration - 30), end: totalDuration })}
                            className="py-2 px-3 rounded-lg bg-discord-dark/50 hover:bg-discord-dark text-xs font-semibold transition-colors border border-white/5"
                            title="Últimos 30 segundos"
                        >
                            <i className="fa-solid fa-backward mr-1"></i>
                            Final (30s)
                        </button>
                    </div>
                </div>

                {/* Status Message */}
                {editorMsg && (
                    <p className={`mt-3 text-sm text-center font-semibold px-3 py-2 rounded-lg ${editorMsg.startsWith("?") ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"}`}>
                        {editorMsg}
                    </p>
                )}

                {/* Warning */}
                <p className="text-[10px] text-discord-muted/60 text-center mt-3">
                    <i className="fa-solid fa-triangle-exclamation mr-1"></i>
                    Sobreescribe el archivo original. Requiere FFmpeg.
                </p>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-4">
                    <button
                        onClick={() => { setTrimModal(null); setTrimPreviewPlaying(false); }}
                        className="flex-1 py-2.5 rounded-lg bg-discord-secondary/50 text-discord-muted text-sm font-semibold hover:bg-discord-secondary hover:text-white transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={trimAudio}
                        disabled={editorSaving}
                        className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-yellow-300 text-black text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                        {editorSaving ? (
                            <><i className="fa-solid fa-circle-notch fa-spin"></i> Procesando...</>
                        ) : (
                            <><i className="fa-solid fa-scissors"></i> Recortar</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Floating Mini Player Component
const FloatingMiniPlayer = ({
    isPlaying,
    activeTrack,
    progress,
    duration,
    togglePlay,
    nextTrack,
    prevTrack,
    onClose,
    onToggleExpand
}) => {
    if (!activeTrack) return null;

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${String(secs).padStart(2, '0')}`;
    };

    const progressPercent = duration ? (progress / duration) * 100 : 0;

    return (
        <div className="fixed bottom-20 right-4 z-[9999] w-72 animate-in slide-in-from-bottom-5 duration-300" style={{ WebkitAppRegion: 'no-drag' }}>
            <div className="glass-panel border border-white/15 shadow-2xl rounded-xl overflow-hidden bg-discord-secondary/95 backdrop-blur-xl">
                {/* Progress Bar */}
                <div className="w-full h-1 bg-discord-dark">
                    <div
                        className="h-full bg-gradient-to-r from-discord-blurple to-vibrant-light transition-all"
                        style={{ width: `${progressPercent}%` }}
                    ></div>
                </div>

                {/* Player Content */}
                <div className="p-3 flex items-center gap-3">
                    {/* Album Art */}
                    <div className="w-12 h-12 rounded-lg bg-discord-dark flex-shrink-0 overflow-hidden shadow-md">
                        {activeTrack.coverUrl ? (
                            <img src={activeTrack.coverUrl} alt="Cover" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-discord-muted">
                                <i className="fa-solid fa-music text-xl"></i>
                            </div>
                        )}
                    </div>

                    {/* Track Info */}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{activeTrack.title}</p>
                        <p className="text-xs text-discord-muted truncate">{activeTrack.artist}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-discord-muted">
                            <span>{formatTime(progress)}</span>
                            <span>/</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={prevTrack}
                            className="w-8 h-8 rounded-full bg-discord-dark/50 hover:bg-discord-dark flex items-center justify-center text-discord-muted hover:text-white transition-colors"
                            title="Anterior"
                        >
                            <i className="fa-solid fa-backward-step text-xs"></i>
                        </button>
                        <button
                            onClick={togglePlay}
                            className="w-10 h-10 rounded-full bg-discord-blurple hover:bg-discord-blurple/80 flex items-center justify-center text-white transition-colors shadow-lg"
                            title={isPlaying ? 'Pausar' : 'Reproducir'}
                        >
                            <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-sm`}></i>
                        </button>
                        <button
                            onClick={nextTrack}
                            className="w-8 h-8 rounded-full bg-discord-dark/50 hover:bg-discord-dark flex items-center justify-center text-discord-muted hover:text-white transition-colors"
                            title="Siguiente"
                        >
                            <i className="fa-solid fa-forward-step text-xs"></i>
                        </button>
                    </div>
                </div>

                {/* Bottom Actions */}
                <div className="px-3 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {/* Beat Indicator */}
                        {isPlaying && (
                            <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
                                <span className="text-[10px] text-green-400 font-semibold">Playing</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={onToggleExpand}
                            className="w-6 h-6 rounded hover:bg-discord-dark/50 flex items-center justify-center text-discord-muted hover:text-white transition-colors"
                            title="Expandir"
                        >
                            <i className="fa-solid fa-up-right-and-down-left-from-center text-xs"></i>
                        </button>
                        <button
                            onClick={onClose}
                            className="w-6 h-6 rounded hover:bg-red-500/20 flex items-center justify-center text-discord-muted hover:text-red-400 transition-colors"
                            title="Cerrar"
                        >
                            <i className="fa-solid fa-xmark text-xs"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

