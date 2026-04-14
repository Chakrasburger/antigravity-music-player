// src/components/PlaylistsView.js
// ChakrasPlayer - Playlists View Component
// Requiere globals: React

const PlaylistsView = ({
    selectedPlaylist,
    setSelectedPlaylist,
    library,
    setPlaybackQueue,
    setCurrentTrackIndex,
    playTrackCore,
    activeTrack,
    userPlaylists,
    setView,
    handleAiSubmit,
    dailyMixes,
    setOriginalQueue,
    addToast,
    loadPlaylists
}) => {
    return (
        <div className="flex flex-col min-h-full p-8 animate-in fade-in duration-500">
            {selectedPlaylist ? (() => {
                // --- DETAIL VIEW (Spotify-style) ---
                const pl = selectedPlaylist;
                const plTracks = library.filter(t => pl.tracks.includes(t.id));
                const totalDuration = plTracks.reduce((sum, t) => sum + (t.duration || 0), 0);
                const durationMin = Math.floor(totalDuration / 60);
                // Generate a gradient color from the playlist name
                const hue = pl.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
                return (
                    <div className="flex flex-col gap-0">
                        {/* Header con gradiente */}
                        <div style={{
                            background: `linear-gradient(180deg, hsl(${hue}, 60%, 35%) 0%, rgba(30,30,30,0) 100%)`,
                            padding: '40px 32px 32px',
                            borderRadius: '12px 12px 0 0'
                        }}>
                            <button onClick={() => setSelectedPlaylist(null)}
                                className="mb-6 text-white/60 hover:text-white text-sm font-semibold flex items-center gap-2 transition-colors">
                                <i className="fa-solid fa-chevron-left"></i> Volver a Playlists
                            </button>
                            <div className="flex items-end gap-6">
                                {/* Cover Art - Mosaic or Gradient */}
                                {(() => {
                                    const coverTracks = plTracks.filter(t => {
                                        const c = t.coverUrl || t.ytThumbnail || t.uploaderThumbnail;
                                        return c && !c.startsWith('gradient:');
                                    }).slice(0, 4);
                                    const resolveCover = (raw) => {
                                        if (!raw) return null;
                                        if (raw.startsWith('/')) return `http://127.0.0.1:5888${raw}`;
                                        return raw;
                                    };
                                    if (coverTracks.length >= 4) {
                                        return (
                                            <div style={{
                                                width: 200, height: 200, borderRadius: 8,
                                                display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden',
                                                boxShadow: '0 8px 40px rgba(0,0,0,0.5)', flexShrink: 0
                                            }}>
                                                {coverTracks.map((t, i) => (
                                                    <img key={i} src={resolveCover(t.coverUrl || t.ytThumbnail || t.uploaderThumbnail)}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        onError={e => e.target.style.background = '#282828'} />
                                                ))}
                                            </div>
                                        );
                                    }
                                    return (
                                        <div style={{
                                            width: 200, height: 200, borderRadius: 8,
                                            background: `linear-gradient(135deg, hsl(${hue}, 70%, 45%), hsl(${(hue + 40) % 360}, 60%, 30%))`,
                                            boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                        }}>
                                            <i className="fa-solid fa-music" style={{ fontSize: 64, color: 'rgba(255,255,255,0.3)' }}></i>
                                        </div>
                                    );
                                })()}
                                <div className="flex flex-col gap-2 pb-2">
                                    <span className="text-xs font-bold uppercase tracking-widest text-white/70">Playlist</span>
                                    <h1 className="text-5xl font-black text-white tracking-tight" style={{ lineHeight: 1.1 }}>{pl.name}</h1>
                                    <p className="text-sm text-white/60 mt-2">
                                        <span className="font-semibold text-white/80">{plTracks.length} canciones</span>
                                        {durationMin > 0 && `, ${durationMin} min aprox.`}
                                        {' · Creada con '}
                                        <span className="text-purple-300 font-semibold">Chakras IA</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Action bar */}
                        <div className="flex items-center gap-4 px-8 py-5" style={{ background: 'rgba(30,30,30,0.3)' }}>
                            <button onClick={() => {
                                if (plTracks.length > 0) {
                                    setPlaybackQueue(plTracks);
                                    setCurrentTrackIndex(0);
                                    setTimeout(() => playTrackCore(plTracks[0]), 100);
                                }
                            }}
                                className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all transform hover:scale-105 active:scale-95"
                                style={{ background: '#5865f2' }}>
                                <i className="fa-solid fa-play text-white text-xl" style={{ marginLeft: 3 }}></i>
                            </button>
                            <button onClick={() => {
                                if (plTracks.length > 0) {
                                    const shuffled = [...plTracks].sort(() => Math.random() - 0.5);
                                    setPlaybackQueue(shuffled);
                                    setCurrentTrackIndex(0);
                                    setTimeout(() => playTrackCore(shuffled[0]), 100);
                                }
                            }}
                                className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/50 transition-all">
                                <i className="fa-solid fa-shuffle text-sm"></i>
                            </button>
                            <button onClick={async () => {
                                if (window.confirm(`¿Eliminar la playlist "${pl.name}"?`)) {
                                    try {
                                        await window.fetch('http://127.0.0.1:5888/api/playlists/delete', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ name: pl.name })
                                        });
                                    } catch (e) { }
                                    setSelectedPlaylist(null);
                                    loadPlaylists();
                                }
                            }}
                                className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/30 hover:text-red-400 hover:border-red-400/50 transition-all ml-auto">
                                <i className="fa-solid fa-trash text-sm"></i>
                            </button>
                        </div>

                        {/* Track list */}
                        <div className="px-8 pb-8">
                            {/* Header row */}
                            <div className="grid items-center gap-4 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white/30 border-b border-white/5 mb-2"
                                style={{ gridTemplateColumns: '40px 1fr 1fr 80px' }}>
                                <span>#</span><span>Título</span><span>Artista</span><span className="text-right"><i className="fa-regular fa-clock"></i></span>
                            </div>
                            {plTracks.length === 0 ? (
                                <div className="text-center py-12 text-white/30">
                                    <i className="fa-solid fa-ghost text-4xl mb-3 block"></i>
                                    <p>Las canciones de esta playlist ya no están en tu biblioteca.</p>
                                </div>
                            ) : plTracks.map((track, idx) => {
                                const isCurrentlyPlaying = activeTrack && activeTrack.id === track.id;
                                return (
                                    <div key={track.id}
                                        onClick={() => {
                                            setPlaybackQueue(plTracks);
                                            setCurrentTrackIndex(idx);
                                            playTrackCore(track);
                                        }}
                                        className="grid items-center gap-4 px-4 py-2.5 rounded-md cursor-pointer group transition-all"
                                        style={{
                                            gridTemplateColumns: '40px 1fr 1fr 80px',
                                            background: isCurrentlyPlaying ? 'rgba(255,255,255,0.06)' : 'transparent'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                        onMouseLeave={e => e.currentTarget.style.background = isCurrentlyPlaying ? 'rgba(255,255,255,0.06)' : 'transparent'}>
                                        <span className="text-sm font-medium text-white/40 group-hover:hidden" style={{ color: isCurrentlyPlaying ? '#5865f2' : undefined }}>
                                            {isCurrentlyPlaying ? <i className="fa-solid fa-volume-high text-xs"></i> : idx + 1}
                                        </span>
                                        <span className="text-sm text-white hidden group-hover:block">
                                            <i className="fa-solid fa-play text-xs"></i>
                                        </span>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <img src={(() => {
                                                const raw = track.coverUrl || track.ytThumbnail || track.uploaderThumbnail;
                                                if (!raw) return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect fill="%23282828" width="40" height="40"/></svg>';
                                                if (raw.startsWith('/')) return `http://127.0.0.1:5888${raw}`;
                                                if (raw.startsWith('gradient:')) return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect fill="%23282828" width="40" height="40"/></svg>';
                                                return raw;
                                            })()}
                                                className="w-10 h-10 rounded object-cover flex-shrink-0" style={{ background: '#282828' }}
                                                onError={(e) => { e.target.style.display = 'none'; }} />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate" style={{ color: isCurrentlyPlaying ? '#5865f2' : '#e0e0e0' }}>{track.title}</p>
                                            </div>
                                        </div>
                                        <span className="text-sm text-white/50 truncate">{track.artist || 'Unknown'}</span>
                                        <span className="text-sm text-white/40 text-right">{track.duration ? `${Math.floor(track.duration / 60)}:${String(Math.floor(track.duration % 60)).padStart(2, '0')}` : '--:--'}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })() : (
                /* --- GRID VIEW (Spotify-style cards) --- */
                <div className="flex flex-col gap-6">
                    {/* Header */}
                    <div className="flex justify-between items-center">
                        <div className="mb-2">
                            <h2 className="text-3xl font-black text-white tracking-tight">Tu Biblioteca</h2>
                            <p className="text-sm text-white/40 mt-1">{userPlaylists.length} playlist{userPlaylists.length !== 1 ? 's' : ''} guardada{userPlaylists.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={async () => {
                                    const p = window.prompt('¿Qué vibra o estilo quieres? (ej: "rock energético", "chill japonés")');
                                    if (p) {
                                        setView('ai-assistant');
                                        setTimeout(() => handleAiSubmit(null, `Crea una playlist de: ${p}`), 200);
                                    }
                                }}
                                className="px-5 py-2.5 rounded-full font-bold text-sm transition-all transform active:scale-95 flex items-center gap-2 shadow-lg"
                                style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white', boxShadow: '0 4px 20px rgba(124,58,237,0.3)' }}>
                                <i className="fa-solid fa-wand-magic-sparkles"></i> Crear con IA
                            </button>
                        </div>
                    </div>

                    {/* ── Daily Mixes ── */}
                    {dailyMixes.length > 0 && (
                        <div className="mb-4">
                            <h3 className="text-lg font-bold text-white/70 mb-4 flex items-center gap-2">
                                <i className="fa-solid fa-wand-magic-sparkles text-purple-400"></i>
                                Tus Daily Mixes
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 w-full">
                                {dailyMixes.map(mix => (
                                    <div
                                        key={mix.id}
                                        onClick={() => {
                                            if (mix.tracks.length > 0) {
                                                setPlaybackQueue(mix.tracks);
                                                setOriginalQueue(mix.tracks);
                                                setCurrentTrackIndex(0);
                                                setTimeout(() => playTrackCore(mix.tracks[0]), 80);
                                                addToast(`▶ ${mix.name}`, 'success');
                                            }
                                        }}
                                        className={`relative rounded-xl p-6 cursor-pointer group overflow-hidden
                                            bg-gradient-to-br ${mix.color} transition-all duration-300
                                            hover:scale-[1.03] hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]`}
                                        style={{ minHeight: 160 }}
                                    >
                                        {/* Gloss overlay */}
                                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors duration-300 rounded-xl" />
                                        <div className="relative z-10 h-full flex flex-col">
                                            <i className={`fa-solid ${mix.icon} text-4xl text-white/90 mb-4 block`}></i>
                                            <div className="mt-auto">
                                                <h4 className="text-lg font-black text-white leading-tight drop-shadow-md">{mix.name}</h4>
                                                <p className="text-sm text-white/70 mt-1 truncate">{mix.desc}</p>
                                                <p className="text-[10px] text-white/50 mt-3 font-bold uppercase tracking-[0.2em]">
                                                    {mix.tracks.length} Pistas
                                                </p>
                                            </div>
                                        </div>
                                        {/* Play button */}
                                        <div className="absolute bottom-6 right-6 w-12 h-12 bg-white/30 rounded-full
                                            flex items-center justify-center opacity-0 group-hover:opacity-100
                                            translate-y-4 group-hover:translate-y-0
                                            transition-all duration-300 group-hover:scale-110 backdrop-blur-md border border-white/20">
                                            <i className="fa-solid fa-play text-white text-lg" style={{ marginLeft: 3 }}></i>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <hr className="border-white/5 mb-6" />
                        </div>
                    )}

                    {/* Smart Playlists (Auto-generated) */}
                    <div className="mt-2">
                        <h3 className="text-lg font-bold text-white/70 mb-3">Listas Inteligentes</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div onClick={() => {
                                const recent = [...library].sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0)).slice(0, 50);
                                setSelectedPlaylist({ name: 'Añadidas Recientemente', tracks: recent.map(t => t.id) });
                            }}
                                className="flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-all group"
                                style={{ background: 'rgba(255,255,255,0.04)' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}>
                                <div style={{ width: 48, height: 48, borderRadius: 6, background: 'linear-gradient(135deg,#5865f2,#4752c4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <i className="fa-solid fa-clock-rotate-left text-white text-lg"></i>
                                </div>
                                <div>
                                    <h4 className="font-bold text-white text-sm">Añadidas Recientemente</h4>
                                    <p className="text-xs text-white/40">Top 50 más nuevas</p>
                                </div>
                            </div>
                            <div onClick={() => {
                                const top = [...library].sort((a, b) => (b.playCount || 0) - (a.playCount || 0)).slice(0, 50);
                                setSelectedPlaylist({ name: 'Más Reproducidas', tracks: top.map(t => t.id) });
                            }}
                                className="flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-all group"
                                style={{ background: 'rgba(255,255,255,0.04)' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}>
                                <div style={{ width: 48, height: 48, borderRadius: 6, background: 'linear-gradient(135deg,#e11d48,#9f1239)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <i className="fa-solid fa-fire text-white text-lg"></i>
                                </div>
                                <div>
                                    <h4 className="font-bold text-white text-sm">Más Reproducidas</h4>
                                    <p className="text-xs text-white/40">Tus favoritas absolutas</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* User Playlists Grid */}
                    <div>
                        <h3 className="text-lg font-bold text-white/70 mb-4">Tus Playlists</h3>
                        {userPlaylists.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
                                <div style={{ width: 80, height: 80, borderRadius: 16, background: 'linear-gradient(135deg,#7c3aed22,#4f46e522)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                    <i className="fa-solid fa-headphones text-3xl" style={{ color: 'rgba(124,58,237,0.5)' }}></i>
                                </div>
                                <h4 className="text-lg font-bold text-white/70 mb-2">Aún no tienes playlists</h4>
                                <p className="text-sm text-white/30 mb-6 max-w-xs text-center">Pídele a la IA que cree una, o usa el botón "Crear con IA" de arriba.</p>
                                <button onClick={() => {
                                    setView('ai-assistant');
                                }} className="px-5 py-2 rounded-full text-sm font-bold transition-all" style={{ background: '#7c3aed', color: 'white' }}>
                                    <i className="fa-solid fa-robot mr-2"></i>Ir al Asistente IA
                                </button>
                            </div>
                        ) : (
                            <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                                {userPlaylists.map((pl, i) => {
                                    const hue = pl.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
                                    return (
                                        <div key={i} onClick={() => setSelectedPlaylist(pl)}
                                            className="flex flex-col gap-3 p-4 rounded-lg cursor-pointer group transition-all"
                                            style={{ background: 'rgba(255,255,255,0.04)' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}>
                                            <div className="relative" style={{ aspectRatio: '1/1' }}>
                                                <div className="w-full h-full rounded-md flex items-center justify-center"
                                                    style={{
                                                        background: `linear-gradient(135deg, hsl(${hue}, 60%, 40%), hsl(${(hue + 50) % 360}, 50%, 25%))`,
                                                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                                                    }}>
                                                    <i className="fa-solid fa-music text-3xl" style={{ color: 'rgba(255,255,255,0.25)' }}></i>
                                                </div>
                                                {/* Play button overlay */}
                                                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                                    <button onClick={(e) => {
                                                        e.stopPropagation();
                                                        const plTracks = library.filter(t => pl.tracks.includes(t.id));
                                                        if (plTracks.length > 0) {
                                                            setPlaybackQueue(plTracks);
                                                            setCurrentTrackIndex(0);
                                                            setTimeout(() => playTrackCore(plTracks[0]), 100);
                                                        }
                                                    }}
                                                        className="w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-transform hover:scale-105"
                                                        style={{ background: '#5865f2' }}>
                                                        <i className="fa-solid fa-play text-white text-lg" style={{ marginLeft: 2 }}></i>
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm text-white truncate">{pl.name}</h4>
                                                <p className="text-xs text-white/40 mt-0.5">{pl.tracks.length} cancion{pl.tracks.length !== 1 ? 'es' : ''}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
