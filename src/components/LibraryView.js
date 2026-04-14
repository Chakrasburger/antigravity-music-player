// src/components/LibraryView.js
// ChakrasPlayer - Library View Component
// Requiere globals: React, window.StorageApi, window.formatTime

const LibraryView = ({
    view,
    library,
    librarySearchQuery,
    setLibrarySearchQuery,
    displayList,
    performInitialSync,
    isServerConnected,
    setVsScrollTop,
    startIdx,
    visibleItems,
    ROW_HEIGHT,
    currentTrackIndex,
    activeTrack,
    openContextMenu,
    selectTrack,
    currentlyEnriching,
    ytDownloadProgress,
    enrichmentQueue,
    isPlaying,
    durationRef,
    currentProgressRef,
    setLibrary,
    setPlaybackQueue
}) => {
    return (
        <div className="flex flex-col h-full overflow-hidden p-8">
            {/* Header: Search Bar (Sticky-like via Flex) */}
            {view === 'songs' && library.length > 0 && (
                <div className="mb-6 relative group">
                    <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-discord-muted group-focus-within:text-discord-blurple transition-colors"></i>
                    <input
                        type="text"
                        placeholder="Buscar canciones por nombre o artista..."
                        className="w-full max-w-md bg-black/40 border border-white/10 rounded-full py-2.5 pl-11 pr-4 text-discord-text focus:outline-none focus:border-discord-blurple/50 focus:bg-black/60 transition-all placeholder:text-discord-muted/50 shadow-inner text-sm"
                        value={librarySearchQuery}
                        onChange={(e) => setLibrarySearchQuery(e.target.value)}
                    />
                </div>
            )}

            {displayList.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-discord-muted bg-black/10 rounded-lg border border-white/5">
                    <i className="fa-regular fa-folder-open text-5xl mb-4 opacity-50"></i>
                    <h3 className="text-xl font-semibold mb-2 text-discord-text">{view === 'songs' ? 'Your Library is Empty' : 'Queue is Empty'}</h3>
                    <p className="text-discord-muted mb-6 text-sm">{view === 'songs' ? 'Click "Add Folder" in the sidebar or recover your downloads below.' : 'Add some songs to the queue to start listening.'}</p>
                    {view === 'songs' && (
                        <button
                            onClick={() => performInitialSync(true)}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold transition-all ${isServerConnected ? 'bg-discord-blurple hover:bg-discord-blurple/80 text-white shadow-lg' : 'bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border border-orange-600/30 animation-pulse'}`}
                        >
                            <i className={`fa-solid ${isServerConnected ? 'fa-cloud-arrow-down' : 'fa-power-off'}`}></i>
                            {isServerConnected ? 'Restablecer biblioteca desde el servidor' : '🔄 REINICIA LA APP PARA RECUPERAR'}
                        </button>
                    )}
                </div>
            ) : (
                <div className="flex-1 flex flex-col min-h-0 bg-black/10 rounded-lg border border-white/5 overflow-hidden">
                    <div className="w-full grid grid-cols-[48px_1fr_minmax(120px,25%)_80px] border-b border-discord-border/50 text-discord-muted text-xs font-bold uppercase tracking-wider py-3 px-2">
                        <div className="text-center">#</div>
                        <div className="px-4">Title</div>
                        <div className="px-4 hidden md:block">Album</div>
                        <div className="px-4 text-right"><i className="fa-regular fa-clock"></i></div>
                    </div>

                    <div
                        className="flex-1 overflow-y-auto relative custom-scrollbar scroll-smooth"
                        onScroll={e => setVsScrollTop(e.currentTarget.scrollTop)}
                    >
                        <div style={{ height: `${displayList.length * ROW_HEIGHT}px`, width: '100%', pointerEvents: 'none' }} />
                        <div
                            className="absolute top-0 left-0 w-full"
                            style={{ transform: `translateY(${startIdx * ROW_HEIGHT}px)` }}
                        >
                            {visibleItems.map((track, relIdx) => {
                                const idx = startIdx + relIdx;
                                let isActive = false;
                                if (view === 'queue') {
                                    isActive = currentTrackIndex === idx;
                                } else {
                                    isActive = activeTrack && activeTrack.id === track.id;
                                }

                                return (
                                    <div
                                        key={track.id || track.videoId || `virt-${idx}`}
                                        onContextMenu={(e) => view === 'songs' && !track.isDownloading && openContextMenu(e, track)}
                                        onDoubleClick={() => {
                                            if (track.isDownloading) return;
                                            if (view === 'songs') {
                                                const absoluteIndex = library.findIndex(t => t.id === track.id);
                                                if (absoluteIndex !== -1) selectTrack(absoluteIndex, true);
                                            } else {
                                                selectTrack(idx, false);
                                            }
                                        }}
                                        className={`grid grid-cols-[48px_1fr_minmax(120px,25%)_80px] items-center border-b border-white/5 hover:bg-white/5 ${track.isDownloading ? 'cursor-wait' : 'cursor-pointer'} group transition-colors duration-150 ${isActive ? 'bg-discord-blurple/10 shadow-[inset_4px_0_0_var(--color-blurple)]' : ''}`}
                                        style={{
                                            height: `${ROW_HEIGHT}px`,
                                            background: track.isDownloading && ytDownloadProgress[track.videoId]
                                                ? `linear-gradient(to right, rgba(88, 101, 242, 0.15) 0%, rgba(88, 101, 242, 0.15) ${ytDownloadProgress[track.videoId]}%, transparent ${ytDownloadProgress[track.videoId]}%, transparent 100%)`
                                                : isActive ? `linear-gradient(to right, var(--color-vibrant-dark) 0%, var(--color-vibrant-dark) ${durationRef.current ? (currentProgressRef.current / durationRef.current) * 100 : 0}%, transparent ${durationRef.current ? (currentProgressRef.current / durationRef.current) * 100 : 0}%, transparent 100%)` : ''
                                        }}
                                    >
                                        <div className="text-center text-xs text-discord-muted group-hover:text-white relative">
                                            <span className={isActive ? 'text-discord-blurple group-hover:hidden' : 'group-hover:hidden'}>
                                                {track.isDownloading ? <i className="fa-solid fa-cloud-arrow-down animate-pulse text-discord-blurple"></i> : (isActive && isPlaying ? <i className="fa-solid fa-volume-high animate-pulse"></i> : idx + 1)}
                                            </span>
                                            {!track.isDownloading && (
                                                <i className="fa-solid fa-play hidden group-hover:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white"
                                                    onClick={(e) => { e.stopPropagation(); view === 'songs' ? selectTrack(library.findIndex(t => t.id === track.id), true) : selectTrack(idx, false); }}></i>
                                            )}
                                        </div>

                                        <div className="px-4 flex items-center gap-3 overflow-hidden">
                                            {(track.coverUrl || track.ytThumbnail || track.uploaderThumbnail) ? (
                                                (() => {
                                                    const finalCover = track.coverUrl || track.ytThumbnail || track.uploaderThumbnail;
                                                    if (finalCover.startsWith('gradient:')) {
                                                        return <div className={`w-8 h-8 rounded shadow-sm flex-shrink-0 ${track.isDownloading ? 'animate-pulse opacity-50' : ''}`} style={{ background: `linear-gradient(135deg, ${finalCover.replace('gradient:', '').split('-')[0]}, ${finalCover.replace('gradient:', '').split('-')[1]})` }}></div>;
                                                    }
                                                    return <img src={finalCover.startsWith('/') ? `http://127.0.0.1:5888${finalCover}${finalCover.includes('?') ? '&' : '?'}s=100` : finalCover} onError={(e) => { e.target.style.display = 'none'; }} className={`w-8 h-8 rounded shadow-sm object-cover flex-shrink-0 ${track.isDownloading ? 'animate-pulse opacity-50' : ''}`} alt="" />;
                                                })()
                                            ) : (
                                                <div className="w-8 h-8 rounded bg-discord-tertiary flex items-center justify-center text-[10px] flex-shrink-0" style={{ background: track.artist !== 'Unknown Artist' ? `linear-gradient(135deg, #${(track.artist.length * 12345).toString(16).slice(0, 6).padStart(6, 'f')}, #${(track.artist.length * 67890).toString(16).slice(0, 6).padStart(6, '3')})` : '' }}>
                                                    <i className={`fa-solid fa-music opacity-50 ${track.isDownloading ? 'animate-bounce' : ''}`}></i>
                                                </div>
                                            )}
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-sm font-medium truncate ${isActive ? 'text-discord-blurple' : 'text-discord-text'} ${track.isDownloading ? 'italic opacity-70' : ''}`}>
                                                        {track.title ? track.title.replace(/\[.*?(official|music|video|audio|lyric|live|remaster).*?\]|\(.*?(official|music|video|audio|lyric|live|remaster).*?\)/gi, '').trim() : 'Unknown Title'}
                                                    </span>
                                                    {track.isDownloading ? (
                                                        <span className="text-[10px] text-discord-blurple font-bold">{ytDownloadProgress[track.videoId] || '0'}%</span>
                                                    ) : currentlyEnriching === track.id ? (
                                                        <i className="fa-solid fa-wand-magic-sparkles text-[10px] text-discord-blurple animate-pulse"></i>
                                                    ) : enrichmentQueue.includes(track.id) ? (
                                                        <i className="fa-solid fa-hourglass-half text-[10px] text-yellow-500/50"></i>
                                                    ) : (
                                                        <i className="fa-solid fa-circle-check text-[10px] text-green-500/30 text-opacity-80"></i>
                                                    )}
                                                </div>
                                                <span className={`text-[11px] text-discord-muted truncate ${track.isDownloading ? 'italic opacity-70' : ''}`}>{track.artist}</span>
                                            </div>
                                        </div>

                                        <div className={`px-4 hidden md:block text-xs text-discord-muted truncate ${track.isDownloading ? 'italic opacity-50' : ''}`}>
                                            {track.isDownloading ? 'Descargando...' : (track.album && track.album !== 'Unknown Album' && track.album !== 'Descargas de YT' ? track.album : '-')}
                                        </div>

                                        <div className="px-4 flex items-center justify-end gap-3">
                                            {!track.isDownloading && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const newRating = track.rating === 1 ? 0 : 1;
                                                        if (window.StorageApi) window.StorageApi.rateTrack(track.id, newRating);
                                                        setLibrary(prev => prev.map(t => t.id === track.id ? { ...t, rating: newRating } : t));
                                                        if (view === 'queue') {
                                                            setPlaybackQueue(prev => prev.map(t => t.id === track.id ? { ...t, rating: newRating } : t));
                                                        }
                                                    }}
                                                    className={`transition-colors p-1 rounded-full ${track.rating === 1 ? 'text-red-500 bg-red-500/10' : 'text-discord-muted hover:text-red-500'}`}
                                                >
                                                    <i className={track.rating === 1 ? "fa-solid fa-heart" : "fa-regular fa-heart"}></i>
                                                </button>
                                            )}
                                            <span className="text-xs text-discord-muted font-mono">{track.isDownloading ? '-' : (window.formatTime ? window.formatTime(track.duration) : '0:00')}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

window.LibraryView = React.memo(LibraryView);
