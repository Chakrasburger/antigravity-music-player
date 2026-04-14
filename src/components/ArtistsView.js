// src/components/ArtistsView.js
// ChakrasPlayer - Artists View Component

const ArtistsView = ({ library, setPlaybackQueue, setOriginalQueue, setCurrentTrackIndex, setIsPlaying, setView }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
            {Object.entries(library.reduce((acc, track) => {
                acc[track.artist] = acc[track.artist] || [];
                acc[track.artist].push(track);
                return acc;
            }, {})).sort(([a], [b]) => a.localeCompare(b)).map(([artist, tracks]) => {
                const cover = tracks.find(t => t.coverUrl)?.coverUrl;
                return (
                    <div key={artist} className="bg-transparent p-2 cursor-pointer group flex flex-col items-center text-center"
                        onClick={() => {
                            setPlaybackQueue(tracks);
                            setOriginalQueue(tracks);
                            setCurrentTrackIndex(0);
                            setIsPlaying(true);
                            setView('queue');
                        }}>
                        <div className="w-32 h-32 md:w-40 md:h-40 relative rounded-full mb-4 shadow-sm group-hover:shadow-lg transition-all transform group-hover:-translate-y-1">
                            {cover ? (
                                cover.startsWith('gradient:') ? (
                                    <div className="w-full h-full rounded-full border border-discord-border/50" style={{ background: `linear-gradient(135deg, ${cover.replace('gradient:', '').split('-')[0]}, ${cover.replace('gradient:', '').split('-')[1]})` }}></div>
                                ) : (
                                    <img src={cover.startsWith('/') ? `http://127.0.0.1:5888${cover}${cover.includes('?') ? '&' : '?'}s=400` : cover} className="w-full h-full object-cover rounded-full border border-discord-border/50" alt={artist} />
                                )
                            ) : (
                                <div className="w-full h-full bg-discord-tertiary rounded-full flex items-center justify-center text-discord-muted border border-discord-border/50"><i className="fa-solid fa-user text-4xl"></i></div>
                            )}
                            <div className="absolute inset-0 bg-black/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <i className="fa-solid fa-play text-white text-3xl shadow-sm"></i>
                            </div>
                        </div>
                        <h3 className="font-bold text-discord-text text-base truncate w-full" title={artist}>{artist}</h3>
                        <p className="text-xs text-discord-muted font-semibold mt-1">{tracks.length} tracks</p>
                    </div>
                );
            })}
        </div>
    );
}
