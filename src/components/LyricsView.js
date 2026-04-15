// src/components/LyricsView.js
// ChakrasPlayer - Lyrics View Component with Enhanced Tools

const LyricsView = ({
    isPlaying,
    lyricsLoading,
    lyricsError,
    lyricsData,
    lyricsContainerRef,
    handleSeek,
    activeTrack,
    handleOffsetChange,
    lyricsTools,
    toggleLyricsTool
}) => {
    const {
        fontSize = 'medium',
        theme = 'default',
        showTranslation = true,
        autoScroll = true
    } = lyricsTools || {};

    const fontSizeClasses = {
        small: 'text-sm',
        medium: 'text-xl',
        large: 'text-2xl',
        xlarge: 'text-4xl'
    };

    const themeClasses = {
        default: 'text-white',
        vibrant: 'text-vibrant-light',
        muted: 'text-gray-300',
        gold: 'text-yellow-300'
    };

    const baseFontSize = fontSizeClasses[fontSize] || 'text-xl';
    const baseColor = themeClasses[theme] || 'text-white';

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

            {/* Loading & Error States */}
            {lyricsLoading && <div className="text-discord-muted animate-pulse z-10"><i className="fa-solid fa-circle-notch fa-spin text-2xl mb-2"></i><p>Loading lyrics...</p></div>}
            {lyricsError && <div className="text-discord-muted font-semibold bg-discord-secondary px-6 rounded-lg py-4 border border-discord-border z-10"><i className="fa-solid fa-triangle-exclamation mr-2"></i>{lyricsError}</div>}

            {/* Lyrics Display */}
            {!lyricsLoading && !lyricsError && lyricsData ? (
                <div className="w-full max-w-4xl h-full overflow-y-auto px-6 py-10 relative scrollbar-hide text-center z-10 font-sans"
                    ref={lyricsContainerRef}
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <div className="h-[20vh]"></div>
                    {lyricsData.map((lyric, idx) => {
                        let lineClass = `${baseFontSize} ${baseColor} font-bold mb-10 cursor-pointer max-w-full break-words relative inline-block tracking-tight drop-shadow-xl transition-all duration-300 `;
                        let lineStyle = {};

                        if (lyric.type === 'chorus') lineClass += "text-vibrant-light italic opacity-90 scale-105 ";
                        if (lyric.type === 'secondary') lineClass += "opacity-50 font-medium italic ";
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

            {/* Enhanced Lyrics Toolbar */}
            {lyricsData && !lyricsLoading && !lyricsError && (
                <>
                    {/* Top Right: Sync Controls */}
                    <div className="absolute top-4 right-4 z-50 flex flex-col gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
                        {/* Sync Offset Controls */}
                        <div className="flex items-center bg-discord-secondary/90 backdrop-blur-md rounded-lg p-2 gap-2 border border-discord-border shadow-lg transition duration-200 hover:bg-discord-secondary">
                            <button
                                className="px-3 py-2 rounded bg-discord-dark hover:bg-discord-hover text-xs font-bold transition flex flex-col items-center shadow-inner min-w-[50px]"
                                onClick={(e) => { e.stopPropagation(); handleOffsetChange(-0.5); }}
                                title="Atrasar Karaoke (-0.5s)"
                            >
                                <i className="fa-solid fa-backward-step mb-1"></i>
                                <span className="text-[10px]">-0.5s</span>
                            </button>
                            <div className="flex flex-col items-center px-3 min-w-[60px]">
                                <span className="text-[10px] text-discord-muted font-bold uppercase tracking-wider">Sync</span>
                                <span className={`text-sm font-bold ${(activeTrack?.lyricsOffset || 0) !== 0 ? 'text-vibrant-light' : 'text-gray-400'}`}>
                                    {(activeTrack?.lyricsOffset || 0) > 0 ? '+' : ''}{(activeTrack?.lyricsOffset || 0).toFixed(1)}s
                                </span>
                            </div>
                            <button
                                className="px-3 py-2 rounded bg-discord-dark hover:bg-discord-hover text-xs font-bold transition flex flex-col items-center shadow-inner min-w-[50px]"
                                onClick={(e) => { e.stopPropagation(); handleOffsetChange(0.5); }}
                                title="Adelantar Karaoke (+0.5s)"
                            >
                                <i className="fa-solid fa-forward-step mb-1"></i>
                                <span className="text-[10px]">+0.5s</span>
                            </button>
                            {(activeTrack?.lyricsOffset || 0) !== 0 && (
                                <button
                                    className="ml-1 px-2 py-2 rounded bg-red-500/20 hover:bg-red-500/40 text-red-400 text-xs font-bold transition"
                                    onClick={(e) => { e.stopPropagation(); handleOffsetChange('reset'); }}
                                    title="Restablecer Sync"
                                >
                                    <i className="fa-solid fa-rotate-right"></i>
                                </button>
                            )}
                        </div>

                        {/* Display Settings */}
                        <div className="flex items-center bg-discord-secondary/90 backdrop-blur-md rounded-lg p-2 gap-1 border border-discord-border shadow-lg">
                            {/* Font Size Control */}
                            <div className="flex items-center gap-1 px-1">
                                <button
                                    className={`w-7 h-7 rounded flex items-center justify-center text-xs transition ${fontSize === 'small' ? 'bg-vibrant-dark text-white' : 'bg-discord-dark hover:bg-discord-hover text-gray-400'}`}
                                    onClick={() => toggleLyricsTool('fontSize', 'small')}
                                    title="Texto Pequeño"
                                >
                                    <i className="fa-solid fa-text-height text-xs"></i>
                                </button>
                                <button
                                    className={`w-7 h-7 rounded flex items-center justify-center text-xs transition ${fontSize === 'medium' ? 'bg-vibrant-dark text-white' : 'bg-discord-dark hover:bg-discord-hover text-gray-400'}`}
                                    onClick={() => toggleLyricsTool('fontSize', 'medium')}
                                    title="Texto Mediano"
                                >
                                    <i className="fa-solid fa-text-height text-sm"></i>
                                </button>
                                <button
                                    className={`w-7 h-7 rounded flex items-center justify-center text-xs transition ${fontSize === 'large' ? 'bg-vibrant-dark text-white' : 'bg-discord-dark hover:bg-discord-hover text-gray-400'}`}
                                    onClick={() => toggleLyricsTool('fontSize', 'large')}
                                    title="Texto Grande"
                                >
                                    <i className="fa-solid fa-text-height text-base"></i>
                                </button>
                                <button
                                    className={`w-7 h-7 rounded flex items-center justify-center text-xs transition ${fontSize === 'xlarge' ? 'bg-vibrant-dark text-white' : 'bg-discord-dark hover:bg-discord-hover text-gray-400'}`}
                                    onClick={() => toggleLyricsTool('fontSize', 'xlarge')}
                                    title="Texto Extra Grande"
                                >
                                    <i className="fa-solid fa-text-height text-lg"></i>
                                </button>
                            </div>

                            <div className="w-px h-7 bg-discord-border mx-1"></div>

                            {/* Theme Selector */}
                            <button
                                className="w-7 h-7 rounded bg-discord-dark hover:bg-discord-hover text-gray-400 flex items-center justify-center transition"
                                onClick={() => toggleLyricsTool('theme', theme === 'default' ? 'vibrant' : theme === 'vibrant' ? 'gold' : theme === 'gold' ? 'muted' : 'default')}
                                title={`Tema: ${theme}`}
                            >
                                <i className="fa-solid fa-palette"></i>
                            </button>

                            {/* Auto Scroll Toggle */}
                            <button
                                className={`w-7 h-7 rounded flex items-center justify-center transition ${autoScroll ? 'bg-vibrant-dark text-white' : 'bg-discord-dark hover:bg-discord-hover text-gray-400'}`}
                                onClick={() => toggleLyricsTool('autoScroll', !autoScroll)}
                                title={autoScroll ? 'Auto-scroll activado' : 'Auto-scroll desactivado'}
                            >
                                <i className="fa-solid fa-arrows-up-down"></i>
                            </button>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex items-center bg-discord-secondary/90 backdrop-blur-md rounded-lg p-2 gap-2 border border-discord-border shadow-lg">
                            {/* Search in Lyrics */}
                            <button
                                className="w-8 h-8 rounded bg-discord-dark hover:bg-discord-hover text-gray-400 flex items-center justify-center transition"
                                title="Buscar en letras"
                            >
                                <i className="fa-solid fa-magnifying-glass text-xs"></i>
                            </button>
                            {/* Refresh Lyrics */}
                            <button
                                className="w-8 h-8 rounded bg-discord-dark hover:bg-discord-hover text-gray-400 flex items-center justify-center transition"
                                title="Recargar letras"
                            >
                                <i className="fa-solid fa-arrows-rotate text-xs"></i>
                            </button>
                            {/* Export Lyrics */}
                            <button
                                className="w-8 h-8 rounded bg-discord-dark hover:bg-discord-hover text-gray-400 flex items-center justify-center transition"
                                title="Exportar letras"
                            >
                                <i className="fa-solid fa-download text-xs"></i>
                            </button>
                        </div>
                    </div>

                    {/* Bottom Center: Offset Display */}
                    {(activeTrack?.lyricsOffset || 0) !== 0 && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-vibrant-dark/80 backdrop-blur-md rounded-full px-4 py-2 border border-vibrant-light/30 shadow-lg">
                            <span className="text-xs font-bold text-white">
                                <i className="fa-solid fa-clock mr-1"></i>
                                Offset: {(activeTrack?.lyricsOffset || 0) > 0 ? '+' : ''}{(activeTrack?.lyricsOffset || 0).toFixed(1)}s
                            </span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
