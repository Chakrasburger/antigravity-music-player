// src/components/PlayerBar.js
// ChakrasPlayer - Player Bar Component
// Requiere globals: React, window.StorageApi, window.formatTime

const PlayerBar = ({
    activeTrack, currentlyEnriching, 
    playbackQueue, setPlaybackQueue, 
    library, setLibrary,
    isShuffle, toggleShuffle,
    isMixMode, setIsMixMode,
    prevTrack, seekBackward10,
    isPlaying, togglePlay,
    seekForward10, nextTrack,
    repeatMode, toggleRepeat,
    uiCurrentTimeTextRef, currentProgressRef, uiProgressInputRef,
    duration, handleSeek,
    handleDeviceSelect, audioDeviceId, showDevicePicker, setShowDevicePicker, audioDevices, selectDevice,
    togglePopUpView, view, initPiP,
    isMuted, toggleMute, volume, handleVolume
}) => {
    return (
        <footer className="w-full h-[90px] shrink-0 glass-panel border-t border-white/5 px-6 flex items-center justify-between z-50 shadow-[0_-4px_30px_rgba(0,0,0,0.1)] relative">
            {/* Left: Track Info */}
            <div className="flex items-center gap-4 w-1/3 min-w-[200px]">
                {activeTrack && (
                    <>
                        {(activeTrack.coverUrl || activeTrack.ytThumbnail || activeTrack.uploaderThumbnail) ? (
                            (() => {
                                const finalCover = activeTrack.coverUrl || activeTrack.ytThumbnail || activeTrack.uploaderThumbnail;
                                if (finalCover.startsWith('gradient:')) {
                                    return <div className="w-14 h-14 rounded shadow-sm border border-discord-secondary flex-shrink-0" style={{ background: `linear-gradient(135deg, ${finalCover.replace('gradient:', '').split('-')[0]}, ${finalCover.replace('gradient:', '').split('-')[1]})` }}></div>;
                                }
                                return <img src={finalCover.startsWith('/') ? `http://127.0.0.1:5888${finalCover}${finalCover.includes('?') ? '&' : '?'}s=400` : finalCover} onError={(e) => { e.target.style.display = 'none'; }} className="w-14 h-14 rounded shadow-sm object-cover border border-discord-secondary" alt="cover" />;
                            })()
                        ) : (
                            <div className={`w-14 h-14 rounded flex items-center justify-center border border-white/5 ${currentlyEnriching === activeTrack.id ? 'skeleton' : 'bg-discord-secondary text-discord-muted border-discord-border/50'}`}>
                                <i className="fa-solid fa-music text-xl"></i>
                            </div>
                        )}
                        <div className="flex flex-col min-w-0 pr-4">
                            <span className={`font-semibold text-sm truncate cursor-pointer hover:underline ${currentlyEnriching === activeTrack.id && (activeTrack.title.includes('file') || activeTrack.title.includes('Track')) ? 'skeleton w-32' : 'text-discord-text'}`}>{activeTrack.title}</span>
                            <span className={`text-xs hover:underline cursor-pointer truncate ${currentlyEnriching === activeTrack.id && activeTrack.artist === 'Unknown Artist' ? 'skeleton w-24 mt-1' : 'text-discord-muted'}`}>{activeTrack.artist}</span>
                        </div>
                        <button onClick={() => {
                            const newRating = activeTrack.rating === 1 ? 0 : 1;
                            if(window.StorageApi) window.StorageApi.rateTrack(activeTrack.id, newRating);
                            setPlaybackQueue(playbackQueue.map(t => t.id === activeTrack.id ? { ...t, rating: newRating } : t));
                            setLibrary(library.map(t => t.id === activeTrack.id ? { ...t, rating: newRating } : t));
                        }} className={`text-xl transition-colors morphing-button ml-2 p-1.5 rounded-full ${activeTrack.rating === 1 ? 'text-red-500 bg-red-500/10' : 'text-discord-muted hover:text-discord-text'}`}>
                            <i className={`${activeTrack.rating === 1 ? 'fa-solid' : 'fa-regular'} fa-heart`}></i>
                        </button>
                    </>
                )}
            </div>

            {/* Center: Controls & Progress */}
            <div className="flex flex-col items-center justify-center w-1/3 max-w-[500px]">
                <div className="flex items-center gap-6 mb-2">
                    <button onClick={toggleShuffle} className={`${isShuffle ? 'text-discord-blurple' : 'text-discord-muted'} hover:text-discord-text transition-colors text-sm relative`} title="Shuffle">
                        <i className="fa-solid fa-shuffle"></i>
                    </button>
                    <button onClick={() => setIsMixMode(!isMixMode)} className={`${isMixMode ? 'text-discord-blurple' : 'text-discord-muted'} hover:text-discord-text transition-colors text-sm relative`} title="Mix Mode (Crossfade)">
                        <i className="fa-solid fa-wand-magic-sparkles mr-0.5"></i>
                        <span className="text-[9px] font-bold">MIX</span>
                        {isMixMode && <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-discord-blurple rounded-full"></span>}
                    </button>
                    <button onClick={prevTrack} className="text-discord-muted hover:text-discord-text transition-colors text-lg"><i className="fa-solid fa-backward-step"></i></button>
                    <button onClick={seekBackward10} className="text-discord-muted hover:text-discord-text transition-colors text-[10px] ml-1 mr-[-4px]" title="Retroceder 10s"><i className="fa-solid fa-rotate-left"></i></button>
                    <button
                        onClick={togglePlay}
                        className="morphing-button w-8 h-8 flex items-center justify-center bg-discord-text text-white rounded-full hover:scale-105 hover:bg-discord-blurple transition-all shadow-sm mx-2"
                    >
                        <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} ${!isPlaying ? 'ml-0.5' : ''}`}></i>
                    </button>
                    <button onClick={seekForward10} className="text-discord-muted hover:text-discord-text transition-colors text-[10px] mr-1 ml-[-4px]" title="Adelantar 10s"><i className="fa-solid fa-rotate-right"></i></button>
                    <button onClick={nextTrack} className="text-discord-muted hover:text-discord-text transition-colors text-lg"><i className="fa-solid fa-forward-step"></i></button>
                    <button onClick={toggleRepeat} className={`${repeatMode !== 'off' ? 'text-discord-blurple' : 'text-discord-muted'} hover:text-discord-text transition-colors text-sm relative`}>
                        <i className="fa-solid fa-repeat"></i>
                        {repeatMode === 'one' && <span className="absolute text-[8px] bg-discord-bg font-bold top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%]">1</span>}
                        {repeatMode !== 'off' && <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-discord-blurple rounded-full"></span>}
                    </button>
                </div>

                <div className="flex items-center gap-2 w-full text-xs text-discord-muted font-medium font-sans group">
                    <span ref={uiCurrentTimeTextRef} className="w-10 text-right">{window.formatTime ? window.formatTime(currentProgressRef.current || 0) : '0:00'}</span>
                    <input
                        ref={uiProgressInputRef}
                        type="range" min="0" max={duration || 100} step="0.1" defaultValue={0} 
                        onInput={(e) => {
                            const perc = (e.target.value / (duration || 100)) * 100;
                            e.target.style.background = `linear-gradient(to right, var(--color-vibrant, var(--color-blurple)) ${perc}%, var(--color-tertiary) ${perc}%)`;
                            handleSeek(e);
                        }}
                        className="progress-bar group-hover:block"
                        style={{ background: `linear-gradient(to right, var(--color-vibrant, var(--color-blurple)) ${duration ? (currentProgressRef.current / duration) * 100 : 0}%, var(--color-tertiary) ${duration ? (currentProgressRef.current / duration) * 100 : 0}%)` }}
                    />
                    <span className="w-10 text-left">{window.formatTime ? window.formatTime(duration) : '0:00'}</span>
                </div>
            </div>

            {/* Right: Volume & Extra Controls */}
            <div className="flex items-center justify-end gap-4 w-1/3 text-discord-muted pr-4 relative">
                {/* Device Picker Button + Popup */}
                <div className="relative hidden md:block">
                    <button onClick={handleDeviceSelect} title="Audio Device" className="hover:text-discord-text transition-colors">
                        <i className={`fa-solid fa-speaker ${audioDeviceId ? 'text-discord-blurple' : ''}`}></i>
                    </button>
                    {showDevicePicker && audioDevices && audioDevices.length > 0 && (
                        <div className="absolute bottom-full right-0 mb-3 w-72 bg-discord-secondary/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-3 z-[200] animate-in fade-in slide-in-from-bottom-2 duration-200">
                            <div className="flex items-center justify-between mb-3 px-1">
                                <h4 className="text-sm font-bold text-discord-text flex items-center gap-2"><i className="fa-solid fa-speaker text-discord-blurple"></i> Audio Output</h4>
                                <button onClick={() => setShowDevicePicker(false)} className="text-discord-muted hover:text-white text-xs"><i className="fa-solid fa-xmark"></i></button>
                            </div>
                            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                                {audioDevices.map((device, idx) => (
                                    <button
                                        key={device.deviceId || idx}
                                        onClick={() => selectDevice(device.deviceId)}
                                        className={`text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-all flex items-center gap-3 ${audioDeviceId === device.deviceId ? 'bg-discord-blurple/20 text-discord-blurple border border-discord-blurple/30' : 'text-discord-text hover:bg-white/5'}`}
                                    >
                                        <i className={`fa-solid ${device.label?.toLowerCase().includes('bluetooth') ? 'fa-bluetooth-b text-blue-400' : device.label?.toLowerCase().includes('headphone') || device.label?.toLowerCase().includes('airpods') ? 'fa-headphones' : 'fa-volume-high'}`}></i>
                                        <span className="truncate">{device.label || `Speaker ${idx + 1}`}</span>
                                        {audioDeviceId === device.deviceId && <i className="fa-solid fa-check ml-auto text-discord-blurple"></i>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <button onClick={() => togglePopUpView('lyrics')} title="Lyrics" className={`${view === 'lyrics' ? 'text-discord-blurple' : 'text-discord-muted'} hover:text-discord-text transition-colors hidden md:block`}>
                    <i className="fa-solid fa-microphone-lines"></i>
                </button>
                <button onClick={initPiP} title="Mini-Reproductor Flotante" className={`text-discord-muted hover:text-discord-blurple transition-colors hidden md:block`}>
                    <i className="fa-solid fa-up-right-and-down-left-from-center pb-1 text-sm"></i>
                </button>
                <button onClick={() => togglePopUpView('queue')} title="Queue" className={`${view === 'queue' ? 'text-discord-blurple' : 'text-discord-muted'} hover:text-discord-text transition-colors hidden lg:block`}>
                    <i className="fa-solid fa-list-ul"></i>
                </button>
                <button onClick={() => togglePopUpView('settings')} title="Settings" className={`${view === 'settings' ? 'text-discord-blurple' : 'text-discord-muted'} hover:text-discord-text transition-colors hidden md:block`}>
                    <i className="fa-solid fa-gear"></i>
                </button>
                <div className="flex items-center gap-2 w-28 pl-2">
                    <i onClick={toggleMute} className={`fa-solid ${isMuted || volume === 0 ? 'fa-volume-xmark text-red-500' : volume < 0.5 ? 'fa-volume-low text-discord-blurple' : 'fa-volume-high text-discord-blurple'} text-sm cursor-pointer hover:scale-110 transition-transform`}></i>
                    <input
                        type="range" min="0" max="1" step="0.01" value={volume} 
                        onInput={(e) => {
                            const v = parseFloat(e.target.value);
                            const perc = v * 100;
                            const color = (isMuted || v === 0) ? '#ef4444' : 'var(--color-vibrant, var(--color-blurple))';
                            e.target.style.background = `linear-gradient(to right, ${color} ${perc}%, var(--color-tertiary) ${perc}%)`;
                            handleVolume(e);
                        }}
                        className="progress-bar w-full"
                        style={{ background: `linear-gradient(to right, ${isMuted || volume === 0 ? '#ef4444' : 'var(--color-vibrant, var(--color-blurple))'} ${volume * 100}%, var(--color-tertiary) ${volume * 100}%)` }}
                    />
                </div>
            </div>
        </footer>
    );
};

window.PlayerBar = React.memo(PlayerBar);
