// src/components/Sidebar.js
// ChakrasPlayer - Sidebar Component
// Requiere globals: React

const Sidebar = ({ 
    view, 
    setView, 
    scanDirectory, 
    isScanning, 
    ytDownloadProgress, 
    batchDownloadQueue, 
    seenDownloadsCount,
    isCompact,
    toggleCompact
}) => {
    return (
        <aside className={`glass-panel flex flex-col pt-6 pb-12 border-r border-white/5 h-full overflow-y-auto overflow-x-hidden transition-all duration-300 ${isCompact ? 'w-[72px] items-center' : 'w-full'}`}>
            <div className={`px-4 mb-8 flex items-center gap-3 logo-container ${isCompact ? 'flex-col' : ''}`}>
                <button 
                    onClick={toggleCompact}
                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 group"
                    title={isCompact ? "Expandir Sidebar" : "Contraer Sidebar"}
                >
                    {isCompact ? <i className="fa-solid fa-list-check text-discord-blurple"></i> : <i className="fa-solid fa-bars-staggered opacity-60 group-hover:opacity-100"></i>}
                </button>
                {!isCompact && (
                    <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl accent-gradient text-white flex items-center justify-center shadow-lg relative overflow-hidden group">
                        {/* El nuevo logo diseñado por el usuario en SVG */}
                        <svg viewBox="0 0 100 100" className="w-6 h-6 z-10">
                            <path 
                                d="M75,25 C68,18 59,15 50,15 C30,15 15,30 15,50 C15,70 30,85 50,85 C59,85 68,82 75,75" 
                                fill="none" 
                                stroke="white" 
                                strokeWidth="12" 
                                strokeLinecap="round"
                            />
                            <rect x="35" y="45" width="6" height="10" fill="white" rx="2" />
                            <rect x="45" y="35" width="6" height="30" fill="white" rx="2" />
                            <rect x="55" y="25" width="6" height="50" fill="white" rx="2" />
                            <rect x="65" y="35" width="6" height="30" fill="white" rx="2" />
                            <rect x="75" y="45" width="6" height="10" fill="white" rx="2" />
                        </svg>
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-white truncate">Chakras</h1>
                    </div>
                )}
            </div>

            <nav className={`flex flex-col gap-2 mb-6 ${isCompact ? 'px-2' : 'px-3'}`}>
                {[
                    { id: 'searchYt', icon: 'fa-magnifying-glass', label: 'Buscar', color: '#FF0000' },
                    { id: 'songs', icon: 'fa-headphones', label: 'Songs' },
                    { id: 'albums', icon: 'fa-record-vinyl', label: 'Albums' },
                    { id: 'playlists', icon: 'fa-list-ul', label: 'Playlists' },
                    { id: 'artists', icon: 'fa-user-group', label: 'Artists' },
                    { id: 'analytics', icon: 'fa-chart-pie', label: 'Analytics' },
                    { id: 'ai-assistant', icon: 'fa-wand-magic-sparkles', label: 'IA Chat', isAi: true },
                    { id: 'downloads', icon: 'fa-cloud-arrow-down', label: 'Downloads', hasBadge: true }
                ].map((item) => {
                    const isActive = view === item.id;
                    const badgeCount = item.hasBadge ? (Object.keys(ytDownloadProgress || {}).length + (batchDownloadQueue || []).length) - (seenDownloadsCount || 0) : 0;
                    
                    return (
                        <div 
                            key={item.id}
                            onClick={() => setView(item.id)} 
                            className={`flex items-center gap-4 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 group relative ${
                                isActive 
                                    ? (item.id === 'searchYt' ? 'bg-[#FF0000] text-white shadow-lg' : item.isAi ? 'accent-glass text-accent border-accent-glow font-bold' : 'bg-white/10 text-white shadow-md font-semibold') 
                                    : 'text-discord-muted hover:bg-white/5 hover:text-white'
                            }`}
                            title={isCompact ? item.label : ''}
                        >
                            <i className={`fa-solid ${item.icon} w-5 text-center text-lg ${isActive ? 'sidebar-icon-active scale-110' : 'opacity-70 group-hover:opacity-100'}`}></i>
                            {!isCompact && <span className="text-sm font-medium">{item.label}</span>}
                            
                            {item.hasBadge && badgeCount > 0 && (
                                <span className={`absolute ${isCompact ? 'top-1 right-1' : 'right-3'} w-4 h-4 bg-[#FF0000] text-white text-[9px] flex items-center justify-center rounded-full animate-bounce border border-black`}>
                                    {badgeCount}
                                </span>
                            )}
                        </div>
                    );
                })}
            </nav>

            {!isCompact && <hr className="border-white/5 mx-4 mb-4" />}

            <div className={`mt-auto space-y-4 ${isCompact ? 'px-2' : 'px-6'}`}>
                <button 
                    onClick={scanDirectory} 
                    disabled={isScanning} 
                    className={`w-full accent-gradient hover:brightness-110 text-white rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${isCompact ? 'h-12' : 'py-3 text-sm font-bold'}`}
                    title={isCompact ? "Add Folder" : ""}
                >
                    {isScanning ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-plus"></i>}
                    {!isCompact && (isScanning ? 'Scanning...' : 'Add Folder')}
                </button>
            </div>
            
            {isScanning && !isCompact && (
                <div className="px-6 py-2 mx-3 mt-4 bg-discord-blurple/10 rounded-lg border border-discord-blurple/20 animate-pulse">
                    <p className="text-[9px] font-bold text-discord-blurple uppercase tracking-wider">Syncing</p>
                </div>
            )}
        </aside>
    );
};

window.Sidebar = React.memo(Sidebar);
