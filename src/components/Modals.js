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
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => { setTrimModal(null); setTrimPreviewPlaying(false); }}>
            <div className="glass-panel border border-white/15 shadow-2xl rounded-2xl p-6 w-full max-w-md animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center"><i className="fa-solid fa-scissors text-yellow-400"></i></div>
                        <div><h3 className="font-bold text-lg">Recortar Audio</h3><p className="text-xs text-discord-muted truncate max-w-[200px]">{trimModal.track.title}</p></div>
                    </div>
                    <button onClick={() => setTrimPreviewPlaying(!trimPreviewPlaying)} className="w-10 h-10 flex items-center justify-center rounded-full bg-discord-blurple/20 hover:bg-discord-blurple/40 text-discord-blurple transition-colors">
                        <i className={`fa-solid ${trimPreviewPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                    </button>
                </div>
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-xs text-discord-muted mb-1"><span>Inicio</span><span className="font-mono font-bold text-discord-blurple">{Math.floor(trimRange.start / 60)}:{String(Math.floor(trimRange.start % 60)).padStart(2, "0")}</span></div>
                        <input type="range" min={0} max={trimModal.track.duration || 300} step={1} value={trimRange.start} onChange={e => setTrimRange(p => ({ ...p, start: Math.min(Number(e.target.value), p.end - 1) }))} className="w-full accent-discord-blurple" />
                    </div>
                    <div>
                        <div className="flex justify-between text-xs text-discord-muted mb-1"><span>Fin</span><span className="font-mono font-bold text-yellow-400">{Math.floor(trimRange.end / 60)}:{String(Math.floor(trimRange.end % 60)).padStart(2, "0")}</span></div>
                        <input type="range" min={0} max={trimModal.track.duration || 300} step={1} value={trimRange.end} onChange={e => setTrimRange(p => ({ ...p, end: Math.max(Number(e.target.value), p.start + 1) }))} className="w-full accent-yellow-400" />
                    </div>
                    <div className="bg-black/30 rounded-lg p-3 flex items-center justify-between border border-white/5">
                        <span className="text-xs text-discord-muted">Duración resultante</span>
                        <span className="text-sm font-mono font-bold text-green-400">{Math.floor((trimRange.end - trimRange.start) / 60)}:{String(Math.floor((trimRange.end - trimRange.start) % 60)).padStart(2, "0")}</span>
                    </div>
                </div>
                {editorMsg && <p className={`mt-3 text-sm text-center font-semibold ${editorMsg.startsWith("?") ? "text-green-400" : "text-red-400"}`}>{editorMsg}</p>}
                <p className="text-[10px] text-discord-muted/60 text-center mt-2">⚠️ Sobreescribe el archivo original. Requiere FFmpeg.</p>
                <div className="flex gap-3 mt-4">
                    <button onClick={() => { setTrimModal(null); setTrimPreviewPlaying(false); }} className="flex-1 py-2.5 rounded-lg bg-discord-secondary/50 text-discord-muted text-sm font-semibold hover:bg-discord-secondary hover:text-white transition-colors">Cancelar</button>
                    <button onClick={trimAudio} disabled={editorSaving} className="flex-1 py-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                        {editorSaving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-scissors"></i>} Recortar
                    </button>
                </div>
            </div>
        </div>
    );
};
