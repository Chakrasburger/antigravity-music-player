// src/components/LyricsView.js
// ChakrasPlayer - Lyrics View Component

const LyricsView = ({
    isPlaying,
    lyricsLoading,
    lyricsError,
    lyricsData,
    lyricsContainerRef,
    handleSeek,
    activeTrack,
    handleOffsetChange
}) => {
    return (
        <div className="h-full flex flex-col items-center justify-center relative bg-discord-bg overflow-hidden" style={{ minHeight: 'calc(100vh - 180px)' }}>
            {/* Beat-Sync Reactive Background Effect */}
            {isPlaying && <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full z-0 pointer-events-none transition-all duration-75 ease-out"
                style={{
                    width: 'min(80vw, 800px)',
                    height: 'min(80vw, 800px)',
                    background: 'var(--color-vibrant-dark)',
                    opacity: 'var(--beat-opacity, 0.6)',
                    filter: 'blur(100px) brightness(var(--beat-bright, 1.0))',
                    transform: `scale(var(--beat-scale, 1.0)) translate(-50%, -50%)`,
                    transformOrigin: 'top left'
                }}
            />}

            {lyricsLoading && <div className="text-discord-muted animate-pulse z-10"><i className="fa-solid fa-circle-notch fa-spin text-2xl mb-2"></i><p>Loading lyrics...</p></div>}
            {lyricsError && <div className="text-discord-muted font-semibold bg-discord-secondary px-6 rounded-lg py-4 border border-discord-border z-10"><i className="fa-solid fa-triangle-exclamation mr-2"></i>{lyricsError}</div>}
            {!lyricsLoading && !lyricsError && lyricsData ? (
                <div className="w-full max-w-4xl h-full overflow-y-auto px-6 py-10 relative scrollbar-hide text-center z-10 font-sans" ref={lyricsContainerRef} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <div className="h-[20vh]"></div>
                    {lyricsData.map((lyric, idx) => {
                        let lineClass = "font-bold mb-10 cursor-pointer max-w-full break-words relative inline-block tracking-tight drop-shadow-xl transition-all duration-300 ";
                        let lineStyle = {};

                        if (lyric.type === 'chorus') lineClass += "text-vibrant-light italic opacity-90 scale-105 ";
                        if (lyric.type === 'secondary') lineClass += "opacity-50 text-base font-medium italic ";
                        if (lyric.type === 'annotation') lineClass += "text-xs uppercase tracking-widest text-discord-muted opacity-40 mb-4 ";

                        if (lyric.time !== -1) {
                            lineStyle = {
                                backgroundImage: 'linear-gradient(to right, #fff var(--karaoke-fill, 0%), rgba(255,255,255,0.2) var(--karaoke-fill, 0%))',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text'
                            };
                        }

                        return (
                            <div key={idx} className="w-full">
                                <div
                                    className={`${lineClass} inactive-lyric-line`}
                                    onClick={() => { if (lyric.time !== -1) handleSeek({ target: { value: lyric.time - (activeTrack?.lyricsOffset || 0) } }) }}
                                    style={lineStyle}
                                >
                                    {lyric.text}
                                </div>
                            </div>
                        );
                    })}
                    <div className="h-[40vh]"></div>
                </div>
            ) : (!lyricsLoading && !lyricsError && !lyricsData && (
                <div className="text-discord-muted flex flex-col items-center">
                    <i className="fa-solid fa-microphone-slash text-5xl mb-4 opacity-30"></i>
                    <p className="font-semibold text-sm">No track is currently playing or lyrics are unavailable.</p>
                </div>
            ))}

            {/* Lyrics Offset Controller */}
            {lyricsData && !lyricsLoading && !lyricsError && (
                <div className="absolute top-4 right-8 z-50 flex items-center bg-discord-secondary/80 backdrop-blur-md rounded-lg p-2 gap-2 border border-discord-border shadow-lg transition duration-200 hover:bg-discord-secondary" style={{ WebkitAppRegion: 'no-drag' }}>
                    <button
                        className="px-3 py-1 rounded bg-discord-dark hover:bg-discord-hover text-xs font-bold transition flex flex-col items-center shadow-inner"
                        onClick={(e) => { e.stopPropagation(); handleOffsetChange(-0.5); }}
                        title="Atrasar Karaoke"
                    >
                        <i className="fa-solid fa-backward-step mb-1"></i> -0.5s
                    </button>
                    <div className="flex flex-col items-center px-4 min-w-[70px]">
                        <span className="text-[10px] text-discord-muted font-bold uppercase tracking-wider">Sync</span>
                        <span className={`text-sm font-bold ${(activeTrack?.lyricsOffset || 0) !== 0 ? 'text-vibrant-light' : 'text-gray-400'}`}>
                            {(activeTrack?.lyricsOffset || 0) > 0 ? '+' : ''}{(activeTrack?.lyricsOffset || 0).toFixed(1)}s
                        </span>
                    </div>
                    <button
                        className="px-3 py-1 rounded bg-discord-dark hover:bg-discord-hover text-xs font-bold transition flex flex-col items-center shadow-inner"
                        onClick={(e) => { e.stopPropagation(); handleOffsetChange(0.5); }}
                        title="Adelantar Karaoke"
                    >
                        <i className="fa-solid fa-forward-step mb-1"></i> +0.5s
                    </button>
                    {(activeTrack?.lyricsOffset || 0) !== 0 && (
                        <button
                            className="ml-2 px-3 py-2 rounded bg-red-500/20 hover:bg-red-500/40 text-red-400 text-xs font-bold transition drop-shadow-lg"
                            onClick={(e) => { e.stopPropagation(); handleOffsetChange('reset'); }}
                            title="Restablecer"
                        >
                            <i className="fa-solid fa-rotate-right"></i>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
