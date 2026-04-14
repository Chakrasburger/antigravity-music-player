// src/components/YtSearchView.js
// ChakrasPlayer - YouTube Search View Component

const YtSearchView = ({
    handleYtSearch,
    ytSearchQuery,
    setYtSearchQuery,
    isYtSearching,
    ytSearchResults,
    triggerYtDownload,
    ytDownloadTarget,
    ytDownloadProgress
}) => {
    return (
        <div className="flex flex-col h-full space-y-6 p-8 animate-in fade-in duration-300">
            <form onSubmit={handleYtSearch} className="flex gap-4">
                <div className="relative flex-1 group">
                    <i className="fa-brands fa-youtube absolute left-5 top-1/2 -translate-y-1/2 text-discord-muted group-focus-within:text-[#FF0000] transition-colors text-lg"></i>
                    <input
                        type="text"
                        placeholder="Busca canciones, artistas o mixes en YouTube..."
                        className="w-full bg-black/40 border border-white/10 rounded-full py-3.5 pl-14 pr-6 text-discord-text focus:outline-none focus:border-[#FF0000]/50 focus:bg-black/60 transition-all placeholder:text-discord-muted/50 backdrop-blur-md shadow-inner"
                        value={ytSearchQuery}
                        onChange={(e) => setYtSearchQuery(e.target.value)}
                    />
                </div>
                <button
                    type="submit"
                    disabled={isYtSearching}
                    className="bg-[#FF0000] hover:bg-[#CC0000] text-white px-8 rounded-full font-bold shadow-lg transition-all disabled:opacity-50 flex items-center gap-2 hover:scale-[1.02] active:scale-95"
                >
                    {isYtSearching ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-search"></i>}
                    Buscar
                </button>
            </form>

            <div className="flex-1 overflow-y-auto px-1 custom-scrollbar pb-10">
                {isYtSearching ? (
                    <div className="flex flex-col items-center justify-center h-full text-discord-muted space-y-6">
                        <div className="w-14 h-14 border-4 border-white/10 border-t-[#FF0000] rounded-full animate-spin"></div>
                        <p className="font-semibold text-lg animate-pulse tracking-wide">Analizando resultados nativos...</p>
                    </div>
                ) : ytSearchResults.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {ytSearchResults.map((video, idx) => (
                            <div key={idx} className="glass-panel p-4 flex flex-col gap-3 group hover:border-[#FF0000]/30 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(255,0,0,0.1)] relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF0000]/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black/50 shadow-inner">
                                    {video.thumbnail ? (
                                        <img src={video.thumbnail} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" alt={video.title} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-discord-muted"><i className="fa-brands fa-youtube text-5xl opacity-50"></i></div>
                                    )}
                                    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-bold px-2 py-1 rounded backdrop-blur-sm border border-white/10">
                                        {video.duration}
                                    </div>
                                </div>
                                <div className="flex flex-col min-w-0 flex-1 z-10">
                                    <h3 className="font-bold text-base leading-tight line-clamp-2 title-shadow group-hover:text-discord-text transition-colors" title={video.title}>{video.title}</h3>
                                    <div className="flex items-center gap-2 mt-2 text-discord-muted text-sm">
                                        <i className="fa-solid fa-tv text-[10px]"></i>
                                        <span className="truncate">{video.uploader}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => triggerYtDownload(video)}
                                    disabled={ytDownloadTarget === video.id || ytDownloadProgress[video.id]}
                                    className="mt-3 w-full bg-discord-secondary/50 hover:bg-discord-blurple disabled:opacity-80 disabled:cursor-not-allowed text-discord-text hover:text-white font-bold py-2.5 rounded shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 border border-white/5 hover:border-transparent z-10 relative overflow-hidden"
                                >
                                    {(ytDownloadTarget === video.id || ytDownloadProgress[video.id]) ? (
                                        <>
                                            <div className="absolute top-0 left-0 h-full bg-[#FF0000]/60 transition-all duration-300 ease-out z-0" style={{ width: `${ytDownloadProgress[video.id] || 0}%` }}></div>
                                            <span className="z-10 flex items-center gap-2 drop-shadow-md">
                                                {ytDownloadProgress[video.id] === '100.0' ? <i className="fa-solid fa-check text-green-400"></i> : <i className="fa-solid fa-circle-notch fa-spin"></i>}
                                                {ytDownloadProgress[video.id] === '100.0' ? 'Inyectada' : `Inyectando... ${ytDownloadProgress[video.id] || 0}%`}
                                            </span>
                                        </>
                                    ) : (
                                        <><i className="fa-solid fa-cloud-arrow-down"></i> Descargar Audio HQ</>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                ) : ytSearchQuery && !isYtSearching ? (
                    <div className="flex flex-col items-center justify-center h-full text-discord-muted opacity-60">
                        <i className="fa-regular fa-face-frown text-6xl mb-4"></i>
                        <p className="text-xl font-bold text-discord-text">Sin resultados en YouTube.</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-discord-muted opacity-40 mt-12 animate-in slide-in-from-bottom-4 duration-700 ease-out">
                        <div className="relative">
                            <i className="fa-brands fa-youtube text-[100px] mb-6 drop-shadow-[0_0_30px_rgba(255,0,0,0.3)]"></i>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[#FF0000] blur-[80px] rounded-full opacity-20 -z-10"></div>
                        </div>
                        <p className="text-2xl font-bold text-discord-text tracking-tight">El universo musical a un clic</p>
                        <p className="text-base mt-3 max-w-md text-center">Busca cualquier canción, y nuestro motor de extracción en segundo plano la procesará en mp3 a 192kbps.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
