// src/components/AnalyticsDashboard.js
// ChakrasPlayer - Analytics Dashboard Component
// Requiere globals: React, window.StorageApi, window.ColorThief

const { useState, useEffect } = React;

const AnalyticsDashboard = ({ library }) => {
    const [stats, setStats] = useState([]);
    const [globalHours, setGlobalHours] = useState(new Array(24).fill(0));
    const [topMood, setTopMood] = useState({ color: '#5865F2', name: 'Analyzing Vibe...', icon: 'fa-brain' });
    const [animated, setAnimated] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            const data = await window.StorageApi.getStats();
            const hours = await window.StorageApi.getSetting('global_hourly_stats') || new Array(24).fill(0);
            setStats(data);
            setGlobalHours(hours);

            setTimeout(() => setAnimated(true), 100);

            if (data.length > 0 && library.length > 0) {
                const topArtist = data[0].artist;
                const sampleTrack = library.find(t => t.artist === topArtist && t.coverUrl);

                if (sampleTrack && sampleTrack.coverUrl) {
                    const img = new Image();
                    img.crossOrigin = 'Anonymous';
                    img.src = sampleTrack.coverUrl;
                    img.onload = () => {
                        try {
                            const colorThief = new window.ColorThief();
                            const [r, g, b] = colorThief.getColor(img);
                            let vibeName = "Balanced Vibe", vibeIcon = "fa-scale-balanced";
                            if (r > g + 40 && r > b + 40) { vibeName = "Energetic / Intense"; vibeIcon = "fa-fire"; }
                            else if (b > r + 30 && b > g + 30) { vibeName = "Chill / Melancholic"; vibeIcon = "fa-snowflake"; }
                            else if (g > r + 20 && g > b + 20) { vibeName = "Organic / Acoustic"; vibeIcon = "fa-leaf"; }
                            else if (r < 60 && g < 60 && b < 60) { vibeName = "Dark / Midnight"; vibeIcon = "fa-moon"; }
                            else if (r > 200 && g > 200 && b > 200) { vibeName = "Bright / Pop"; vibeIcon = "fa-sun"; }
                            setTopMood({ color: `rgb(${r},${g},${b})`, name: vibeName, icon: vibeIcon });
                        } catch (e) { }
                    };
                } else { setTopMood({ color: '#5865F2', name: 'Eclectic Mix', icon: 'fa-shuffle' }); }
            } else { setTopMood({ color: '#5865F2', name: 'New Listener', icon: 'fa-star' }); }
        };
        fetchStats();
    }, [library]);

    const topData = stats.slice(0, 10);
    const maxMinutes = topData.length > 0 ? topData[0].minutes : 1;
    const totalMinutes = stats.reduce((acc, curr) => acc + curr.minutes, 0);

    // Persona Logic
    const peakHour = globalHours.indexOf(Math.max(...globalHours));
    let persona = { name: "The Listener", desc: "Starting your musical journey.", icon: "fa-headphones" };
    if (totalMinutes > 0) {
        if (peakHour >= 22 || peakHour <= 4) persona = { name: "Night Owl", desc: "Most active during late night sessions.", icon: "fa-moon" };
        else if (peakHour >= 5 && peakHour <= 10) persona = { name: "Early Bird", desc: "Energy boost for the morning.", icon: "fa-sun" };
        else if (stats.length > library.length * 0.5) persona = { name: "The Explorer", desc: "High variety in your rotation.", icon: "fa-compass" };
        else persona = { name: "Deep Diver", desc: "You focus on a few specific artists.", icon: "fa-anchor" };
    }

    return (
        <div className="flex flex-col gap-8 p-8 pb-12 h-full overflow-y-auto custom-scrollbar animate-in fade-in duration-700">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass-panel p-6 border border-white/5 relative overflow-hidden group">
                    <h4 className="text-discord-muted text-[10px] font-bold mb-1 uppercase tracking-widest">Artists Count</h4>
                    <p className="text-3xl font-black text-discord-text">{stats.length}</p>
                    <div className="mt-2 text-xs text-green-400 font-bold flex items-center gap-1"><i className="fa-solid fa-arrow-trend-up"></i> Growing</div>
                </div>

                <div className="glass-panel p-6 border border-white/5 relative overflow-hidden group">
                    <h4 className="text-discord-muted text-[10px] font-bold mb-1 uppercase tracking-widest">Total Airtime</h4>
                    <p className="text-3xl font-black text-discord-text">{totalMinutes.toFixed(0)}m</p>
                    <div className="mt-2 text-xs text-discord-muted">~{(totalMinutes / 60).toFixed(1)} hours logged</div>
                </div>

                <div className="glass-panel p-6 border border-white/5 relative bg-gradient-to-br from-indigo-600/10 to-purple-600/10 border-indigo-500/20">
                    <h4 className="text-discord-muted text-[10px] font-bold mb-1 uppercase tracking-widest">Listening Persona</h4>
                    <div className="flex items-center gap-3 mt-1">
                        <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-xl"><i className={`fa-solid ${persona.icon}`}></i></div>
                        <div>
                            <p className="text-lg font-bold text-discord-text leading-tight">{persona.name}</p>
                            <p className="text-[10px] text-discord-muted">{persona.desc}</p>
                        </div>
                    </div>
                </div>

                <div className="glass-panel p-6 relative overflow-hidden group border border-white/5 transition-all duration-1000" style={{ backgroundColor: `color-mix(in srgb, ${topMood.color} 10%, transparent)` }}>
                    <h4 className="text-[10px] font-bold mb-1 uppercase tracking-widest opacity-60" style={{ color: topMood.color }}>Aura / Vibe</h4>
                    <p className="text-xl font-black" style={{ color: topMood.color }}>{topMood.name}</p>
                    <i className={`fa-solid ${topMood.icon} absolute -right-3 -bottom-3 text-7xl opacity-5 transition-transform group-hover:scale-125`} style={{ color: topMood.color }}></i>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Top Artists Bar Chart */}
                <div className="glass-panel p-8 border border-white/5 h-full">
                    <h3 className="text-md font-bold mb-6 text-discord-text flex items-center gap-2">
                        <i className="fa-solid fa-fire-flame-curved text-orange-500"></i> Heavy Rotation
                    </h3>
                    <div className="flex flex-col gap-5">
                        {topData.length === 0 ? <p className="text-discord-muted text-sm italic">Play some songs to see your history.</p> :
                            topData.map((d, i) => (
                                <div key={i} className="flex flex-col gap-1">
                                    <div className="flex justify-between items-end px-1">
                                        <span className="text-[11px] font-bold text-discord-text truncate max-w-[70%]">{i + 1}. {d.artist}</span>
                                        <span className="text-[10px] text-discord-muted font-bold">{d.minutes.toFixed(0)} min</span>
                                    </div>
                                    <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                                        <div className="h-full bg-discord-blurple rounded-full transition-all duration-1000" style={{ width: animated ? `${(d.minutes / maxMinutes) * 100}%` : '0%', boxShadow: '0 0 10px rgba(88,101,242,0.3)' }}></div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>

                {/* Hourly Activity - Radar/Clock Style Chart */}
                <div className="glass-panel p-8 border border-white/5 h-full">
                    <h3 className="text-md font-bold mb-6 text-discord-text flex items-center gap-2">
                        <i className="fa-solid fa-clock-rotate-left text-teal-500"></i> 24h Activity Cycle
                    </h3>
                    <div className="flex items-end justify-between h-32 gap-1 px-2">
                        {globalHours.map((count, h) => {
                            const maxVal = Math.max(...globalHours) || 1;
                            return (
                                <div key={h} className="group relative flex-1 flex flex-col items-center justify-end h-full">
                                    <div
                                        className="w-full bg-teal-500/40 group-hover:bg-teal-400 rounded-t-sm transition-all duration-700"
                                        style={{ height: animated ? `${(count / maxVal) * 100}%` : '0%' }}
                                    ></div>
                                    <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                        <div className="bg-discord-tertiary text-[9px] px-2 py-1 rounded border border-white/10 whitespace-nowrap">{h}:00 - {count} plays</div>
                                    </div>
                                    <span className="text-[8px] mt-1 text-discord-muted hidden md:block">{h}</span>
                                </div>
                            );
                        })}
                    </div>
                    <p className="mt-6 text-[10px] text-discord-muted text-center italic">Tracks your peak listening times to suggest better playlists.</p>
                </div>
            </div>
        </div>
    );
};
