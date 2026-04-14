// src/components/DownloadsView.js
// ChakrasPlayer - Active Downloads View Component
// Requiere globals: React

const DownloadsView = ({ setView, handleBatchUpload, ytDownloadProgress, batchDownloadQueue }) => {
    return (
        <div className="flex flex-col gap-6 w-full h-full p-8 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-3">
                    <i className="fa-solid fa-download text-discord-blurple"></i>
                    Active Downloads
                </h3>
                <div className="flex items-center gap-4">
                    <label className="cursor-pointer bg-discord-blurple hover:bg-[#4752C4] text-white text-xs font-bold py-1.5 px-4 rounded-full shadow-sm transition-all flex items-center gap-2">
                        <i className="fa-solid fa-file-import"></i>
                        Batch Download (.txt/.json)
                        <input type="file" accept=".txt,.json" onChange={handleBatchUpload} className="hidden" />
                    </label>
                    <span className="text-xs font-semibold bg-discord-secondary px-3 py-1 rounded-full text-discord-muted">
                        {Object.keys(ytDownloadProgress).length + batchDownloadQueue.length} Items in Queue
                    </span>
                </div>
            </div>

            {Object.keys(ytDownloadProgress).length === 0 && batchDownloadQueue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-black/20 rounded-xl border border-white/5">
                    <i className="fa-solid fa-cloud-arrow-down text-5xl mb-4 opacity-20"></i>
                    <p className="text-discord-muted font-medium">No active downloads at the moment.</p>
                    <button onClick={() => setView('searchYt')} className="mt-4 text-discord-blurple text-sm font-bold hover:underline">Go to Search YouTube</button>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {/* Manual Downloads Progress */}
                    {Object.entries(ytDownloadProgress).map(([videoId, progress]) => (
                        <div key={videoId} className="glass-panel p-4 flex items-center gap-4 border border-white/5 shadow-md">
                            <div className="w-12 h-12 bg-discord-tertiary rounded flex items-center justify-center relative overflow-hidden">
                                <i className="fa-solid fa-music text-white/30"></i>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-bold truncate">Download ID: {videoId}</span>
                                    <span className="text-xs font-black text-discord-blurple">{progress}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-discord-blurple transition-all duration-500 ease-out"
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                            </div>
                            <div className="text-discord-muted">
                                {progress === '100.0' ? <i className="fa-solid fa-check-circle text-green-400"></i> : <i className="fa-solid fa-circle-notch fa-spin"></i>}
                            </div>
                        </div>
                    ))}

                    {/* Batch Queue Section */}
                    {batchDownloadQueue.length > 0 && (
                        <div className="mt-4">
                            <h4 className="text-xs font-bold text-discord-muted uppercase tracking-wider mb-2">Batch Processing Queue ({batchDownloadQueue.length})</h4>
                            <div className="flex flex-col gap-2">
                                {batchDownloadQueue.map((item, idx) => (
                                    <div key={idx} className={`p-3 rounded-lg border border-white/5 flex items-center gap-3 ${idx === 0 ? 'bg-discord-blurple/10 border-discord-blurple/20' : 'bg-black/10'}`}>
                                        <div className="w-8 h-8 rounded bg-discord-tertiary flex items-center justify-center">
                                            {idx === 0 ? <i className="fa-solid fa-spinner fa-spin text-discord-blurple"></i> : <i className="fa-solid fa-hourglass-start text-discord-muted"></i>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate">{item.title}</p>
                                            <p className="text-[10px] text-discord-muted truncate">{item.artist}</p>
                                        </div>
                                        {idx === 0 && (
                                            <span className="text-[10px] font-bold text-discord-blurple animate-pulse">SOLVING & DOWNLOADING...</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
