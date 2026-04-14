// src/components/AlbumsView.js
// ChakrasPlayer - Albums View Component

const AlbumsView = ({ library, setPlaybackQueue, setOriginalQueue, setCurrentTrackIndex, setIsPlaying, setView }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {Object.entries(library.reduce((acc, track) => {
                acc[track.album] = acc[track.album] || [];
                acc[track.album].push(track);
                return acc;
            }, {})).sort(([a], [b]) => a.localeCompare(b)).map(([album, tracks]) => {
                const cover = tracks.find(t => t.coverUrl)?.coverUrl;
                return (
                    <div key={album} className="bg-discord-secondary/30 rounded-lg p-4 cursor-pointer hover:bg-discord-secondary transition-colors group flex flex-col items-center text-center shadow-sm"
                        onClick={() => {
                            setPlaybackQueue(tracks);
                            setOriginalQueue(tracks);
                            setCurrentTrackIndex(0);
                            setIsPlaying(true);
                            setView('queue');
                        }}>
                        {cover ? (
                            cover.startsWith('gradient:') ? (
                                <div className="w-full aspect-square rounded shadow mb-3 group-hover:shadow-md transition-shadow border border-discord-border/50" style={{ background: `linear-gradient(135deg, ${cover.replace('gradient:', '').split('-')[0]}, ${cover.replace('gradient:', '').split('-')[1]})` }}></div>
                            ) : (
                                <img src={cover.startsWith('/') ? `http://127.0.0.1:5888${cover}${cover.includes('?') ? '&' : '?'}s=400` : cover} className="w-full aspect-square object-cover rounded shadow mb-3 group-hover:shadow-md transition-shadow border border-discord-border/50" alt={album} />
                            )
                        ) : (
                            <div className="w-full aspect-square bg-discord-tertiary rounded flex items-center justify-center mb-3 text-discord-muted shadow border border-discord-border/50"><i className="fa-solid fa-compact-disc text-4xl"></i></div>
                        )}
                        <h3 className="font-bold text-discord-text text-sm truncate w-full" title={album}>{album}</h3>
                        <p className="text-xs text-discord-muted truncate w-full">{tracks.length > 0 ? tracks[0].artist : 'Unknown'}</p>
                        <p className="text-[10px] text-discord-muted font-semibold mt-1 bg-discord-secondary rounded px-2 py-0.5">{tracks.length} tracks</p>
                    </div>
                );
            })}
        </div>
    );
}
