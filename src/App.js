const { useState, useEffect, useRef, useMemo, useCallback } = React;
const API_BASE = window.API_BASE || 'http://127.0.0.1:5888';
const callBackend = window.callBackend || (async (url, opts) => { const r = await fetch(url, opts); return r.json(); });

const formatTime = (seconds) => {
    if (seconds === undefined || seconds === null || isNaN(seconds) || seconds < 0) return "--:--";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
};
const App = () => {

    // 1. Sidebar memory
    const [isSidebarCompact, setIsSidebarCompact] = useState(() =>
        localStorage.getItem('chakras_sidebar_compact') === 'true'
    );
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(() =>
        localStorage.getItem('chakras_right_panel_open') !== 'false' // Default true
    );
    const [view, setView] = useState(() =>
        localStorage.getItem('chakras_active_view') || 'songs'
    );
    const [performanceMode, setPerformanceMode] = useState(() =>
        localStorage.getItem('chakras_performance_mode') === 'true'
    );

    // Persist changes
    useEffect(() => { localStorage.setItem('chakras_sidebar_compact', isSidebarCompact); }, [isSidebarCompact]);
    useEffect(() => { localStorage.setItem('chakras_right_panel_open', isRightPanelOpen); }, [isRightPanelOpen]);
    useEffect(() => { localStorage.setItem('chakras_active_view', view); }, [view]);
    useEffect(() => { localStorage.setItem('chakras_performance_mode', performanceMode); }, [performanceMode]);

    const [previousView, setPreviousView] = useState('songs');
    const [library, setLibraryInternal] = useState([]);
    const [playbackQueue, setPlaybackQueueInternal] = useState([]);
    const playbackQueueRef = useRef([]);
    useEffect(() => { playbackQueueRef.current = playbackQueue; }, [playbackQueue]);
    const [originalQueue, setOriginalQueueInternal] = useState([]);

    const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
    const currentTrackIndexRef = useRef(-1);
    useEffect(() => { currentTrackIndexRef.current = currentTrackIndex; }, [currentTrackIndex]);

    // --- Deduplication Logic ---
    const setLibrary = useCallback((updater) => {
        setLibraryInternal(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            const unique = [];
            const ids = new Set();
            for (const t of next) {
                if (!ids.has(t.id)) {
                    ids.add(t.id);
                    unique.push(t);
                }
            }
            return unique;
        });
    }, []);

    const setPlaybackQueue = useCallback((updater) => {
        setPlaybackQueueInternal(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            const unique = [];
            const ids = new Set();
            for (const t of next) {
                if (!ids.has(t.id)) {
                    ids.add(t.id);
                    unique.push(t);
                }
            }
            return unique;
        });
    }, []);

    const setOriginalQueue = useCallback((updater) => {
        setOriginalQueueInternal(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            const unique = [];
            const ids = new Set();
            for (const t of next) {
                if (!ids.has(t.id)) {
                    ids.add(t.id);
                    unique.push(t);
                }
            }
            return unique;
        });
    }, []);

    const [sysStats, setSysStats] = useState(null);
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('http://127.0.0.1:5888/api/system-monitor');
                if (res.ok) setSysStats(await res.json());
            } catch (e) { }
        };
        fetchStats();
        // OPTIMIZATION: Less frequent polling in performance mode
        const interval = setInterval(fetchStats, performanceMode ? 8000 : 3000);
        return () => clearInterval(interval);
    }, [performanceMode]);

    const [userPlaylists, setUserPlaylists] = useState([]);
    const [dailyMixes, setDailyMixes] = useState([]);
    const [mixesLoaded, setMixesLoaded] = useState(false);
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);

    const loadDailyMixes = async () => {
        if (mixesLoaded) return;
        try {
            const stats = await window.StorageApi.getStats();
            const hours = await window.StorageApi.getSetting('global_hourly_stats') || [];
            const payload = {
                library,
                analytics: {
                    topArtists: stats.slice(0, 5),
                    totalMinutes: stats.reduce((a, c) => a + c.minutes, 0),
                    peakHours: hours
                }
            };

            let data;
            if (window.pywebview && window.pywebview.api && window.pywebview.api.get_daily_mixes) {
                data = await window.pywebview.api.get_daily_mixes(payload);
            } else {
                const res = await fetch(`${API_BASE}/api/daily-mixes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                data = await res.json();
            }

            if (data && data.status === 'success') {
                setDailyMixes(data.mixes);
                setMixesLoaded(true);
            }
        } catch (e) {
            console.error('[Daily Mixes]', e);
        }
    };

    const loadPlaylists = async () => {
        try {
            let data;
            if (window.pywebview && window.pywebview.api && window.pywebview.api.get_playlists) {
                data = await window.pywebview.api.get_playlists();
            } else {
                const res = await fetch(`${API_BASE}/api/playlists`, { method: 'POST' });
                data = await res.json();
            }

            if (data && data.playlists) {
                setUserPlaylists(data.playlists);
            }
        } catch (e) {
            console.error('[Playlists] Load error:', e);
        }
    };

    // Recargar playlists automáticamente al entrar en la vista
    useEffect(() => {
        if (view === 'playlists') {
            loadPlaylists();
            if (library.length > 0) loadDailyMixes();
        }
    }, [view, library.length]);

    const [isScanning, setIsScanning] = useState(false);
    const [permissionNeeded, setPermissionNeeded] = useState(false);
    const [savedDirHandle, setSavedDirHandle] = useState(null);
    const [librarySearchQuery, setLibrarySearchQuery] = useState('');
    const [vsScrollTop, setVsScrollTop] = useState(0); // Virtual scroll
    const ROW_HEIGHT = 56; // px per song row
    const VS_OVERSCAN = 5; // extra rows above/below viewport

    // Helper: Read tags from a path via bridge
    const tagReaderFromPath = async (path) => {
        try {
            const b64 = await window.pywebview.api.read_file_base64(path);
            if (!b64) return null;
            const byteArray = new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)));
            const blob = new Blob([byteArray]);
            return await window.parseID3(blob);
        } catch (e) {
            console.error("[TagReader] Error reading tags from path:", e);
            return null;
        }
    };

    // Context Menu + Editor State
    const [contextMenu, setContextMenu] = useState(null); // { x, y, track }
    const [editMetaModal, setEditMetaModal] = useState(null); // { track, filePath }
    const [trimModal, setTrimModal] = useState(null); // { track, filePath }
    const [trimRange, setTrimRange] = useState({ start: 0, end: 0 });
    const [editorSaving, setEditorSaving] = useState(false);
    const [editorMsg, setEditorMsg] = useState('');
    const [trimPreviewPlaying, setTrimPreviewPlaying] = useState(false);
    const trimPreviewRef = useRef(new Audio());
    const [isMuted, setIsMuted] = useState(() => localStorage.getItem('chakras_muted') === 'true');
    useEffect(() => { localStorage.setItem('chakras_muted', isMuted); }, [isMuted]);
    const [prevVolume, setPrevVolume] = useState(1);
    const [isServerConnected, setIsServerConnected] = useState(true);
    const [isEditingLyrics, setIsEditingLyrics] = useState(false);
    const [manualLyricsText, setManualLyricsText] = useState('');



    // --- Robust Audio Engine (MediaElement-based) ---
    const audioContextRef = useRef(null);
    const audioTagRef = useRef(null); // The <audio> element
    const sourceNodeRef = useRef(null);
    const analyserRef = useRef(null);
    const eqNodesRef = useRef([]);
    const gainNodeRef = useRef(null);
    const audioBufferCache = useRef(new Map()); // Now storing Blobs, not decoded buffers
    const streamIdRef = useRef(0);



    const [sidebarActiveTab, setSidebarActiveTab] = useState('queue'); // 'queue' or 'stats'

    // Dynamic Heartbeat to track server status
    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/playlists`, {
                    method: 'OPTIONS',
                    mode: 'no-cors' // Use no-cors for a simple presence check if needed
                });
                setIsServerConnected(true);
            } catch (e) {
                // Fallback: if we can't reach via fetch, check if the bridge is alive
                if (window.pywebview && window.pywebview.api) {
                    setIsServerConnected(true);
                } else {
                    setIsServerConnected(false);
                }
            }
        };
        checkStatus();
        const timer = setInterval(checkStatus, 15000);
        return () => clearInterval(timer);
    }, []);

    const openContextMenu = (e, track) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, track });
    };

    const closeContextMenu = () => setContextMenu(null);

    const openMetaEditor = (track) => {
        closeContextMenu();
        const filePath = track.filePath || track.handle?.name ||
            (track.fileName ? track.fileName : null);
        setEditMetaModal({
            track,
            meta: {
                title: track.title || '',
                artist: track.artist || '',
                album: track.album || '',
                year: track.releaseYear || '',
                genre: track.genre || ''
            }
        });
        setEditorMsg('');
    };

    const openTrimmer = (track) => {
        closeContextMenu();
        setTrimPreviewPlaying(false);
        setEditorMsg('Cargando pista...');

        const filePath = track.filePath || track.file_path || track.fileName;
        const audioUrl = `http://127.0.0.1:5888/api/file?path=${encodeURIComponent(filePath)}`;

        const tempAudio = new Audio(audioUrl);
        tempAudio.onloadedmetadata = () => {
            const exactDuration = tempAudio.duration;
            setTrimRange({ start: 0, end: Math.floor(exactDuration || 60) });
            setTrimModal({ track: { ...track, duration: exactDuration } });
            setEditorMsg('');
            trimPreviewRef.current.src = audioUrl;
        };
        tempAudio.onerror = () => {
            setTrimRange({ start: 0, end: Math.floor(track.duration || 60) });
            setTrimModal({ track });
            setEditorMsg('Aviso: modo sin conexión. Previsualización no disponible.');
            trimPreviewRef.current.src = '';
        };
    };

    const saveMetadata = async () => {
        if (!editMetaModal) return;
        setEditorSaving(true);
        setEditorMsg('');
        try {
            const payload = {
                id: editMetaModal.track.id,
                title: editMetaModal.meta.title,
                artist: editMetaModal.meta.artist,
                album: editMetaModal.meta.album,
                year: editMetaModal.meta.year,
                genre: editMetaModal.meta.genre
            };
            const data = await window.pywebview.api.edit_metadata(payload);
            if (data && data.status === 'success') {
                // Sync local state
                const updatedMeta = editMetaModal.meta;
                setLibrary(prev => prev.map(t =>
                    t.id === editMetaModal.track.id
                        ? { ...t, title: updatedMeta.title, artist: updatedMeta.artist, album: updatedMeta.album, releaseYear: updatedMeta.year, genre: updatedMeta.genre }
                        : t
                ));
                await window.StorageApi.updateTrack(editMetaModal.track.id, { title: updatedMeta.title, artist: updatedMeta.artist, album: updatedMeta.album, releaseYear: updatedMeta.year, genre: updatedMeta.genre });
                setEditorMsg('✅ Guardado con éxito');
                setTimeout(() => setEditMetaModal(null), 1200);
            } else {
                setEditorMsg(`❌ Error: ${data.message}`);
            }
        } catch (e) {
            setEditorMsg('❌ Error: Asegúrate de que el servidor Python está corriendo.');
        } finally {
            setEditorSaving(false);
        }
    };

    const trimAudio = async () => {
        if (!trimModal || editorSaving) return;
        setEditorSaving(true);
        setTrimPreviewPlaying(false);
        setEditorMsg('Procesando recorte...');

        try {
            const filePath = trimModal.track.filePath || trimModal.track.file_path || trimModal.track.fileName;
            const res = await fetch('http://127.0.0.1:5888/api/trim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: filePath,
                    start: trimRange.start,
                    end: trimRange.end
                })
            });

            const data = await res.json();
            if (data.status === 'success') {
                setEditorMsg('✅ ¡Recortado con éxito!');

                // Actualizar duración en la librería
                const newDuration = data.newDuration;
                const updateLibrary = (prev) => prev.map(t =>
                    (t.id === trimModal.track.id) ? { ...t, duration: newDuration } : t
                );

                setLibrary(updateLibrary);
                setPlaybackQueue(updateLibrary);
                setOriginalQueue(updateLibrary);

                await window.StorageApi.updateTrack(trimModal.track.id, { duration: newDuration });

                setTimeout(() => setTrimModal(null), 1500);
            } else {
                setEditorMsg(`❌ Error: ${data.message}`);
            }
        } catch (e) {
            setEditorMsg('❌ Error al conectar con el servidor.');
        } finally {
            setEditorSaving(false);
        }
    };

    const deleteSong = async (track) => {
        const confirmMsg = `¿Estás seguro de que quieres borrar "${track.title}"?\n\nEsta acción eliminará el archivo físico permanentemente.`;
        // if (!confirm(confirmMsg)) return; // Patched: Native confirm() causes Segmentation Fault in WebKitGTK async loop.

        try {
            const res = await fetch('http://127.0.0.1:5888/api/delete-song', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: track.id, filePath: track.filePath || track.fileName })
            });
            const data = await res.json();
            if (data.status === 'success') {
                // Sync state
                setLibrary(prev => prev.filter(t => t.id !== track.id));
                setPlaybackQueue(prev => prev.filter(t => t.id !== track.id));
                setOriginalQueue(prev => prev.filter(t => t.id !== track.id));
                await window.StorageApi.deleteTrack(track.id);
                closeContextMenu();
            } else {
                alert(`Error al borrar: ${data.message}`);
            }
        } catch (e) {
            console.error("Delete error:", e);
            alert("Error de conexión con el servidor.");
        }
    };

    const clearLibrary = async () => {
        const confirmMsg = "¡ADVERTENCIA CRÍTICA!\n\n¿Estás seguro de que quieres BORRAR TODA LA BIBLIOTECA?\n\nEsto eliminará físicamente TODOS los archivos de música en la carpeta actual y limpiará la base de datos. Esta acción no se puede deshacer.";
        // if (!confirm(confirmMsg)) return; // Patched: Native confirm() causes Segmentation Fault in WebKitGTK async loop.

        try {
            const res = await fetch('http://127.0.0.1:5888/api/clear-library', { method: 'POST' });
            const data = await res.json();
            if (data.status === 'success') {
                setLibrary([]);
                setPlaybackQueue([]);
                setOriginalQueue([]);
                await window.StorageApi.clearTracks();
                alert("Biblioteca purgada con éxito.");
            } else {
                alert(`Error: ${data.message}`);
            }
        } catch (e) {
            alert("Error de conexión.");
        }
    };

    const replaceFromYoutube = (track) => {
        setReplacingTrack(track);
        setYtSearchQuery(`${track.artist} - ${track.title}`);
        setView('searchYt');
        closeContextMenu();
        addToast(`Buscando reemplazo para "${track.title}". Descarga una nueva versión y la anterior se eliminará automáticamente.`, 'info');
    };

    // Preview Loop Logic
    useEffect(() => {
        const audio = trimPreviewRef.current;
        let interval;

        if (trimPreviewPlaying && audio.src) {
            audio.currentTime = trimRange.start;
            audio.play().catch(e => console.warn("Trim preview play error:", e));

            interval = setInterval(() => {
                if (audio.currentTime >= trimRange.end) {
                    audio.currentTime = trimRange.start;
                }
            }, 100);
        } else {
            audio.pause();
        }

        return () => {
            audio.pause();
            if (interval) clearInterval(interval);
        };
    }, [trimPreviewPlaying, trimRange.start, trimRange.end]);

    const fmtSec = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')};`;

    const [ytSearchQuery, setYtSearchQuery] = useState('');
    const [ytSearchResults, setYtSearchResults] = useState([]);
    const [isYtSearching, setIsYtSearching] = useState(false);
    const [ytDownloadTarget, setYtDownloadTarget] = useState(null);
    const [ytPromptData, setYtPromptData] = useState({ visible: false, artist: '', title: '', url: '' });

    const handleYtSearch = async (e) => {
        e.preventDefault();
        if (!ytSearchQuery.trim()) return;

        setIsYtSearching(true);
        setYtSearchResults([]);

        try {
            const res = await fetch('http://127.0.0.1:5888/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: ytSearchQuery })
            });

            const data = await res.json();
            if (data.status === 'success') {
                setYtSearchResults(data.results);
            } else {
                alert('No se pudieron obtener resultados.');
            }
        } catch (error) {
            console.error('Error fetching search results:', error);
            alert('Error al conectar con el backend. Asegúrate de que el servidor está corriendo.');
        } finally {
            setIsYtSearching(false);
        }
    };

    const triggerYtDownload = (video) => {
        // Pre-fill prompt based on video title heuristics
        const titleStr = video.title || "";
        let fallbackArtist = "Unknown Artist";
        let fallbackTitle = titleStr;

        if (titleStr.includes(" - ")) {
            const parts = titleStr.split(" - ");
            fallbackArtist = parts[0].trim();
            fallbackTitle = parts.slice(1).join(" - ").trim();
        } else if (titleStr.includes("-")) {
            const parts = titleStr.split("-");
            fallbackArtist = parts[0].trim();
            fallbackTitle = parts.slice(1).join("-").trim();
        }

        setYtPromptData({
            visible: true,
            url: video.url,
            artist: fallbackArtist,
            title: fallbackTitle,
            videoId: video.id,
            thumbnail: video.thumbnail
        });
    };

    const [ytDownloadProgress, setYtDownloadProgress] = useState({});
    const [batchDownloadQueue, setBatchDownloadQueue] = useState([]);
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);
    const [seenDownloadsCount, setSeenDownloadsCount] = useState(0);
    const [isMixMode, setIsMixMode] = useState(false);

    const handleBatchUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const b64 = event.target.result.split(',')[1];
            try {
                const res = await window.pywebview.api.extract_batch_metadata(b64);
                if (res.status === 'success' && res.songs.length > 0) {
                    setBatchDownloadQueue(prev => {
                        const newQueue = [...prev, ...res.songs];
                        batchTotalRef.current = newQueue.length;
                        return newQueue;
                    });
                    addToast(`Se cargaron ${res.songs.length} canciones al lote de descarga.`, 'success');
                } else {
                    addToast('No se encontraron canciones en el archivo.', 'error');
                }
            } catch (err) {
                console.error("Batch error:", err);
            }
        };
        reader.readAsDataURL(file);
    };

    const processNextBatchItem = async () => {
        if (batchDownloadQueue.length === 0 || isBatchProcessing) return;

        setIsBatchProcessing(true);
        const nextItem = batchDownloadQueue[0];

        try {
            const term = `${nextItem.artist} - ${nextItem.title}`;

            // Set a large timeout for search (300 seconds) because yt-dlp search can be slow
            const searchController = new AbortController();
            const searchTimeout = setTimeout(() => searchController.abort(), 300000);

            let currentVideoId = null; // Defined here so catch block can see it

            const sres = await fetch('http://127.0.0.1:5888/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: term }),
                signal: searchController.signal
            });
            clearTimeout(searchTimeout);
            const sdata = await sres.json();

            if (sdata.status === 'success' && sdata.results.length > 0) {
                const bestMatch = sdata.results[0];
                currentVideoId = bestMatch.id;
                const videoId = currentVideoId;
                const tempTrackId = `temp-batch-${videoId}`;

                const tempTrack = {
                    id: tempTrackId,
                    videoId: videoId,
                    title: nextItem.title + " (Descargando...)",
                    artist: nextItem.artist,
                    coverUrl: bestMatch.thumbnail || null,
                    duration: 0,
                    isDownloading: true,
                    dateAdded: Date.now() + 1000
                };

                setLibrary(prev => [tempTrack, ...prev]);
                setYtDownloadProgress(prev => ({ ...prev, [videoId]: "0.0" }));

                // Poll for progress during batch download
                const pollInterval = setInterval(async () => {
                    try {
                        const pres = await fetch(`http://127.0.0.1:5888/api/progress?id=${videoId}`);
                        const pdata = await pres.json();
                        if (pdata.status === 'success') {
                            setYtDownloadProgress(prev => {
                                if (prev[videoId] === pdata.progress) return prev;
                                return { ...prev, [videoId]: pdata.progress };
                            });
                            if (parseFloat(pdata.progress) >= 100) clearInterval(pollInterval);
                        }
                    } catch (e) { clearInterval(pollInterval); }
                }, 1000);

                // Robust timeout of 15 minutes for extremely large or slow downloads
                const dlController = new AbortController();
                const dlTimeout = setTimeout(() => dlController.abort(), 900000);

                let dres;
                try {
                    dres = await fetch('http://127.0.0.1:5888/api/download', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            url: bestMatch.url,
                            artist: nextItem.artist,
                            title: nextItem.title,
                            videoId: videoId
                        }),
                        signal: dlController.signal
                    });
                } finally {
                    clearTimeout(dlTimeout);
                }

                const ddata = await dres.json();
                clearInterval(pollInterval);

                if (ddata.status === 'success') {
                    const enhancedTrack = {
                        ...ddata.track,
                        coverUrl: ddata.track.ytThumbnail || ddata.track.uploaderThumbnail || null
                    };

                    await window.StorageApi.saveTrack(enhancedTrack);

                    const finalUpdate = prev => {
                        const next = prev.filter(t => t.id !== tempTrackId);
                        return [enhancedTrack, ...next];
                    };

                    setLibrary(finalUpdate);
                    setOriginalQueue(finalUpdate);
                    setPlaybackQueue(finalUpdate);
                    setEnrichmentQueue(prev => [...prev, enhancedTrack.id]);
                } else {
                    setLibrary(prev => prev.filter(t => t.id !== tempTrackId));
                }

                setYtDownloadProgress(prev => {
                    const next = { ...prev };
                    delete next[videoId];
                    return next;
                });
            }
        } catch (err) {
            console.error("Error in batch item:", err);
            // CLEANUP: Ensure we remove the temporary track if any network or JS error occurs
            if (batchDownloadQueue.length > 0) {
                const failedItem = batchDownloadQueue[0];
                // Clean up visual library state
                setLibrary(prev => prev.filter(t => !(t.isDownloading && t.artist === failedItem.artist && t.title?.includes(failedItem.title))));
            }
            if (typeof currentVideoId !== 'undefined' && currentVideoId) {
                setYtDownloadProgress(prev => {
                    const next = { ...prev };
                    delete next[currentVideoId];
                    return next;
                });
            }
        } finally {
            setBatchDownloadQueue(prev => prev.slice(1));
            setIsBatchProcessing(false);
        }
    };

    useEffect(() => {
        if (batchDownloadQueue.length > 0 && !isBatchProcessing) {
            processNextBatchItem();
        }
    }, [batchDownloadQueue, isBatchProcessing]);

    useEffect(() => {
        if (view === 'downloads') {
            setSeenDownloadsCount(Object.keys(ytDownloadProgress).length + batchDownloadQueue.length);
        }
    }, [view, ytDownloadProgress, batchDownloadQueue]);

    const confirmYtDownload = async () => {
        if (!ytPromptData.artist.trim() || !ytPromptData.title.trim() || !ytPromptData.url) {
            alert("Artista y Canción son obligatorios.");
            return;
        }

        const { url, artist, title, videoId, thumbnail } = ytPromptData;
        setYtPromptData({ ...ytPromptData, visible: false });

        // Visual feedback placeholder
        if (videoId) {
            const tempTrackId = `temp-${videoId}`;
            const tempTrack = {
                id: tempTrackId,
                videoId,
                title,
                artist,
                coverUrl: thumbnail || null,
                duration: 0,
                isDownloading: true,
                dateAdded: Date.now()
            };
            setLibrary(prev => [tempTrack, ...prev]);
            setYtDownloadProgress(prev => ({ ...prev, [videoId]: "0.0" }));

            const pollInterval = setInterval(async () => {
                try {
                    const pres = await fetch(`http://127.0.0.1:5888/api/progress?id=${videoId}`);
                    const pdata = await pres.json();
                    if (pdata.status === 'success') {
                        setYtDownloadProgress(prev => {
                            if (prev[videoId] === pdata.progress) return prev;
                            return { ...prev, [videoId]: pdata.progress };
                        });
                        if (parseFloat(pdata.progress) >= 100) clearInterval(pollInterval);
                    }
                } catch (e) { clearInterval(pollInterval); }
            }, 1000);
        }

        try {
            const res = await fetch('http://127.0.0.1:5888/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, artist, title, videoId, overwrite: !!replacingTrack })
            });

            const pdata = await res.json();
            console.log("[Download] Server response:", pdata);
            if (pdata.status === 'success') {
                const enhancedTrack = {
                    ...pdata.track,
                    coverUrl: pdata.track.ytThumbnail || pdata.track.uploaderThumbnail || null
                };
                console.log("[Download] Enhanced track object:", enhancedTrack);

                // Save to IndexedDB (Persistent local copy)
                await window.StorageApi.saveTrack(enhancedTrack);
                console.log("[Download] Saved to IndexedDB");

                const updateList = (prev) => {
                    console.log("[Download] Updating library. Previous size:", prev.length);
                    // Filter out the temp placeholder by videoId if present
                    let next = prev.filter(t => t.id !== `temp-${videoId}`);
                    // Also filter by filePath to avoid duplicates if replace was triggered
                    next = next.filter(t => t.filePath !== enhancedTrack.filePath);
                    const newList = [enhancedTrack, ...next];
                    console.log("[Download] New library size:", newList.length);
                    return newList;
                };

                setLibrary(updateList);
                setOriginalQueue(updateList);
                setPlaybackQueue(updateList);
                setEnrichmentQueue(prev => [...prev, enhancedTrack.id]);

                // If we were replacing a track, delete the old one
                if (replacingTrack) {
                    try {
                        await fetch('http://127.0.0.1:5888/api/delete-song', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: replacingTrack.id, filePath: replacingTrack.filePath || replacingTrack.fileName })
                        });
                        await window.StorageApi.deleteTrack(replacingTrack.id);
                        setLibrary(prev => prev.filter(t => t.id !== replacingTrack.id));
                        setPlaybackQueue(prev => prev.filter(t => t.id !== replacingTrack.id));
                        setOriginalQueue(prev => prev.filter(t => t.id !== replacingTrack.id));
                        addToast(`Reemplazada "${replacingTrack.title}" exitosamente.`, 'success');
                    } catch (rErr) {
                        console.error('Error deleting replaced track:', rErr);
                    }
                    setReplacingTrack(null);
                }

                if (videoId) setYtDownloadProgress(prev => {
                    const next = { ...prev };
                    delete next[videoId];
                    return next;
                });
            } else {
                // alert(`Fallo la descarga: ${pdata.message || 'Error desconocido'}`); // Patched: Avoid native alert segmentation fault
                addToast(`Fallo la descarga: ${pdata.message || 'Error desconocido'}`, 'error');
                setLibrary(prev => prev.filter(t => t.id !== `temp-${videoId}`));
                if (videoId) setYtDownloadProgress(prev => {
                    const next = { ...prev };
                    delete next[videoId];
                    return next;
                });
            }
        } catch (error) {
            console.error('Error in download:', error);
            setLibrary(prev => prev.filter(t => t.id !== `temp-${videoId}`));
        }
    };

    const [themeSettings, setThemeSettings] = useState(null);

    // YouTube Replace State
    const [replacingTrack, setReplacingTrack] = useState(null);

    // Persistent Settings (Consolidated)

    const [savedFolderPath, setSavedFolderPath] = useState('');
    const [audioDeviceId, setAudioDeviceId] = useState('default');
    const [crossfade, setCrossfade] = useState(0);
    const [isAutoplay, setIsAutoplay] = useState(() => localStorage.getItem('chakras_autoplay') !== 'false');
    const [isNormalize, setIsNormalize] = useState(() => localStorage.getItem('chakras_normalize') === 'true');
    const [isGapless, setIsGapless] = useState(() => localStorage.getItem('chakras_gapless') !== 'false');

    useEffect(() => { localStorage.setItem('chakras_autoplay', isAutoplay); }, [isAutoplay]);
    useEffect(() => { localStorage.setItem('chakras_normalize', isNormalize); }, [isNormalize]);
    useEffect(() => { localStorage.setItem('chakras_gapless', isGapless); }, [isGapless]);

    useEffect(() => {
        document.documentElement.setAttribute('data-performance', performanceMode ? 'true' : 'false');
        window.StorageApi.setSetting('performanceMode', performanceMode);
    }, [performanceMode]);

    // AUTO-SAVE THEME SETTINGS
    useEffect(() => {
        if (themeSettings && window.StorageApi) {
            window.StorageApi.saveCustomTheme(themeSettings);
        }
    }, [themeSettings]);

    const togglePerformanceMode = () => setPerformanceMode(!performanceMode);

    // Toast Notification System
    const [toasts, setToasts] = useState([]);
    const addToast = useCallback((message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    // Batch Import Progress Tracking
    const batchTotalRef = useRef(0);

    // Live Preview Draft State
    const [draftThemeSettings, setDraftThemeSettings] = useState(themeSettings);

    // Sync Draft with Saved State when entering Settings
    useEffect(() => {
        if (view === 'settings') {
            setDraftThemeSettings(themeSettings);
        }
    }, [view, themeSettings]);

    useEffect(() => {
        // Safe access to theme settings to prevent White Screen of Death
        const activeSettings = themeSettings || {
            primaryColor: '#5865f2',
            blur: 30,
            saturate: 210,
            opacity: 70,
            baseTheme: ''
        };
        const root = document.documentElement;

        // Apply Base Theme Attribute
        if (activeSettings.baseTheme) {
            root.setAttribute('data-theme', activeSettings.baseTheme);
            if (activeSettings.baseTheme === 'midnight') {
                document.body.style.backgroundColor = '#0a0a0a';
                root.style.setProperty('--bg-app', '#0a0a0a');
            }
        } else {
            root.removeAttribute('data-theme');
            document.body.style.backgroundColor = '#121212';
        }

        root.style.setProperty('--glass-blur', activeSettings.blur + 'px');
        root.style.setProperty('--glass-saturate', activeSettings.saturate + '%');
        root.style.setProperty('--glass-opacity', activeSettings.opacity + '%');
        root.style.setProperty('--color-blurple', activeSettings.primaryColor);

        if (activeSettings.primaryColor) {
            const hex = activeSettings.primaryColor.replace('#', '');
            if (hex.length === 6) {
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);
                
                // Primary Accent Variables
                root.style.setProperty('--color-primary', activeSettings.primaryColor);
                root.style.setProperty('--color-primary-rgb', `${r}, ${g}, ${b}`);
                root.style.setProperty('--color-primary-glass', `rgba(${r}, ${g}, ${b}, 0.2)`);
                root.style.setProperty('--color-primary-soft', `rgba(${r}, ${g}, ${b}, 0.1)`);
                root.style.setProperty('--color-primary-glow', `rgba(${r}, ${g}, ${b}, 0.4)`);
                
                // Compatibility for older components
                root.style.setProperty('--color-blurple', activeSettings.primaryColor);
                
                if (!activeSettings.backgroundColor) {
                    root.style.setProperty('--color-vibrant-dark', `rgba(${r}, ${g}, ${b}, 0.15)`);
                }
            }
        }

        if (activeSettings.backgroundColor) {
            // Background color: apply to the page bg element only
            const bgEl = document.getElementById('dynamic-bg');
            if (bgEl) bgEl.style.background = activeSettings.backgroundColor;
            root.style.setProperty('--color-vibrant-dark', 'transparent');

            // Detect brightness for adaptive text legibility
            const bgHex = activeSettings.backgroundColor.replace('#', '');
            if (bgHex.length === 6) {
                const br = parseInt(bgHex.substring(0, 2), 16);
                const bg = parseInt(bgHex.substring(2, 4), 16);
                const bb = parseInt(bgHex.substring(4, 6), 16);
                const luminance = (0.299 * br + 0.587 * bg + 0.114 * bb);
                const appRoot = document.getElementById('app-root');
                if (appRoot) {
                    if (luminance > 140) {
                        appRoot.classList.add('bright-bg');
                    } else {
                        appRoot.classList.remove('bright-bg');
                    }
                }
            }
        } else {
            // Restore the gradient-based background
            const bgEl = document.getElementById('dynamic-bg');
            if (bgEl) bgEl.style.background = '';
            root.style.removeProperty('--color-bg');
            const appRoot = document.getElementById('app-root');
            if (appRoot) appRoot.classList.remove('bright-bg');
            if (activeTrack && activeTrack.coverUrl) {
                root.style.setProperty('--color-vibrant-dark', 'rgba(88, 101, 242, 0.15)');
            }
        }
    }, [themeSettings, activeTrack]);

    const handleManualSaveTheme = async () => {
        try {
            if (window.StorageApi) {
                await window.StorageApi.saveCustomTheme(themeSettings);
                addToast('¡Diseño guardado correctamente!', 'success');
            }
        } catch (error) {
            console.error(error);
        }
    };

    // Audio state
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(240);

    const [isResizing, setIsResizing] = useState(false);

    useEffect(() => {
        if (window.StorageApi && window.StorageApi.getSetting) {
            window.StorageApi.getSetting('sidebarWidth').then(w => { if (w) setSidebarWidth(w); });
        }
    }, []);

    const startResizing = useCallback((e) => {
        setIsResizing(true);
        e.preventDefault();
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
    }, []);

    const resize = useCallback((e) => {
        if (isResizing) {
            const newWidth = e.clientX;
            if (newWidth >= 160 && newWidth <= 450) {
                setSidebarWidth(newWidth);
                if (window.StorageApi && window.StorageApi.setSetting) {
                    window.StorageApi.setSetting('sidebarWidth', newWidth);
                }
            }
        }
    }, [isResizing]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing, resize, stopResizing]);

    const [playbackError, setPlaybackError] = useState(null);
    const [activeTrack, setActiveTrack] = useState(null);



    const [isShuffle, setIsShuffle] = useState(false);

    const [repeatMode, setRepeatMode] = useState('off'); // 'off', 'all', 'one'
    const repeatModeRef = useRef('off');
    useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
    const [audioDevices, setAudioDevices] = useState([]);
    const [showDevicePicker, setShowDevicePicker] = useState(false);
    const [remoteConnections, setRemoteConnections] = useState(0);
    const [globalTunnelUrl, setGlobalTunnelUrl] = useState(null);
    const [isLanReachable, setIsLanReachable] = useState(true);
    const [draggedIdx, setDraggedIdx] = useState(null);

    // --- REMOTE & CONNECTION STATE ---
    const [localIp, setLocalIp] = useState("localhost");
    const [serverPort, setServerPort] = useState(5888);
    const [remoteEnabled, setRemoteEnabled] = useState(true);

    // Lyrics state
    const [lyricsData, setLyricsData] = useState(null);
    const [lyricsLoading, setLyricsLoading] = useState(false);
    const [lyricsError, setLyricsError] = useState(null);
    const lyricsDataRef = useRef(null);
    const activeTrackRef = useRef(null);
    useEffect(() => { lyricsDataRef.current = lyricsData; }, [lyricsData]);
    useEffect(() => { activeTrackRef.current = activeTrack; }, [activeTrack]);

    // Enrichment state
    const [enrichmentQueue, setEnrichmentQueue] = useState([]);
    const [currentlyEnriching, setCurrentlyEnriching] = useState(null);
    const [enrichmentStep, setEnrichmentStep] = useState('');
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    const togglePopUpView = (targetView) => {
        if (view === targetView) {
            setView(previousView || 'songs');
        } else {
            if (!['lyrics', 'queue', 'settings'].includes(view)) {
                setPreviousView(view);
            }
            setView(targetView);
        }
    };

    const hasLoggedPlayRef = useRef(false);
    const objectUrlRef = useRef(null);
    const lyricsContainerRef = useRef(null);

    // AI Assistant State
    const [aiMessages, setAiMessages] = useState([
        { role: 'ai', text: '¡Hola! Soy tu asistente de ChakrasPlayer. ¿Qué te gustaría escuchar hoy? Puedo buscar temas relajantes, hacer playlists para entrenar, o sorprendente con algo aleatorio.', playlist: null, playlistName: null }
    ]);
    const [aiInput, setAiInput] = useState('');
    const [isAiThinking, setIsAiThinking] = useState(false);
    const abortAiRequestRef = useRef(false);
    const aiAbortControllerRef = useRef(null);
    const cancelAiRequest = () => {
        abortAiRequestRef.current = true;
        if (aiAbortControllerRef.current) aiAbortControllerRef.current.abort();
        setIsAiThinking(false);
        setAiMessages(prev => [...prev, { role: 'ai', text: '🛑 **Petición cancelada**', playlist: null }]);
    };
    const [aiCallCount, setAiCallCount] = useState(0);
    const [customApiKey, setCustomApiKey] = useState((window.localStorage ? localStorage.getItem('chakras_gemini_key') : '') || '');
    const [openRouterKey, setOpenRouterKey] = useState((window.localStorage ? localStorage.getItem('chakras_openrouter_key') : '') || '');
    const [showApiConfig, setShowApiConfig] = useState(false);
    const [aiProvider, setAiProvider] = useState((window.localStorage ? localStorage.getItem('chakras_ai_provider') : 'ollama') || 'ollama');
    const [localModel, setLocalModel] = useState((window.localStorage ? localStorage.getItem('chakras_local_model') : 'qwen2.5:14b') || 'qwen2.5:14b');
    const [openRouterModel, setOpenRouterModel] = useState((window.localStorage ? localStorage.getItem('chakras_openrouter_model') : 'google/gemini-2.0-flash-001') || 'google/gemini-2.0-flash-001');
    const [availableModels, setAvailableModels] = useState([]);
    const chatEndRef = useRef(null);

    // Fetch available Ollama models
    useEffect(() => {
        const fetchModels = async () => {
            try {
                if (window.pywebview && window.pywebview.api && window.pywebview.api.get_ollama_models) {
                    const data = await window.pywebview.api.get_ollama_models();
                    if (data.models) setAvailableModels(data.models);
                } else {
                    const res = await fetch('http://127.0.0.1:5888/api/ollama/models');
                    const data = await res.json();
                    if (data.models) setAvailableModels(data.models);
                }
            } catch (e) { console.error("Error fetching local models:", e); }
        };
        if (aiProvider === 'ollama') fetchModels();
    }, [aiProvider]);

    // --- Chat History Persistence ---
    const [historyLoaded, setHistoryLoaded] = useState(false);
    useEffect(() => {
        const loadHistory = async () => {
            try {
                const savedHistory = await window.StorageApi.getSetting('ai_chat_history');
                if (savedHistory && Array.isArray(savedHistory) && savedHistory.length > 0) {
                    setAiMessages(savedHistory);
                }
            } catch (e) {
                console.error("Error loading chat history:", e);
            } finally {
                setHistoryLoaded(true);
            }
        };
        loadHistory();
    }, []);

    useEffect(() => {
        if (!historyLoaded) return;
        const saveHistory = async () => {
            try {
                // Limit to last 20 messages for performance and context
                const limitedHistory = aiMessages.slice(-20);
                await window.StorageApi.setSetting('ai_chat_history', limitedHistory);
            } catch (e) {
                console.error("Error saving chat history:", e);
            }
        };
        saveHistory();
    }, [aiMessages, historyLoaded]);

    // --- AI Vibe Commentary ---
    const [aiVibeComment, setAiVibeComment] = useState("");
    const lastCommentTimeRef = useRef(0);

    useEffect(() => {
        const track = playbackQueue[currentTrackIndex];
        if (!track || !isPlaying) return;

        // Debounce to prevent rapid API calls
        const now = Date.now();
        if (now - lastCommentTimeRef.current < 5000) return;
        lastCommentTimeRef.current = now;

        const getVibe = async () => {
            try {
                const payload = {
                    query: `Dame un comentario corto (máximo 12 palabras) sobre la "vibra" o el estilo musical de esta canción: ${track.artist} - ${track.title}. Empieza directo sin introducciones.`,
                    history: [],
                    library: [],
                    analytics: {},
                    apiKey: aiProvider === 'openrouter' ? openRouterKey : (aiProvider === 'gemini' ? customApiKey : ''),
                    provider: aiProvider,
                    localModel: 'qwen2.5:0.5b' // Use lightweight model for speed
                };

                let data;
                if (window.pywebview && window.pywebview.api && window.pywebview.api.ai_chat) {
                    data = await window.pywebview.api.ai_chat(payload);
                } else {
                    const res = await fetch(`${API_BASE}/api/ai-chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    data = await res.json();
                }

                if (data.status === 'success') {
                    setAiVibeComment(data.reply.replace(/["']/g, ""));
                    // Clear comment after 10 seconds to keep UI clean
                    setTimeout(() => setAiVibeComment(""), 10000);
                }
            } catch (e) { console.warn("Vibe error:", e); }
        };

        const timer = setTimeout(getVibe, 2000); // Small delay to ensure user actually stays on the track
        return () => clearTimeout(timer);
    }, [currentTrackIndex, isPlaying]);

    // Scroll to bottom of Chat
    useEffect(() => {
        if (view === 'ai-assistant' && chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [aiMessages, view]);

    // --- Remote Control: State Sync & Command Polling ---
    useEffect(() => {
        const syncInterval = setInterval(async () => {
            try {
                // Push current state to server
                const active = playbackQueue[currentTrackIndex] || null;
                const statePayload = {
                    isPlaying,
                    title: active?.title || '',
                    artist: active?.artist || '',
                    coverUrl: active?.coverUrl || '',
                    currentTime: currentProgressRef.current || 0,
                    duration: durationRef.current || 0,
                    volume,
                    queueLength: playbackQueue.length,
                    isShuffle: isShuffle,
                    repeatMode: repeatMode
                };
                fetch(`${API_BASE}/api/remote/status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(statePayload)
                }).catch(() => { });

                // Poll for remote commands
                const cmdRes = await fetch(`${API_BASE}/api/remote/commands`);
                if (cmdRes.ok) {
                    const data = await cmdRes.json();
                    const commands = data.commands || [];
                    for (const cmd of commands) {
                        switch (cmd.command) {
                            case 'toggle': togglePlay(); break;
                            case 'next': nextTrack(); break;
                            case 'prev': prevTrack(); break;
                            case 'shuffle': toggleShuffle(); break;
                            case 'repeat': toggleRepeat(); break;
                            case 'volume':
                                if (cmd.value !== null) {
                                    const v = parseFloat(cmd.value);
                                    setVolume(v);
                                    if (audioTagRef.current) audioTagRef.current.volume = v;
                                }
                                break;
                            case 'seek':
                                if (cmd.value !== null && audioTagRef.current) {
                                    audioTagRef.current.currentTime = parseFloat(cmd.value);
                                }
                                break;
                        }
                    }
                }
            } catch (e) { }
        }, 1500);
        return () => clearInterval(syncInterval);
    }, [isPlaying, volume, playbackQueue, currentTrackIndex, isShuffle, repeatMode]);

    const handleAiSubmit = async (e, directPrompt = null, attachedImage = null) => {
        if (e && e.preventDefault) e.preventDefault();
        const message = directPrompt || aiInput.trim();
        if ((!message && !attachedImage) || isAiThinking) return;

        const userMsg = { role: 'user', text: message || '[Imagen adjunta]', playlist: null, image: attachedImage };
        setAiMessages(prev => [...prev, userMsg]);
        setAiInput('');

        if (aiProvider === 'gemini' && !customApiKey) {
            setTimeout(() => {
                setAiMessages(prev => [...prev, { role: 'ai', text: '🔒 **Falta tu API Key de Gemini**. Por favor, pulsa el botón de engranaje ⚙️ e ingresa tu clave de Google Gemini.', playlist: null }]);
            }, 500);
            return;
        }
        if (aiProvider === 'openrouter' && !openRouterKey) {
            setTimeout(() => {
                setAiMessages(prev => [...prev, { role: 'ai', text: '🔒 **Falta tu API Key de OpenRouter**. Por favor, pulsa el botón de engranaje ⚙️ e ingresa tu clave de OpenRouter.', playlist: null }]);
            }, 500);
            return;
        }

        abortAiRequestRef.current = false;
        aiAbortControllerRef.current = new AbortController();
        setIsAiThinking(true);

        try {
            const user_stats = await window.StorageApi.getStats();
            const global_hours = await window.StorageApi.getSetting('global_hourly_stats') || [];

            // ── Memoria: últimos 5 intercambios como contexto ──
            const conversationHistory = aiMessages.slice(-10).map(m => ({
                role: m.role === 'ai' ? 'assistant' : 'user',
                content: m.text
            }));

            const payload = {
                query: userMsg.text,
                image: attachedImage,
                history: conversationHistory,
                library: library,
                analytics: {
                    topArtists: user_stats.slice(0, 5),
                    totalMinutes: user_stats.reduce((acc, c) => acc + c.minutes, 0),
                    peakHours: global_hours
                },
                apiKey: aiProvider === 'openrouter' ? openRouterKey : (aiProvider === 'gemini' ? customApiKey : ''),
                provider: aiProvider,
                localModel: aiProvider === 'openrouter' ? openRouterModel : localModel
            };

            let data;
            if (window.pywebview && window.pywebview.api && window.pywebview.api.ai_chat) {
                data = await window.pywebview.api.ai_chat(payload);
            } else {
                data = await callBackend(`${API_BASE}/api/ai-chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: aiAbortControllerRef.current.signal
                });
            }

            if (abortAiRequestRef.current) return;

            if (data.status === 'success') {
                if (data.usageCount !== undefined) setAiCallCount(data.usageCount);
                setAiMessages(prev => [...prev, {
                    role: 'ai',
                    text: data.reply,
                    playlist: data.playlist && data.playlist.length > 0 ? data.playlist : null,
                    playlistName: data.playlistName,
                    actions: data.actions || []
                }]);
                if (data.playlist && data.playlist.length > 0) {
                    playAiPlaylist(data.playlist);
                }
                if (data.actions) {
                    data.actions.forEach(action => executeAiAction(action));
                }
            } else if (data.status === 'error' && data.reply) {
                if (data.usageCount !== undefined) setAiCallCount(data.usageCount);
                setAiMessages(prev => [...prev, {
                    role: 'ai',
                    text: data.reply,
                    playlist: null,
                    playlistName: null
                }]);
            } else {
                throw new Error(data.message || 'Error desconocido del servidor');
            }
        } catch (err) {
            if (abortAiRequestRef.current) return;
            setAiMessages(prev => [...prev, { role: 'ai', text: 'Ups, perdí conexión con mi base de datos neuronal. Revisa si el servidor está activo.', playlist: null }]);
        } finally {
            if (!abortAiRequestRef.current) {
                setIsAiThinking(false);
            }
        }
    };

    const playAiPlaylist = (playlist) => {
        if (!playlist || playlist.length === 0) return;

        // Actualizar cola y marcar la primera canción
        const fullPlaylist = [...playlist];
        setPlaybackQueue(fullPlaylist);
        setOriginalQueue(fullPlaylist);
        setCurrentTrackIndex(0);

        // Forzar inicio inmediato y actualización de UI
        setTimeout(() => {
            const firstTrack = fullPlaylist[0];
            if (firstTrack) {
                setActiveTrack(firstTrack);
                playTrackCore(firstTrack);
            }
        }, 100);
    };

    // ── Helper: búsqueda en YouTube accionable por la IA ──
    const executeYtSearch = async (query) => {
        if (!query) return;
        setIsYtSearching(true);
        setYtSearchResults([]);
        try {
            const data = await callBackend(`${API_BASE}/api/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            if (data.status === 'success') setYtSearchResults(data.results);
        } catch (e) {
            console.error('[YT Search]', e);
            addToast('Error al buscar en YouTube', 'error');
        } finally {
            setIsYtSearching(false);
        }
    };

    const executeAiAction = (action) => {
        console.log("🤖 AI Executing Action:", action);
        switch (action.type) {
            case 'volume':
                let v = parseFloat(action.value);
                if (!isNaN(v)) {
                    if (v > 1) v = v / 100; // Si es 80, convertir a 0.8
                    setVolume(v);
                    const audio = audioTagRef.current || document.getElementById('engine-audio-tag');
                    if (audio) {
                        audio.volume = Math.min(1, Math.max(0, v));
                    }
                }
                break;
            case 'shutdown':
                const mins = parseInt(action.minutes) || 1;
                alert(`ChakrasPlayer se cerrará automáticamente en ${mins} minuto(s) por orden de la IA.`);
                setTimeout(() => {
                    if (window.pywebview) window.pywebview.api.close_window();
                    else window.close();
                }, mins * 60000);
                break;
            case 'view':
                if (action.id) setView(action.id);
                break;
            case 'play_range':
                const start = parseInt(action.start) || 0;
                const end = parseInt(action.end) || 20;
                const slice = library.slice(start, end);
                if (slice.length > 0) playAiPlaylist(slice);
                break;
            case 'mute':
                setIsMuted(!!action.value);
                break;
            case 'playback':
                if (action.cmd === 'pause') setIsPlaying(false);
                if (action.cmd === 'play') setIsPlaying(true);
                if (action.cmd === 'next') nextTrack();
                if (action.cmd === 'prev') prevTrack();
                break;
            case 'save_playlist':
                console.log("🤖 Playlist guardada por servidor:", action.name);
                addToast(`Playlist "${action.name}" guardada con éxito 🎶`, "success");
                loadPlaylists(); // Recargar la lista en la UI
                break;
            case 'shuffle':
                setIsShuffle(!!action.value);
                break;
            // --- NEW AI CAPABILITIES ---
            case 'theme':
                if (action.accent) {
                    setThemeSettings(prev => ({ ...prev, primaryColor: action.accent }));
                    addToast(`🎨 Color de acento cambiado`, "success");
                }
                if (action.base === 'midnight' || action.base === '') {
                    setThemeSettings(prev => ({ ...prev, baseTheme: action.base }));
                    addToast(`🌙 Tema base: ${action.base || 'Classic'}`, "success");
                }
                if (action.blur !== undefined) setThemeSettings(prev => ({ ...prev, blur: Number(action.blur) }));
                if (action.saturate !== undefined) setThemeSettings(prev => ({ ...prev, saturate: Number(action.saturate) }));
                if (action.opacity !== undefined) setThemeSettings(prev => ({ ...prev, opacity: Number(action.opacity) }));
                if (action.bgColor !== undefined) setThemeSettings(prev => ({ ...prev, backgroundColor: action.bgColor }));
                break;
            case 'eq_preset':
                const presets = {
                    'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    'Bass Boost': [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
                    'Treble Boost': [0, 0, 0, 0, 0, 0, 2, 4, 5, 6],
                    'Vocal': [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1],
                    'Rock': [4, 3, 1, 0, -1, 0, 2, 3, 4, 4],
                    'Electronic': [5, 4, 2, 0, -2, 0, 1, 3, 4, 5],
                    'Jazz': [3, 2, 1, 2, 0, -1, 0, 1, 2, 3],
                    'R&B': [4, 6, 3, 1, -1, 0, 1, 2, 3, 2],
                    'Acoustic': [3, 2, 0, 1, 2, 2, 1, 2, 3, 2],
                    'Classical': [4, 3, 2, 1, 0, -1, 0, 1, 3, 4]
                };
                const preset = action.name;
                if (presets[preset]) {
                    const freqs = [31.25, 62.5, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
                    setEqBands(freqs.map((freq, i) => ({ freq, gain: presets[preset][i] })));
                    setEqPreset(preset);
                    setIsEqEnabled(true);
                    addToast(`🎛️ EQ: ${preset}`, "success");
                }
                break;
            case 'repeat':
                if (action.mode === 'off' || action.mode === 'all' || action.mode === 'one') {
                    setRepeatMode(action.mode);
                    addToast(`🔁 Repetir: ${action.mode === 'off' ? 'Desactivado' : action.mode === 'all' ? 'Todas' : 'Una'}`, "info");
                }
                break;
            case 'search':
                if (action.query) {
                    setLibrarySearchQuery(action.query);
                    setView('library');
                    addToast(`🔍 Buscando en biblioteca: "${action.query}"`, "info");
                }
                break;
            case 'search_yt':
                if (action.query) {
                    setYtSearchQuery(action.query);
                    setView('searchYt');
                    executeYtSearch(action.query);
                    addToast(`🎬 Buscando en YouTube: "${action.query}"`, "info");
                }
                break;
            case 'rate':
                if (activeTrack && action.stars >= 1 && action.stars <= 5) {
                    window.StorageApi.rateTrack(activeTrack.id, action.stars);
                    addToast(`⭐ Canción valorada con ${action.stars} estrella(s)`, "success");
                }
                break;
            case 'crossfade':
                if (action.seconds !== undefined) {
                    setCrossfade(Math.min(12, Math.max(0, parseInt(action.seconds))));
                    addToast(`🔊 Crossfade: ${action.seconds}s`, "info");
                }
                break;
            case 'seek':
                const time = parseFloat(action.value);
                if (!isNaN(time) && audioTagRef.current) {
                    audioTagRef.current.currentTime = time;
                }
                break;
            case 'sleep_timer':
                const sleepMins = parseInt(action.minutes) || 30;
                addToast(`💤 Temporizador: ${sleepMins} min`, "info");
                setTimeout(() => {
                    setIsPlaying(false);
                    addToast("💤 Temporizador de sueño activado. ¡Buenas noches!", "info");
                }, sleepMins * 60000);
                break;
        }
    };

    // --- PHASE 3: REMOTE HOST SYNC ENGINE ---


    // Fetch Local IP & Port for Pairing (Prioritize Bridge)
    useEffect(() => {
        const fetchConnectionInfo = async () => {
            try {
                let data;
                if (window.pywebview && window.pywebview.api && window.pywebview.api.get_local_ip) {
                    data = await window.pywebview.api.get_local_ip();
                } else {
                    data = await callBackend(`${API_BASE}/api/local-ip`);
                }

                const ip = data.ip || "127.0.0.1";
                setLocalIp(ip);
                if (data.port) setServerPort(data.port);
                if (data.globalUrl) setGlobalTunnelUrl(data.globalUrl);

                const reachable = data.isLanReachable !== undefined
                    ? data.isLanReachable
                    : (!ip.startsWith("127.") && ip !== "localhost");
                setIsLanReachable(reachable);
            } catch (e) {
                console.warn("Connection info fetch failed", e);
                setIsLanReachable(false);
            }
        };

        fetchConnectionInfo();

        // Poll connection info while settings are open (to detect global tunnel becoming active)
        let pollInterval = null;
        if (view === 'settings' && settingsTab === 'connection') {
            pollInterval = setInterval(fetchConnectionInfo, 5000);
        }

        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [view, settingsTab]);

    // Loop: PUSH State to Server (Remote sync)
    useEffect(() => {
        if (!remoteEnabled) return;
        const pushState = async () => {
            try {
                const currentTrack = activeTrack || (playbackQueue && playbackQueue[currentTrackIndex]);
                const audio = audioTagRef.current || document.getElementById('engine-audio-tag');

                // Use currentTime and duration from app state
                const currentPos = currentTime;
                const currentDur = duration;

                const state = {
                    track: currentTrack ? {
                        title: currentTrack.title || currentTrack.filename || "Cancion desconocida",
                        artist: currentTrack.artist || "Artista desconocido",
                        coverUrl: currentTrack.coverUrl || currentTrack.cover || `/api/cover?id=${currentTrack.id || 0}`,
                    } : null,
                    isPlaying,
                    volume,
                    position: currentPos,
                    duration: currentDur,
                };

                await fetch('/api/remote/update-state', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(state)
                });
            } catch (e) {
                console.error("Remote Sync Error:", e);
            }
        };

        const interval = setInterval(pushState, 1000);
        return () => clearInterval(interval);
    }, [activeTrack, currentTrackIndex, isPlaying, volume, remoteEnabled, currentTime, duration]);

    // Loop: PULL Commands from Server (Mobile → Desktop command)
    useEffect(() => {
        if (!remoteEnabled) return;
        const pullCommands = async () => {
            try {
                const res = await fetch('/api/remote/commands');
                const data = await res.json();
                if (data.commands && data.commands.length > 0) {
                    data.commands.forEach(cmdData => {
                        // Maps remote commands to executeAiAction format
                        if (cmdData.command === 'playback') {
                            executeAiAction({ type: 'playback', cmd: cmdData.value });
                        } else if (cmdData.command === 'volume') {
                            executeAiAction({ type: 'volume', value: cmdData.value });
                        } else if (cmdData.command === 'seek') {
                            executeAiAction({ type: 'seek', value: cmdData.value });
                        }
                    });
                }
            } catch (e) { }
        };

        const interval = setInterval(pullCommands, 1000); // Pull every 1s
        return () => clearInterval(interval);
    }, [remoteEnabled]);


    // --- Advanced Audio Graph Refs (Gapless & Crossfade) ---
    const [isEqEnabled, setIsEqEnabled] = useState(true);
    const [eqPreset, setEqPreset] = useState('Manual');
    const [eqBands, setEqBands] = useState([
        { freq: 31.25, gain: 0 }, { freq: 62.5, gain: 0 }, { freq: 125, gain: 0 }, { freq: 250, gain: 0 }, { freq: 500, gain: 0 },
        { freq: 1000, gain: 0 }, { freq: 2000, gain: 0 }, { freq: 4000, gain: 0 }, { freq: 8000, gain: 0 }, { freq: 16000, gain: 0 }
    ]);

    // Auto-save effects for EQ
    useEffect(() => { window.StorageApi.setSetting('eqEnabled', isEqEnabled); }, [isEqEnabled]);
    useEffect(() => { window.StorageApi.setSetting('eqPreset', eqPreset); }, [eqPreset]);
    useEffect(() => { window.StorageApi.setSetting('eqBands', eqBands); }, [eqBands]);

    const [settingsTab, setSettingsTab] = useState('appearance');
    const [showAccentPicker, setShowAccentPicker] = useState(false);

    const eqDescriptions = {
        31.25: "Sub-bajo. Siente el 'rumble' de bajos pesados. Sube para música electrónica o de cine.",
        62.5: "Bajo profundo. El cuerpo principal del bombo y el bajo eléctrico. Aumenta para más 'golpe'.",
        125: "Bajo alto (Calidez). Da cuerpo a la mezcla. Bájalo si suena muy embarrado ('muddy').",
        250: "Medios bajos (Cuerpo). Agrega grosor. Demasiado puede sonar muy encajonado o sucio.",
        500: "Medios. El núcleo de la mayoría de los instrumentos. Ajusta para traerlos al frente.",
        1000: "Ataque medio. Controla la prominencia e impacto de la voz principal y cajas/redoblantes.",
        2000: "Medios altos (Claridad). Define el ataque percusivo. Demasiado causa fatiga auditiva rápida.",
        4000: "Presencia. El oído humano es más sensible aquí. Da vida y cercanía a las voces y guitarras.",
        8000: "Brillo (Treble). Añade nitidez a los platillos y sintetizadores. Baja para suavizar agudos.",
        16000: "Aire (Air). Frecuencias finas de silbido. Da una sensación de atmósfera y espacio abierto en 3D."
    };
    const reqAnimFrameRef = useRef(null);

    // Extreme INP Direct DOM Manipulation Refs
    const durationRef = useRef(0);
    const currentProgressRef = useRef(0);
    const uiProgressInputRef = useRef(null);
    const uiCurrentTimeTextRef = useRef(null);

    const audioTagRef2 = useRef(null);
    const sourceNodeRef2 = useRef(null);
    const gainNodeRef2 = useRef(null);
    const mainGainRef = useRef(null);
    const activeTagIdx = useRef(0);
    const isCrossfading = useRef(false);

    // Init Audio Engine with MediaElementSource
    const initAudioEngine = useCallback(() => {
        if (!audioContextRef.current) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioContextRef.current = new AudioContext();

            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;

            gainNodeRef.current = audioContextRef.current.createGain();

            // Create EQ chain
            eqNodesRef.current = eqBands.map((band, i) => {
                const filter = audioContextRef.current.createBiquadFilter();
                filter.type = i === 0 ? 'lowshelf' : i === eqBands.length - 1 ? 'highshelf' : 'peaking';
                filter.frequency.value = band.freq;
                filter.Q.value = 1;
                filter.gain.value = isEqEnabled ? band.gain : 0;
                return filter;
            });

            // Two audio tags for crossfade
            if (!audioTagRef.current) audioTagRef.current = document.getElementById('engine-audio-tag');
            if (!audioTagRef2.current) audioTagRef2.current = document.getElementById('engine-audio-tag-2');

            sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioTagRef.current);
            sourceNodeRef2.current = audioContextRef.current.createMediaElementSource(audioTagRef2.current);

            gainNodeRef.current = audioContextRef.current.createGain(); // For tag 1
            gainNodeRef2.current = audioContextRef.current.createGain(); // For tag 2

            // Routing: Source1/2 -> individual nodes -> EQ chain -> mainGain -> Analyser -> Dest
            sourceNodeRef.current.connect(gainNodeRef.current);
            sourceNodeRef2.current.connect(gainNodeRef2.current);

            gainNodeRef.current.connect(eqNodesRef.current[0]);
            gainNodeRef2.current.connect(eqNodesRef.current[0]);

            let lastNode = eqNodesRef.current[0];
            for (let i = 1; i < eqNodesRef.current.length; i++) {
                lastNode.connect(eqNodesRef.current[i]);
                lastNode = eqNodesRef.current[i];
            }

            // Main output gain
            const mainGain = audioContextRef.current.createGain();
            mainGain.gain.value = volume;
            mainGainRef.current = mainGain;

            lastNode.connect(mainGain);
            mainGain.connect(analyserRef.current);
            analyserRef.current.connect(audioContextRef.current.destination);

            addToast("Motor Audio (Multi-Source X-Fade) inicializado", 'info');
        }
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
    }, [eqBands, isEqEnabled, addToast]); // Depend on eqBands and isEqEnabled to re-initialize if they change

    const handleEqChange = (index, value) => {
        const newGain = Number(value);
        setEqPreset('Manual');
        setEqBands(prev => {
            const next = [...prev];
            next[index] = { ...next[index], gain: newGain };
            return next;
        });
        if (isEqEnabled && audioContextRef.current && eqNodesRef.current[index]) {
            const ctx = audioContextRef.current;
            eqNodesRef.current[index].gain.linearRampToValueAtTime(newGain, ctx.currentTime + 0.1);
        }
    };

    const toggleEq = () => {
        const newState = !isEqEnabled;
        setIsEqEnabled(newState);
        if (audioContextRef.current) {
            const ctx = audioContextRef.current;
            eqNodesRef.current.forEach((filter, idx) => {
                filter.gain.linearRampToValueAtTime(newState ? eqBands[idx].gain : 0, ctx.currentTime + 0.1);
            });
        }
    };

    const applyEqPreset = (presetName) => {
        const presets = {
            'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            'Bass Boost': [6, 5, 4, 0, 0, 0, 0, 0, 0, 0],
            'Electronic': [5, 4, 1, 0, -2, -1, 1, 3, 4, 5],
            'Vocal': [-2, -1, 0, 2, 4, 4, 2, 0, -1, -2],
            'Dance': [4, 6, 3, 0, -1, 0, 2, 4, 4, 3],
            'Acoustic': [2, 1, 0, 0, 1, 1, 2, 3, 2, 1],
            'Manual': null
        };

        setEqPreset(presetName);
        if (presetName === 'Manual') return;

        const gains = presets[presetName] || presets['Flat'];
        setEqBands(prev => prev.map((band, idx) => ({ ...band, gain: gains[idx] })));

        if (isEqEnabled && audioContextRef.current) {
            const ctx = audioContextRef.current;
            eqNodesRef.current.forEach((filter, idx) => {
                filter.gain.linearRampToValueAtTime(gains[idx], ctx.currentTime + 0.2);
            });
        }
    };

    const syncLockRef = React.useRef(false);

    const performInitialSync = async (forceClear = false) => {
        if (syncLockRef.current) return;
        if (!window.indexedDB) {
            addToast("Error crítico: Sistema de base de datos no disponible.", "error");
            return;
        }

        try {
            syncLockRef.current = true;
            console.log("[Sync] Starting server synchronization...");
            let data = null;

            // Check bridge availability
            const isBridgeAvailable = window.pywebview && window.pywebview.api && window.pywebview.api.get_library;

            if (isBridgeAvailable) {
                console.log("[Sync] Using PyWebView Bridge...");
                data = await window.pywebview.api.get_library();
            } else {
                console.warn("[Sync] Native Bridge not found or outdated. Fallback to fetch...");
                try {
                    const res = await fetch('http://127.0.0.1:5888/api/library', { method: 'POST' });
                    data = await res.json();
                } catch (e) {
                    console.error("[Sync] Fetch failed:", e);
                    addToast("Error: Motor nativo desconectado. Revisa el backend.", "warning");
                    return;
                }
            }

            if (data && data.status === 'success' && data.tracks) {
                if (forceClear) {
                    await window.StorageApi.clearTracks();
                    // Also clear blacklist to truly "restore"
                    await db.deleted_tracks.clear();
                }

                const blacklisted = await window.StorageApi.getBlacklistedTracks();
                const serverTracks = data.tracks.filter(t =>
                    !t.isDownloading &&
                    !t.title?.includes('(Descargando...)') &&
                    !blacklisted.has(t.id)
                );

                const localTracksNow = await window.StorageApi.getAllTracks();
                const localMap = new Map();
                localTracksNow.forEach(t => {
                    const key = t.filePath?.toLowerCase().replace(/\\/g, '/') || t.id;
                    localMap.set(key, t);
                });

                let changed = false;
                const merged = [...localTracksNow];

                serverTracks.forEach(st => {
                    const pathKey = st.filePath?.toLowerCase().replace(/\\/g, '/') || st.id;
                    if (!localMap.has(pathKey)) {
                        merged.push(st);
                        changed = true;
                    } else {
                        const local = localMap.get(pathKey);
                        // Simple heuristic to update if server has more info
                        if (st.duration > local.duration || st.ytThumbnail || (st.album && st.album !== local.album)) {
                            const idx = merged.findIndex(t => t.id === local.id);
                            if (idx !== -1) {
                                const updated = { ...local, ...st };
                                if (!st.coverUrl && local.coverUrl) updated.coverUrl = local.coverUrl;
                                merged[idx] = updated;
                                changed = true;
                            }
                        }
                    }
                });

                if (changed || localTracksNow.length === 0 || forceClear) {
                    const sortedMerged = merged.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
                    setLibrary(sortedMerged);
                    setOriginalQueue(sortedMerged);
                    setPlaybackQueue(sortedMerged);
                    await window.StorageApi.saveTracks(sortedMerged);
                    if (merged.length > 0) {
                        addToast(`Sincronización completa: ${merged.length} canciones encontradas.`, 'info');
                    }
                }
            }
        } catch (err) {
            console.error("Sync error:", err);
            addToast("Error al sincronizar la biblioteca.", "error");
        } finally {
            syncLockRef.current = false;
        }
    };

    // 1. App Initialization (Load DB)
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // Priority 0: Load Theme FIRST to prevent UI flicker
                const savedTheme = await window.StorageApi.getCustomTheme();
                if (savedTheme) {
                    setThemeSettings(savedTheme);
                    setDraftThemeSettings(savedTheme);
                }

                let localTracks = await window.StorageApi.getAllTracks();

                // Priority 1: Populate UI with whatever we have locally
                if (localTracks.length > 0) {
                    const sorted = localTracks.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
                    setLibrary(sorted);
                    setOriginalQueue(sorted);
                    setPlaybackQueue(sorted);
                }

                // Priority 2: Load settings and determine sync strategy
                const savedPath = await window.StorageApi.getSetting('folderPath');
                const savedDevice = await window.StorageApi.getSetting('audioDeviceId');
                const savedPerf = await window.StorageApi.getSetting('performanceMode');
                const savedCrossfade = await window.StorageApi.getSetting('crossfade');
                const savedAutoplay = await window.StorageApi.getSetting('autoplay');
                const savedNormalize = await window.StorageApi.getSetting('normalize');
                const savedGapless = await window.StorageApi.getSetting('gapless');
                const savedEqEnabled = await window.StorageApi.getSetting('eqEnabled');
                const savedEqPreset = await window.StorageApi.getSetting('eqPreset');
                const savedEqBands = await window.StorageApi.getSetting('eqBands');

                if (savedPath) setSavedFolderPath(savedPath);
                if (savedDevice) setAudioDeviceId(savedDevice);
                if (savedPerf !== null) setPerformanceMode(!!savedPerf);
                if (savedCrossfade !== null) setCrossfade(Number(savedCrossfade));
                if (savedAutoplay !== null) setIsAutoplay(savedAutoplay === true || savedAutoplay === 'true');
                if (savedNormalize !== null) setIsNormalize(savedNormalize === true || savedNormalize === 'true');
                if (savedGapless !== null) setIsGapless(savedGapless === true || savedGapless === 'true');
                if (savedEqEnabled !== null) setIsEqEnabled(!!savedEqEnabled);
                if (savedEqPreset) setEqPreset(savedEqPreset);
                if (savedEqBands) setEqBands(savedEqBands);

                // Priority 3: Trigger Sync or Scan
                if (savedPath && localTracks.length === 0) {
                    // If library is empty but we have a path, do a deep scan
                    console.log("[Startup] Library empty, triggering initial scan...");
                    await performScan(savedPath, true);
                } else {
                    // Otherwise just do a regular background sync for new downloads
                    console.log("[Startup] Triggering initial sync...");
                    await performInitialSync(localTracks.length === 0);
                }

            } catch (err) {
                console.error("Startup load error:", err);
            }
        };
        loadInitialData();
    }, []);

    // Auto-save effects for Playback
    useEffect(() => { window.StorageApi.setSetting('crossfade', crossfade); }, [crossfade]);
    useEffect(() => { window.StorageApi.setSetting('autoplay', isAutoplay); }, [isAutoplay]);
    useEffect(() => { window.StorageApi.setSetting('normalize', isNormalize); }, [isNormalize]);
    useEffect(() => { window.StorageApi.setSetting('gapless', isGapless); }, [isGapless]);

    useEffect(() => {
        if (audioDeviceId) {
            // Note: setSinkId is currently only available on HTMLMediaElement, not directly on AudioContext destination in all browsers.
            // For Web Audio API, setting the sink programmatically often requires Experimental flags or `setSinkId` on the AudioContext.
            // Implementation varying by browser, wrapping in generic try-catch.
            if (audioContextRef.current && typeof audioContextRef.current.setSinkId === 'function') {
                audioContextRef.current.setSinkId(audioDeviceId).catch(err => console.warn('Failed to setSinkId on AudioContext', err));
            } else if (audioTagRef.current && typeof audioTagRef.current.setSinkId === 'function') {
                audioTagRef.current.setSinkId(audioDeviceId).catch(err => console.warn('Failed to setSinkId on MediaElement', err));
            }
        }
    }, [audioDeviceId]);

    // 2. Request Permission on returning session
    const restoreLibraryAccess = async () => {
        if (savedDirHandle) {
            try {
                const permission = await savedDirHandle.requestPermission({ mode: 'read' });
                if (permission === 'granted') {
                    setPermissionNeeded(false);
                    const tracks = await window.StorageApi.getAllTracks();
                    setLibrary(tracks.sort((a, b) => b.dateAdded - a.dateAdded));
                    console.log("[Access] Permissions restored.");
                }
            } catch (e) {
                console.error("[Access] Failed to restore permissions:", e);
                alert("Error al restaurar acceso. Por favor, selecciona la carpeta de nuevo.");
            }
        }
    };

    // 3. Scan Local Directory using FileSystem Access API (REPLACES Server Scan)
    const scanDirectory = async () => {
        try {
            const folderPath = await window.pywebview.api.pick_folder();
            if (folderPath) {
                setIsScanning(true);
                setSavedFolderPath(folderPath);
                await window.StorageApi.setSetting('directoryPath', folderPath);
                setPermissionNeeded(false);
                await performScan(folderPath);
            }
        } catch (err) {
            console.error("Error picking folder:", err);
            alert("Error al seleccionar carpeta: " + err.message);
        } finally {
            setIsScanning(false);
        }
    };

    const performScan = async (path, isStartup = false) => {
        try {
            setIsScanning(true);
            const data = await window.pywebview.api.scan_folder(path);
            if (!data || data.status !== 'success') {
                throw new Error(data?.message || 'Bridge scan failed');
            }

            if (data.status === 'success') {
                // FETCH SERVER LIBRARY (Downloads) to avoid losing them in the scan
                let serverLibraryTracks = [];
                try {
                    const sres = await fetch('http://127.0.0.1:5888/api/library', { method: 'POST' });
                    const sdata = await sres.json();
                    if (sdata.status === 'success' && sdata.tracks) {
                        serverLibraryTracks = sdata.tracks.map(t => ({
                            ...t,
                            coverUrl: t.coverUrl || t.ytThumbnail || t.uploaderThumbnail || null
                        }));
                    }
                } catch (err) {
                    console.warn("[Scan] Error fetching server library:", err);
                }

                const existingTracks = await window.StorageApi.getAllTracks();
                const combinedMap = new Map();

                // 1. Add existing tracks from local DB (prefer enriched data)
                existingTracks.forEach(t => {
                    const key = t.filePath?.toLowerCase().replace(/\\/g, '/');
                    if (key) combinedMap.set(key, t);
                });

                // 2. Add server library (official downloads)
                serverLibraryTracks.forEach(t => {
                    const key = t.filePath?.toLowerCase().replace(/\\/g, '/');
                    if (key) {
                        const existing = combinedMap.get(key);
                        // Merge server data
                        combinedMap.set(key, { ...existing, ...t });
                    }
                });

                // 3. Add fresh scan results
                const blacklisted = await window.StorageApi.getBlacklistedTracks();
                data.tracks.forEach(t => {
                    if (blacklisted.has(t.id)) return;
                    const key = t.filePath?.toLowerCase().replace(/\\/g, '/');
                    if (key) {
                        const existing = combinedMap.get(key);
                        if (!existing || (!existing.coverUrl && t.coverUrl)) {
                            combinedMap.set(key, { ...existing, ...t });
                        } else {
                            combinedMap.set(key, { ...t, ...existing });
                        }
                    }
                });

                let finalLibrary = Array.from(combinedMap.values());

                // --- AUTO-SANITIZATION REMOVED ---
                // (Removed to prevent hangs during startup scan)

                finalLibrary.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));

                setLibrary(finalLibrary);
                setOriginalQueue(finalLibrary);
                setPlaybackQueue(finalLibrary);
                await window.StorageApi.clearTracks();
                await window.StorageApi.saveTracks(finalLibrary);

                const needsEnrichment = finalLibrary.filter(t => !t.coverUrl || t.album === "Unknown Album" || t.artist === "Unknown Artist").map(t => t.id);
                setEnrichmentQueue(needsEnrichment);

                if (!isStartup) {
                    alert(`Scan Complete: Found ${finalLibrary.length} songs.`);
                }
            } else {
                console.error("[Scan] Server error:", data.message);
                if (!isStartup) alert(`Scan Error: ${data.message || 'Unknown error occurred on the server.'}`);
            }
        } catch (e) {
            console.error("[Scan] Fetch failed:", e);
            if (!isStartup) alert(`Cannot connect to the backend server. (Error: ${e.message})`);
        } finally {
            setIsScanning(false);
        }
    };

    // --- Advanced Audio & Lyrics Logic ---

    // --- Metadata Enrichment System ---
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        let timeoutId;
        const processQueue = async () => {
            if (enrichmentQueue.length === 0 || !isOnline || isScanning) return;

            const trackId = enrichmentQueue[0];
            setCurrentlyEnriching(trackId);

            try {
                const track = library.find(t => t.id === trackId);
                if (track) {
                    // Clean title for better search (frontend side too for speed)
                    const cleanTitle = track.title.replace(/\[.*?(official|music|video|audio|lyric|live|remaster).*?\]|\(.*?(official|music|video|audio|lyric|live|remaster).*?\)/gi, '').trim();

                    const res = await fetch('http://127.0.0.1:5888/api/enrich-metadata', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: cleanTitle || track.title,
                            artist: track.artist,
                            ytThumbnail: track.ytThumbnail,
                            uploaderThumbnail: track.uploaderThumbnail
                        })
                    });

                    if (res.ok) {
                        const enriched = await res.json();

                        const updatedFields = {
                            coverUrl: enriched.coverUrl || track.coverUrl,
                            album: (enriched.album && enriched.album !== "None") ? enriched.album : track.album,
                            releaseYear: enriched.releaseYear || track.releaseYear
                        };

                        await window.StorageApi.updateTrack(track.id, updatedFields);

                        // Update all states to reflect changes
                        const updateFn = prev => prev.map(t => t.id === track.id ? { ...t, ...updatedFields } : t);
                        setLibrary(updateFn);
                        setPlaybackQueue(updateFn);
                        setOriginalQueue(updateFn);

                        // PERSIST on server/file too
                        try {
                            fetch('http://127.0.0.1:5888/api/edit-metadata', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    filePath: track.filePath,
                                    title: track.title,
                                    artist: track.artist,
                                    album: updatedFields.album,
                                    year: updatedFields.releaseYear,
                                    coverUrl: updatedFields.coverUrl
                                })
                            });
                        } catch (e) { console.warn("Failed to persist enrichment to server", e); }
                    }
                }
            } catch (e) {
                console.error("Error processing enrichment loop", e);
            }

            setEnrichmentQueue(prev => prev.slice(1));
            setCurrentlyEnriching(null);
            setEnrichmentStep('');
        };

        // Add a small delay for the very first item starting to not block rendering
        const immediateId = setTimeout(() => { processQueue(); }, enrichmentQueue.length > 0 && !currentlyEnriching ? 100 : 3000);

        return () => {
            clearTimeout(timeoutId);
            clearTimeout(immediateId);
        };
    }, [enrichmentQueue, isOnline, isScanning, library, currentlyEnriching]);

    const toggleShuffle = () => {
        if (originalQueue.length === 0) return;
        let newQueue;
        let newIndex = -1;

        if (!isShuffle) {
            const currentTrack = playbackQueue[currentTrackIndex];
            let remaining = [...originalQueue];
            if (currentTrack) {
                const currentIdxInOriginal = remaining.findIndex(t => t.id === currentTrack.id);
                if (currentIdxInOriginal !== -1) {
                    remaining.splice(currentIdxInOriginal, 1);
                }
            }
            // Fisher-Yates
            for (let i = remaining.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
            }
            newQueue = currentTrack ? [currentTrack, ...remaining] : remaining;
            newIndex = currentTrack ? 0 : -1;
            setIsShuffle(true);
        } else {
            newQueue = [...originalQueue];
            const currentTrack = playbackQueue[currentTrackIndex];
            if (currentTrack) {
                const idx = newQueue.findIndex(t => t.id === currentTrack.id);
                newIndex = idx !== -1 ? idx : 0;
            }
            setIsShuffle(false);
        }

        setPlaybackQueue(newQueue);
        setCurrentTrackIndex(newIndex);
    };

    const toggleRepeat = () => {
        const modes = ['off', 'all', 'one'];
        setRepeatMode(prev => modes[(modes.indexOf(prev) + 1) % modes.length]);
    };

    const handleDeviceSelect = async () => {
        try {
            // First try the native browser picker (Chrome 110+)
            if (navigator.mediaDevices && navigator.mediaDevices.selectAudioOutput) {
                const device = await navigator.mediaDevices.selectAudioOutput();
                setAudioDeviceId(device.deviceId);
                window.StorageApi.setSetting('audioDeviceId', device.deviceId);
                return;
            }
            // Fallback: enumerate devices and show custom picker
            const devices = await navigator.mediaDevices.enumerateDevices();
            const outputs = devices.filter(d => d.kind === 'audiooutput');
            setAudioDevices(outputs);
            setShowDevicePicker(prev => !prev);
        } catch (err) {
            console.warn('Device selection error', err);
            // Fallback: enumerate without permissions
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const outputs = devices.filter(d => d.kind === 'audiooutput');
                setAudioDevices(outputs);
                setShowDevicePicker(prev => !prev);
            } catch (e2) {
                alert('Tu navegador no soporta selección de dispositivo de audio. Usa la configuración de Windows para cambiar el dispositivo de salida.');
            }
        }
    };

    const selectDevice = async (deviceId) => {
        setAudioDeviceId(deviceId);
        window.StorageApi.setSetting('audioDeviceId', deviceId);
        setShowDevicePicker(false);
        // Apply immediately
        try {
            if (audioTagRef.current && audioTagRef.current.setSinkId) {
                await audioTagRef.current.setSinkId(deviceId);
            }
        } catch (e) {
            console.warn('Failed to set sink ID', e);
        }
    };

    const parseLrc = (lrcString) => {
        if (!lrcString) return [];
        const lines = lrcString.split('\n');
        const result = [];
        const timeExp = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;

        let hasSync = false;
        lines.forEach(line => {
            let match;
            const times = [];
            let text = line;

            // Extract all timestamps in the line
            let foundTimestamp = false;
            while ((match = timeExp.exec(line)) !== null) {
                foundTimestamp = true;
                hasSync = true;
                const min = parseInt(match[1], 10);
                const sec = parseInt(match[2], 10);
                const msStr = match[3];
                const ms = parseInt(msStr, 10);
                // Adjust for 2 or 3 digit ms
                const time = min * 60 + sec + (ms / (msStr.length === 2 ? 100 : 1000));
                times.push(time);
            }

            text = line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim();
            if (text) {
                let type = 'normal';
                // Simple categorization for professional display
                if (text.toLowerCase().includes('(coro)') || text.toLowerCase().includes('[chorus]')) type = 'chorus';
                else if (text.startsWith('(') && text.endsWith(')')) type = 'secondary';
                else if (text.startsWith('[') && text.endsWith(']')) type = 'annotation';

                if (times.length > 0) {
                    times.forEach(t => result.push({ time: t, text, type }));
                } else if (!foundTimestamp) {
                    result.push({ time: -1, text, type });
                }
            }
        });

        if (hasSync) {
            return result.sort((a, b) => a.time - b.time);
        }
        return result;
    };

    const loadLyrics = async (artist, title, album, duration) => {
        if (!artist || !title) return;
        setLyricsLoading(true);
        setLyricsError(null);

        try {
            const res = await fetch('http://127.0.0.1:5888/api/lyrics/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ artist, title })
            });
            const data = await res.json();
            if (data.lyrics) {
                setLyricsData(parseLrc(data.lyrics));
            } else {
                setLyricsData(null);
            }
        } catch (e) {
            setLyricsError("Error al conectar con el servidor de letras");
        } finally {
            setLyricsLoading(false);
        }
    };

    const nextTrack = useCallback((isAutoNext = false, isTransition = false) => {
        const queue = playbackQueueRef.current;
        const index = currentTrackIndexRef.current;
        const rMode = repeatModeRef.current;

        if (queue.length === 0) return;
        let nextIdx;
        if (rMode === 'one' && isAutoNext && !isTransition) {
            nextIdx = index;
        } else {
            nextIdx = (index + 1) % queue.length;
        }
        const track = queue[nextIdx];

        if (audioTagRef.current) audioTagRef.current.onended = null;
        if (audioTagRef2.current) audioTagRef2.current.onended = null;

        setCurrentTrackIndex(nextIdx);
        setIsPlaying(true);
        if (track) playTrackCore(track, isTransition);
    }, [playTrackCore]);

    const prevTrack = useCallback(() => {
        const queue = playbackQueueRef.current;
        const index = currentTrackIndexRef.current;
        if (queue.length === 0) return;
        const prevIdx = index > 0 ? index - 1 : queue.length - 1;
        const track = queue[prevIdx];
        setCurrentTrackIndex(prevIdx);
        setIsPlaying(true);
        if (track) playTrackCore(track);
    }, [playTrackCore]);

    const handleOffsetChange = async (delta) => {
        if (!activeTrack) return;
        let newOffset;
        if (delta === 'reset') {
            newOffset = 0;
        } else {
            newOffset = parseFloat(((activeTrack.lyricsOffset || 0) + delta).toFixed(1));
        }

        const updated = { ...activeTrack, lyricsOffset: newOffset };
        setActiveTrack(updated);

        // Update immediate queues
        setLibrary(prev => prev.map(t => t.id === updated.id ? updated : t));
        setPlaybackQueue(prev => prev.map(t => t.id === updated.id ? updated : t));
        setOriginalQueue(prev => prev.map(t => t.id === updated.id ? updated : t));

        // Update persistent DB over API
        try {
            fetch('http://127.0.0.1:5888/api/edit-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filePath: updated.filePath || updated.fileName,
                    id: updated.id,
                    lyricsOffset: newOffset
                })
            });
            addToast(`Offset: ${newOffset > 0 ? '+' : ''}${newOffset}s`, 'success');
        } catch (e) { console.error(e); }
    };

    const selectTrack = useCallback((index, fromLibrary = false) => {
        let track;
        let queueIndex;
        if (fromLibrary) {
            const newQueue = [...library];
            setPlaybackQueue(newQueue);
            setOriginalQueue(newQueue);
            queueIndex = index;
            track = newQueue[index];
        } else {
            queueIndex = index;
            track = playbackQueue[index];
        }
        if (!track) return;

        setActiveTrack(track);

        if (queueIndex === currentTrackIndex && isPlaying) {
            togglePlay();
            return;
        }
        setCurrentTrackIndex(queueIndex);
        setIsPlaying(true);
        playTrackCore(track);
    }, [library, playbackQueue, currentTrackIndex, isPlaying, playTrackCore]);

    const togglePlay = useCallback(() => {
        const audio = audioTagRef.current;
        if (!audio) return;

        if (!audioContextRef.current) {
            initAudioEngine();
        } else if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().catch(() => { });
        }

        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
            if (reqAnimFrameRef.current) cancelAnimationFrame(reqAnimFrameRef.current);
        } else {
            if (activeTrack && audio.src) {
                audio.play().then(() => {
                    setIsPlaying(true);
                    startProgressLoop();
                }).catch(() => { });
            } else if (playbackQueue.length > 0 && currentTrackIndex >= 0) {
                playTrackCore(playbackQueue[currentTrackIndex]);
            } else if (playbackQueue.length > 0) {
                setCurrentTrackIndex(0);
                setIsPlaying(true);
            }
        }
    }, [isPlaying, activeTrack, playbackQueue, currentTrackIndex, playTrackCore]);

    const handleVolume = useCallback((e) => {
        const v = parseFloat(e.target.value);
        setVolume(v);
        const audio = audioTagRef.current;
        const audio2 = audioTagRef2.current;
        if (audio) audio.volume = Math.min(1, Math.max(0, v));
        if (audio2) audio2.volume = Math.min(1, Math.max(0, v));
        // Persistent volume across restarts
        if (window.localStorage) localStorage.setItem('chakras_volume', v);
    }, []);

    const startProgressLoop = () => {
        if (reqAnimFrameRef.current) cancelAnimationFrame(reqAnimFrameRef.current);

        const update = () => {
            const audio = activeTagIdx.current === 0 ? audioTagRef.current : audioTagRef2.current;
            if (audio && !audio.paused) {
                const current = audio.currentTime + (activeTrackRef.current?.lyricsOffset || 0);
                const dur = audio.duration;

                // Sync Ref for Seek and Lyrics
                currentProgressRef.current = current;

                if (dur > 0) {
                    const perc = (current / dur) * 100;

                    if (uiProgressInputRef.current) {
                        uiProgressInputRef.current.value = current;
                        uiProgressInputRef.current.max = dur;
                        uiProgressInputRef.current.style.background = `linear-gradient(to right, var(--color-vibrant, var(--color-blurple)) ${perc}%, var(--color-tertiary) ${perc}%)`;
                    }

                    if (uiCurrentTimeTextRef.current) {
                        uiCurrentTimeTextRef.current.textContent = formatTime(current);
                    }

                    // Update active row visualizers natively
                    const listActiveRow = document.getElementById('active-row-bg-list');
                    if (listActiveRow) listActiveRow.style.background = `linear-gradient(to right, var(--color-vibrant-dark) 0%, var(--color-vibrant-dark) ${perc}%, transparent ${perc}%, transparent 100%)`;

                    const queueActiveRow = document.getElementById('active-row-bg-queue');
                    if (queueActiveRow) queueActiveRow.style.background = `linear-gradient(to right, var(--color-vibrant-dark) 0%, var(--color-vibrant-dark) ${perc}%, transparent ${perc}%, transparent 100%)`;

                    // Karaoke Lyrics Sync
                    if (lyricsDataRef.current && lyricsContainerRef.current) {
                        const lData = lyricsDataRef.current;
                        if (lData.length > 0 && lData[0].time !== -1) {
                            let actIdx = -1;
                            for (let i = 0; i < lData.length; i++) {
                                if (current >= lData[i].time) actIdx = i;
                                else break;
                            }

                            if (actIdx !== -1) {
                                const cLyric = lData[actIdx];
                                const nLyric = lData[actIdx + 1];
                                const nextTime = nLyric ? nLyric.time : cLyric.time + 4;
                                const duration = nextTime - cLyric.time;
                                let lineProg = Math.max(0, Math.min(100, ((current - cLyric.time) / duration) * 100));

                                const children = lyricsContainerRef.current.children;
                                for (let i = 0; i < lData.length; i++) {
                                    const el = children[i + 1];
                                    if (!el) continue;

                                    if (i === actIdx) {
                                        if (!el.classList.contains('active-lyric-line')) {
                                            el.classList.add('active-lyric-line');
                                            el.classList.remove('inactive-lyric-line');
                                            // Ensure smooth centered scrolling
                                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }
                                        el.style.setProperty('--karaoke-fill', `${lineProg}%`);
                                    } else {
                                        if (el.classList.contains('active-lyric-line')) {
                                            el.classList.remove('active-lyric-line');
                                            el.classList.add('inactive-lyric-line');
                                        }
                                        el.style.removeProperty('--karaoke-fill');
                                    }
                                }
                            }
                        }
                    }

                    // Visualizer Reactivity Removed for zero-gpu-idle
                    document.documentElement.style.setProperty('--beat-scale', 1.0);
                    document.documentElement.style.setProperty('--beat-bright', 1.0);
                    document.documentElement.style.setProperty('--beat-opacity', 0.5);

                    // React Sync
                    setCurrentTime(prev => (Math.abs(prev - current) > 0.1) ? current : prev);

                    // Stats Logging
                    if (!hasLoggedPlayRef.current && current > (dur * 0.5)) {
                        hasLoggedPlayRef.current = true;
                        const track = playbackQueue[currentTrackIndex];
                        if (track) window.StorageApi.logPlay(track.artist, dur / 60, track.id);
                    }

                    // Crossfade Trigger
                    if (isMixMode && dur > 10 && current > (dur - 5) && !isCrossfading.current) {
                        isCrossfading.current = true;
                        console.log("[MixMode] Starting 5s Crossfade...");
                        const currGain = activeTagIdx.current === 0 ? gainNodeRef.current : gainNodeRef2.current;
                        if (currGain) currGain.gain.linearRampToValueAtTime(0, audioContextRef.current.currentTime + 5);
                        nextTrack(true, true);
                    }
                }
            }
            reqAnimFrameRef.current = requestAnimationFrame(update);
        };
        reqAnimFrameRef.current = requestAnimationFrame(update);
    };

    const playTrackCore = useCallback(async (track, isCrossfadeTransition = false) => {
        if (!track) return;

        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().catch(() => { });
        }
        if (!audioContextRef.current) initAudioEngine();

        setIsLoading(true);
        setPlaybackError(null);
        hasLoggedPlayRef.current = false;

        // Switch tags if crossfading
        if (isCrossfadeTransition) {
            activeTagIdx.current = activeTagIdx.current === 0 ? 1 : 0;
        } else {
            // Reset if literal click
            activeTagIdx.current = 0;
            isCrossfading.current = false;
            if (gainNodeRef.current) gainNodeRef.current.gain.value = 1;
            if (gainNodeRef2.current) gainNodeRef2.current.gain.value = 0;
        }

        const audio = activeTagIdx.current === 0 ? audioTagRef.current : audioTagRef2.current;
        const otherAudio = activeTagIdx.current === 0 ? audioTagRef2.current : audioTagRef.current;
        const gain = activeTagIdx.current === 0 ? gainNodeRef.current : gainNodeRef2.current;
        const otherGain = activeTagIdx.current === 0 ? gainNodeRef2.current : gainNodeRef.current;

        if (!audio) return;

        // Stop and clear the other tag to prevent overlap
        if (otherAudio) {
            otherAudio.pause();
            if (!isCrossfadeTransition) {
                otherAudio.src = '';
                if (otherGain) otherGain.gain.value = 0;
            }
        }

        const filePath = track.filePath || track.path || track.id;
        const streamUrl = 'http://127.0.0.1:5888/api/file?path=' + encodeURIComponent(filePath);

        audio.src = streamUrl;
        audio.crossOrigin = 'anonymous';

        if (isCrossfadeTransition && gain) {
            gain.gain.value = 0;
            gain.gain.linearRampToValueAtTime(1, audioContextRef.current.currentTime + 5);
        }

        // Auto-advance when track ends - but only if we ARE currently the active tag
        audio.onended = () => {
            if (activeTagIdx.current === (audio === audioTagRef.current ? 0 : 1)) {
                console.log("[AudioEngine] Track ended, auto-advancing...");
                nextTrack(true);
            } else {
                console.log("[AudioEngine] Secondary tag ended, ignoring signal.");
            }
        };

        audio.onloadedmetadata = () => {
            if (audio.duration && !isNaN(audio.duration)) {
                setDuration(audio.duration);
                durationRef.current = audio.duration;
            }
        };

        audio.play().then(() => {
            setIsPlaying(true);
            setIsLoading(false);
            setActiveTrack(track);
            if (!isCrossfadeTransition) {
                startProgressLoop();
            } else {
                // Already in loop
                setTimeout(() => { isCrossfading.current = false; }, 6000);
            }
        }).catch(e => {
            if (e.name !== 'AbortError') setPlaybackError("Error al iniciar reproducción.");
            setIsLoading(false);
        });
    }, [nextTrack]);


    // Main Play Effect â€” minimal, only syncs UI state, does NOT trigger audio
    useEffect(() => {
        // Nothing to do here - playback is triggered directly in selectTrack/nextTrack/prevTrack
    }, [currentTrackIndex]);


    // ── Vibrancy UI: extracción de color con transición suave ─────────
    useEffect(() => {
        const root = document.documentElement;

        const applyColor = (r, g, b) => {
            // Luminancia relativa — evita fondos demasiado claros
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            const factor = lum > 180 ? 0.55 : 1;          // atenuar si es muy claro
            const rr = Math.round(r * factor);
            const gg = Math.round(g * factor);
            const bb = Math.round(b * factor);

            root.style.setProperty('--color-vibrant', `rgb(${rr},${gg},${bb})`);
            if (!themeSettings.backgroundColor) {
                root.style.setProperty('--color-vibrant-dark', `rgba(${rr},${gg},${bb},0.18)`);
            }
        };

        const reset = () => {
            root.style.setProperty('--color-vibrant', '#5865F2');
            if (!themeSettings.backgroundColor)
                root.style.setProperty('--color-vibrant-dark', 'rgba(88,101,242,0.15)');
        };

        if (!activeTrack?.coverUrl) { reset(); return; }

        let coverSrc = activeTrack.coverUrl;

        // Normalizar URL para que funcione con crossOrigin
        if (coverSrc.startsWith('gradient:')) { reset(); return; }
        if (coverSrc.startsWith('/')) coverSrc = `http://127.0.0.1:5888${coverSrc}`;
        if (coverSrc.startsWith('file:///')) coverSrc = `http://127.0.0.1:5888/api/cover?path=${encodeURIComponent(coverSrc.replace('file:///', ''))}`;

        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            try {
                const ct = new ColorThief();
                const color = ct.getColor(img);
                if (color) applyColor(color[0], color[1], color[2]);
            } catch (e) { reset(); }
        };

        img.onerror = () => {
            // Fallback: color determinista basado en el título
            const h = [...(activeTrack.title || '')].reduce((acc, c) => acc + c.charCodeAt(0), 0);
            applyColor((h * 37) % 200 + 55, (h * 73) % 180 + 40, (h * 113) % 220 + 35);
        };

        // Añadir cache-buster solo si es URL de servidor local
        img.src = coverSrc.includes('127.0.0.1') && !coverSrc.includes('?')
            ? `${coverSrc}?s=200`
            : coverSrc;

    }, [activeTrack?.coverUrl, themeSettings.backgroundColor]);

    // Reset lyrics state when track changes
    useEffect(() => {
        if (activeTrack) {
            setLyricsData(null);
            setLyricsLoading(false);
            setLyricsError(null);
        }
    }, [activeTrack?.id]);

    useEffect(() => {
        if (view === 'lyrics' && activeTrack && !lyricsData && !lyricsLoading && !lyricsError) {
            loadLyrics(activeTrack.artist, activeTrack.title, activeTrack.album, activeTrack.duration);
        }
    }, [view, activeTrack, lyricsData, lyricsLoading, lyricsError]);

    // Periodic version check
    const [newVersionAvailable, setNewVersionAvailable] = React.useState(false);
    const CURRENT_VERSION = "1.2.0"; // Local-First Engine

    React.useEffect(() => {
        const checkVersion = async () => {
            try {
                const res = { ok: true, json: () => Promise.resolve({ version: '2.0.0-native' }) };
                const data = { status: 'offline' };
                if (data.version && data.version !== CURRENT_VERSION) {
                    setNewVersionAvailable(true);
                }
            } catch (e) {
                // Ignore errors in version check
            }
        };
        checkVersion();
        const timer = setInterval(checkVersion, 300000); // Check every 5 mins
        return () => clearInterval(timer);
    }, []);

    // Lyrics React Sync Removed - Now fully handled in 60fps requestAnimationFrame loop

    const handleSeek = (e) => {
        const time = Number(e.target.value);
        if (audioTagRef.current) {
            audioTagRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };


    const toggleMute = () => {
        if (isMuted) {
            const targetVol = prevVolume > 0 ? prevVolume : 0.5;
            setVolume(targetVol);
            setIsMuted(false);
            if (audioTagRef.current) audioTagRef.current.volume = targetVol;
            if (gainNodeRef.current && audioContextRef.current) {
                gainNodeRef.current.gain.linearRampToValueAtTime(targetVol, audioContextRef.current.currentTime + 0.1);
            }
        } else {
            setPrevVolume(volume);
            setVolume(0);
            setIsMuted(true);
            if (audioTagRef.current) audioTagRef.current.volume = 0;
            if (gainNodeRef.current && audioContextRef.current) {
                gainNodeRef.current.gain.linearRampToValueAtTime(0, audioContextRef.current.currentTime + 0.1);
            }
        }
    };

    const handleDragStart = (e, index) => {
        setDraggedIdx(index);
        e.dataTransfer.effectAllowed = 'move';
        setPlaybackQueue(prev => prev); // force render if needed, not usually required for D&D logic but helps React sometimes
    };

    const handleDragEnd = (e) => {
        setDraggedIdx(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // necessary to allow drop
    };

    const handleDrop = (e, index) => {
        e.preventDefault();
        if (draggedIdx === null || draggedIdx === index) return;

        const newQueue = [...playbackQueue];
        const track = newQueue.splice(draggedIdx, 1)[0];
        newQueue.splice(index, 0, track);

        setPlaybackQueue(newQueue);
        if (currentTrackIndex === draggedIdx) {
            setCurrentTrackIndex(index);
        } else if (draggedIdx < currentTrackIndex && index >= currentTrackIndex) {
            setCurrentTrackIndex(currentTrackIndex - 1);
        } else if (draggedIdx > currentTrackIndex && index <= currentTrackIndex) {
            setCurrentTrackIndex(currentTrackIndex + 1);
        }
        setDraggedIdx(null);
    };

    // Extra Playback Controls (10s skip)
    const seekForward10 = useCallback(() => {
        const audio = audioTagRef.current;
        if (audio) {
            const newTime = Math.min(audio.currentTime + 10, audio.duration || 100);
            audio.currentTime = newTime;
            setCurrentTime(newTime);
        }
    }, []);

    const seekBackward10 = useCallback(() => {
        const audio = audioTagRef.current;
        if (audio) {
            const newTime = Math.max(audio.currentTime - 10, 0);
            audio.currentTime = newTime;
            setCurrentTime(newTime);
        }
    }, []);

    // PIP State
    const videoPipRef = useRef(null);
    const pipCanvasRef = useRef(null);

    const updatePipCanvas = useCallback(() => {
        if (!activeTrack || !pipCanvasRef.current) return;
        const canvas = pipCanvasRef.current;
        const ctx = canvas.getContext('2d');

        let src = activeTrack.coverUrl || '';
        if (src.startsWith('file:///')) src = `http://127.0.0.1:5888/api/cover?path=${encodeURIComponent(src.replace('file:///', ''))}`;
        if (src.startsWith('/')) src = `http://127.0.0.1:5888${src}`;

        if (!src || src.startsWith('gradient:')) {
            ctx.fillStyle = '#1e1f22';
            ctx.fillRect(0, 0, 512, 512);
            ctx.fillStyle = '#5865F2';
            ctx.beginPath();
            ctx.arc(256, 200, 80, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(activeTrack.title, 256, 340);
            ctx.font = '24px Arial';
            ctx.fillStyle = '#a1a3a6';
            ctx.fillText(activeTrack.artist, 256, 380);
        } else {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.src = src;
            img.onload = () => ctx.drawImage(img, 0, 0, 512, 512);
            img.onerror = () => { ctx.fillStyle = '#1e1f22'; ctx.fillRect(0, 0, 512, 512); }
        }
    }, [activeTrack]);

    useEffect(() => {
        if (document.pictureInPictureElement) {
            updatePipCanvas();
        }
    }, [activeTrack, updatePipCanvas]);

    const initPiP = async () => {
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture().catch(() => { });
            return;
        }
        if (!activeTrack) {
            addToast("Reproduce una canci\u00f3n para usar el mini-reproductor.", "info");
            return;
        }

        if (!pipCanvasRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            pipCanvasRef.current = canvas;
        }

        updatePipCanvas();

        if (!videoPipRef.current) {
            const video = document.createElement('video');
            video.muted = true;
            video.playsInline = true;
            // Chromium requires active video stream to keep PiP alive
            const stream = pipCanvasRef.current.captureStream(2);
            video.srcObject = stream;

            video.onloadedmetadata = () => video.play().catch(() => { });
            videoPipRef.current = video;
        }

        try {
            const v = videoPipRef.current;
            if (v.paused) await v.play().catch(() => { });

            if (typeof v.requestPictureInPicture === 'function') {
                await v.requestPictureInPicture();
            } else {
                addToast("Tu plataforma actual (WebKit) no soporta la API nativa de Picture in Picture.", "warning");
            }
        } catch (e) {
            console.error('PiP Failed:', e);
            addToast("Error al iniciar Mini-Reproductor.", "error");
        }
    };

    // Media Session API (Spotify behavior)
    useEffect(() => {
        if ('mediaSession' in navigator && activeTrack) {
            let safeCover = 'favicon.ico';
            if (activeTrack.coverUrl) {
                if (activeTrack.coverUrl.startsWith('gradient:')) {
                    safeCover = 'favicon.ico'; // Fallback for gradients
                } else if (activeTrack.coverUrl.startsWith('/')) {
                    safeCover = `http://127.0.0.1:5888${activeTrack.coverUrl}`;
                } else if (activeTrack.coverUrl.startsWith('file:///')) {
                    // Real HTTP URL for Windows Media Transport Controls
                    safeCover = `http://127.0.0.1:5888/api/cover?path=${encodeURIComponent(activeTrack.coverUrl.replace('file:///', ''))}`;
                } else {
                    safeCover = activeTrack.coverUrl;
                }
            }

            navigator.mediaSession.metadata = new MediaMetadata({
                title: activeTrack.title,
                artist: activeTrack.artist,
                album: activeTrack.album || 'ChakrasPlayer',
                artwork: [
                    { src: safeCover, sizes: '512x512', type: 'image/jpeg' },
                    { src: safeCover, sizes: '1024x1024', type: 'image/jpeg' }
                ]
            });

            navigator.mediaSession.setActionHandler('play', () => togglePlay());
            navigator.mediaSession.setActionHandler('pause', () => togglePlay());
            navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
            navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
            navigator.mediaSession.setActionHandler('seekbackward', () => seekBackward10());
            navigator.mediaSession.setActionHandler('seekforward', () => seekForward10());
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (audioTagRef.current) {
                    audioTagRef.current.currentTime = details.seekTime;
                    setCurrentTime(details.seekTime);
                }
            });
        }
    }, [activeTrack, isPlaying, seekForward10, seekBackward10]);

    useEffect(() => {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        }
    }, [isPlaying]);

    const displayList = useMemo(() => {
        if (view === 'queue') return playbackQueue;
        if (!librarySearchQuery.trim()) return library;
        const q = librarySearchQuery.toLowerCase();
        return library.filter(t =>
            (t.title && t.title.toLowerCase().includes(q)) ||
            (t.artist && t.artist.toLowerCase().includes(q))
        );
    }, [view, playbackQueue, library, librarySearchQuery]);

    // Virtual Scroll Setup
    const containerHeight = Math.max(window.innerHeight - 340, 300);
    const OVERSCAN = 5;
    const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT) + OVERSCAN * 2;

    const startIdx = useMemo(() =>
        Math.max(0, Math.floor(vsScrollTop / ROW_HEIGHT) - OVERSCAN)
        , [vsScrollTop, ROW_HEIGHT]);

    const visibleItems = useMemo(() =>
        displayList.slice(startIdx, Math.min(startIdx + visibleCount, displayList.length))
        , [displayList, startIdx, visibleCount]);

    // Render Modules
    return (
        <>
            <div id="app-root" className="flex flex-col h-screen w-full text-discord-text overflow-hidden relative">
                {/* Dynamic Background */}
                <div id="dynamic-bg"></div>

                {/* Main Container */}
                <div
                    className="flex flex-1 w-full overflow-hidden relative z-10"
                >
                    {/* Sidebar Component */}
                    <div style={{ width: isSidebarCompact ? '72px' : `${sidebarWidth}px`, minWidth: isSidebarCompact ? '72px' : '160px', transition: isResizing ? 'none' : 'width 0.3s ease' }} className="flex-shrink-0 flex flex-col h-full bg-black/20">
                        <Sidebar
                            view={view}
                            setView={setView}
                            scanDirectory={scanDirectory}
                            isScanning={isScanning}
                            ytDownloadProgress={ytDownloadProgress}
                            batchDownloadQueue={batchDownloadQueue}
                            seenDownloadsCount={seenDownloadsCount}
                            isCompact={isSidebarCompact}
                            toggleCompact={() => setIsSidebarCompact(!isSidebarCompact)}
                        />
                    </div>

                    {/* Resizer Handle */}
                    {!isSidebarCompact && (
                        <div
                            className="w-1 cursor-col-resize hover:bg-discord-blurple/50 transition-colors z-40 active:bg-discord-blurple"
                            onMouseDown={startResizing}
                        />
                    )}


                    <audio ref={audioTagRef} id="engine-audio-tag" style={{ display: 'none' }}></audio>
                    <audio ref={audioTagRef2} id="engine-audio-tag-2" style={{ display: 'none' }}></audio>

                    {/* Main Content */}
                    <main className="flex-1 flex flex-col glass-panel relative h-full mx-1 rounded-t-xl overflow-hidden min-w-0">
                        {/* Background Visualizer Layer Removed for performance */}
                        <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
                            {/* Static Gradient instead of moving bars */}
                            <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 to-transparent"></div>
                        </div>


                        {/* Sticky Header */}
                        <header className="sticky top-0 z-30 flex justify-between items-center px-8 py-5 glass-panel border-b border-white/5">
                            <h2 className="text-2xl font-bold tracking-tight capitalize">
                                {{ 'songs': 'My Local Library', 'queue': 'Playback Queue', 'lyrics': 'Now Playing Lyrics', 'albums': 'Albums', 'artists': 'Artists', 'playlists': 'Smart Playlists', 'searchYt': 'Discover Music', 'downloads': 'Download Queue', 'batch-import': 'Importador por Lotes', 'analytics': 'Analytics', 'ai-assistant': 'Chakras IA', 'settings': 'Settings' }[view] || view}
                            </h2>
                            <div className="flex items-center gap-3">
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${isServerConnected ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse'}`}>
                                    <div className={`w-2 h-2 rounded-full ${isServerConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,44,44,0.6)] animate-ping'}`}></div>
                                    {isServerConnected ? 'Backend: Native Engine' : 'Backend: Disconnected'}
                                </div>
                                {playbackError && (
                                    <div
                                        title={playbackError}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-500 border border-orange-500/20 animate-pulse cursor-help"
                                        onClick={() => alert(`Error de Reproducción Detallado:\n\n${playbackError}\n\nSugerencia: Revisa que el archivo exista en la ruta indicada o intenta re-escanear la carpeta.`)}
                                    >
                                        <i className="fa-solid fa-triangle-exclamation"></i>
                                        Error de Audio
                                    </div>
                                )}
                            </div>
                        </header>

                        <div className="flex-1 h-full overflow-hidden relative">
                            {permissionNeeded && (
                                <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-lg p-6 flex flex-col items-center justify-center mb-8 shadow-sm">
                                    <i className="fa-solid fa-lock text-3xl mb-3"></i>
                                    <h3 className="font-bold text-lg mb-1">Library Access Needed</h3>
                                    <p className="text-sm mb-4 text-center">For security, browsers require you to grant permission to your local folder on every fresh restart.</p>
                                    <button onClick={restoreLibraryAccess} className="bg-discord-blurple hover:bg-[#4752C4] disabled:opacity-50 text-white font-bold py-2 px-6 rounded transition-colors">
                                        Restore Access
                                    </button>
                                </div>
                            )}



                            {isScanning && (
                                <div className="flex flex-col items-center justify-center py-24 text-discord-muted animate-in fade-in duration-500">
                                    <div className="relative mb-6">
                                        <div className="w-20 h-20 border-4 border-discord-blurple/10 border-t-discord-blurple rounded-full animate-spin"></div>
                                        <i className="fa-solid fa-magnifying-glass absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl text-discord-blurple animate-pulse"></i>
                                    </div>
                                    <h3 className="text-xl font-bold text-discord-text mb-2">Scanning Library</h3>
                                    <p className="max-w-xs text-center text-sm leading-relaxed">
                                        Please wait while we index your local music files and extract metadata.
                                    </p>
                                    <div className="mt-8 px-4 py-2 bg-discord-secondary/50 rounded-lg border border-white/5 flex items-center gap-3">
                                        <i className="fa-solid fa-folder-tree text-discord-blurple"></i>
                                        <span className="text-xs font-mono truncate max-w-[200px]">{savedFolderPath || 'Selecting folder...'}</span>
                                    </div>
                                </div>
                            )}


                            <div key={view} className={`view-transition-wrap flex-1 overflow-x-hidden relative h-full custom-scrollbar ${['songs', 'queue', 'ai-assistant', 'lyrics', 'analytics', 'downloads'].includes(view) ? 'overflow-hidden p-0' : 'overflow-y-auto p-8'}`}>
                                {(view === 'songs' || view === 'queue') && !permissionNeeded && !isScanning && (
                                    <LibraryView
                                        view={view}
                                        library={library}
                                        librarySearchQuery={librarySearchQuery}
                                        setLibrarySearchQuery={setLibrarySearchQuery}
                                        displayList={displayList}
                                        performInitialSync={performInitialSync}
                                        isServerConnected={isServerConnected}
                                        setVsScrollTop={setVsScrollTop}
                                        startIdx={startIdx}
                                        visibleItems={visibleItems}
                                        ROW_HEIGHT={ROW_HEIGHT}
                                        currentTrackIndex={currentTrackIndex}
                                        activeTrack={activeTrack}
                                        openContextMenu={openContextMenu}
                                        selectTrack={selectTrack}
                                        currentlyEnriching={currentlyEnriching}
                                        ytDownloadProgress={ytDownloadProgress}
                                        enrichmentQueue={enrichmentQueue}
                                        isPlaying={isPlaying}
                                        durationRef={durationRef}
                                        currentProgressRef={currentProgressRef}
                                        setLibrary={setLibrary}
                                        setPlaybackQueue={setPlaybackQueue}
                                    />
                                )}

                                {view === 'searchYt' && (
                                    <YtSearchView
                                        handleYtSearch={handleYtSearch}
                                        ytSearchQuery={ytSearchQuery}
                                        setYtSearchQuery={setYtSearchQuery}
                                        isYtSearching={isYtSearching}
                                        ytSearchResults={ytSearchResults}
                                        triggerYtDownload={triggerYtDownload}
                                        ytDownloadTarget={ytDownloadTarget}
                                        ytDownloadProgress={ytDownloadProgress}
                                    />
                                )}

                                {view === 'lyrics' && (
                                    <LyricsView
                                        isPlaying={isPlaying}
                                        lyricsLoading={lyricsLoading}
                                        lyricsError={lyricsError}
                                        lyricsData={lyricsData}
                                        lyricsContainerRef={lyricsContainerRef}
                                        handleSeek={handleSeek}
                                        activeTrack={activeTrack}
                                        handleOffsetChange={handleOffsetChange}
                                    />
                                )}

                                {view === 'albums' && (
                                    <AlbumsView
                                        library={library}
                                        setPlaybackQueue={setPlaybackQueue}
                                        setOriginalQueue={setOriginalQueue}
                                        setCurrentTrackIndex={setCurrentTrackIndex}
                                        setIsPlaying={setIsPlaying}
                                        setView={setView}
                                    />
                                )}

                                {view === 'artists' && (
                                    <ArtistsView
                                        library={library}
                                        setPlaybackQueue={setPlaybackQueue}
                                        setOriginalQueue={setOriginalQueue}
                                        setCurrentTrackIndex={setCurrentTrackIndex}
                                        setIsPlaying={setIsPlaying}
                                        setView={setView}
                                    />
                                )}



                                {view === 'ai-assistant' && (
                                    <AiChat
                                        localModel={localModel} setLocalModel={setLocalModel}
                                        library={library}
                                        aiMessages={aiMessages} setAiMessages={setAiMessages}
                                        showApiConfig={showApiConfig} setShowApiConfig={setShowApiConfig}
                                        aiProvider={aiProvider} setAiProvider={setAiProvider}
                                        availableModels={availableModels} setAvailableModels={setAvailableModels}
                                        openRouterKey={openRouterKey} setOpenRouterKey={setOpenRouterKey}
                                        openRouterModel={openRouterModel} setOpenRouterModel={setOpenRouterModel}
                                        customApiKey={customApiKey} setCustomApiKey={setCustomApiKey}
                                        chatEndRef={chatEndRef}
                                        isAiThinking={isAiThinking}
                                        handleAiSubmit={handleAiSubmit}
                                        aiInput={aiInput} setAiInput={setAiInput}
                                        playAiPlaylist={playAiPlaylist}
                                        setPlaybackQueue={setPlaybackQueue}
                                        setCurrentTrackIndex={setCurrentTrackIndex}
                                        playTrackCore={playTrackCore}
                                        addToast={addToast}
                                        cancelAiRequest={cancelAiRequest}
                                    />
                                )}

                                {view === 'analytics' && <AnalyticsDashboard library={library} />}

                                {view === 'playlists' && (
                                    <PlaylistsView
                                        selectedPlaylist={selectedPlaylist}
                                        setSelectedPlaylist={setSelectedPlaylist}
                                        library={library}
                                        setPlaybackQueue={setPlaybackQueue}
                                        setCurrentTrackIndex={setCurrentTrackIndex}
                                        playTrackCore={playTrackCore}
                                        activeTrack={activeTrack}
                                        userPlaylists={userPlaylists}
                                        setView={setView}
                                        handleAiSubmit={handleAiSubmit}
                                        dailyMixes={dailyMixes}
                                        setOriginalQueue={setOriginalQueue}
                                        addToast={addToast}
                                        loadPlaylists={loadPlaylists}
                                    />
                                )}
                                {view === 'downloads' && (
                                    <DownloadsView
                                        setView={setView}
                                        handleBatchUpload={handleBatchUpload}
                                        ytDownloadProgress={ytDownloadProgress}
                                        batchDownloadQueue={batchDownloadQueue}
                                        handleManualSaveTheme={handleManualSaveTheme}
                                    />
                                )}

                                {
                                    view === 'settings' && (
                                        <SettingsView
                                            settingsTab={settingsTab}
                                            setSettingsTab={setSettingsTab}
                                            remoteEnabled={remoteEnabled}
                                            setRemoteEnabled={setRemoteEnabled}
                                            globalTunnelUrl={globalTunnelUrl}
                                            isLanReachable={isLanReachable}
                                            localIp={localIp}
                                            serverPort={serverPort}
                                            addToast={addToast}
                                            themeSettings={themeSettings}
                                            setThemeSettings={setThemeSettings}
                                            handleManualSaveTheme={handleManualSaveTheme}
                                            performanceMode={performanceMode}
                                            togglePerformanceMode={togglePerformanceMode}
                                            isEqEnabled={isEqEnabled}
                                            toggleEq={toggleEq}
                                            eqPreset={eqPreset}
                                            applyEqPreset={applyEqPreset}
                                            eqBands={eqBands}
                                            handleEqChange={handleEqChange}
                                            handleDeviceSelect={handleDeviceSelect}
                                            audioDeviceId={audioDeviceId}
                                            clearLibrary={clearLibrary}
                                            setLibrary={setLibrary}
                                            crossfade={crossfade}
                                            setCrossfade={setCrossfade}
                                            isAutoplay={isAutoplay}
                                            setIsAutoplay={setIsAutoplay}
                                            isNormalize={isNormalize}
                                            setIsNormalize={setIsNormalize}
                                            isGapless={isGapless}
                                            setIsGapless={setIsGapless}
                                            library={library}
                                            userPlaylists={userPlaylists}
                                            aiProvider={aiProvider}
                                            localModel={localModel}
                                        />
                                    )}
                            </div>
                        </div>
                    </main>

                    {/* 3. New Sliding Handle System (Right) */}
                    <div
                        className={`fixed right-0 top-0 h-full z-50 flex transition-transform duration-500 ease-out ${isRightPanelOpen ? 'translate-x-0' : 'translate-x-[380px]'}`}
                    >
                        {/* The Handle (Permanent buttons on the edge) */}
                        <div className="w-14 h-full flex flex-col items-center justify-center gap-4 relative">
                            {/* Visual connection to the panel */}
                            <div className="absolute right-0 top-0 w-px h-full bg-white/5"></div>

                            {/* Queue Toggle Button */}
                            <button
                                onClick={() => {
                                    if (sidebarActiveTab === 'queue' && isRightPanelOpen) setIsRightPanelOpen(false);
                                    else { setIsRightPanelOpen(true); setSidebarActiveTab('queue'); }
                                }}
                                className={`w-12 h-12 rounded-l-xl flex items-center justify-center transition-all shadow-2xl border-y border-l ${isRightPanelOpen && sidebarActiveTab === 'queue' ? 'bg-discord-blurple border-indigo-400/30 text-white' : 'bg-[#15171c]/90 border-white/5 text-white/40 hover:text-white'}`}
                                title="Playback Queue"
                            >
                                <i className="fa-solid fa-list-ul"></i>
                            </button>

                            {/* Hardware & Systems Toggle Button */}
                            <button
                                onClick={() => {
                                    if (sidebarActiveTab === 'stats' && isRightPanelOpen) setIsRightPanelOpen(false);
                                    else { setIsRightPanelOpen(true); setSidebarActiveTab('stats'); }
                                }}
                                className={`w-12 h-12 rounded-l-xl flex items-center justify-center transition-all shadow-2xl border-y border-l ${isRightPanelOpen && sidebarActiveTab === 'stats' ? 'bg-purple-600 border-pink-400/30 text-white' : 'bg-[#15171c]/90 border-white/5 text-white/40 hover:text-white'}`}
                                title="Intelligence & Systems"
                            >
                                <i className="fa-solid fa-bolt-lightning text-sm"></i>
                            </button>
                        </div>

                        {/* The Panel Content */}
                        <aside className="w-[380px] h-full bg-[#111214]/95 backdrop-blur-3xl border-l border-white/5 flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.5)]">
                            {/* Header */}
                            <div className="px-6 py-5 flex justify-between items-center bg-white/2 shrink-0 border-b border-white/5">
                                <h3 className="font-bold text-[10px] text-white/60 tracking-[0.3em] uppercase">
                                    {sidebarActiveTab === 'queue' ? 'Playback Queue' : 'Neural Systems'}
                                </h3>
                                <button
                                    onClick={() => setIsRightPanelOpen(false)}
                                    className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
                                >
                                    <i className="fa-solid fa-chevron-right text-[10px] opacity-40"></i>
                                </button>
                            </div>

                            {/* Content Area */}
                            <div className="flex-1 flex flex-col overflow-hidden relative">
                                {sidebarActiveTab === 'queue' ? (
                                    <div className="flex-1 flex flex-col overflow-hidden">
                                        <div className="px-6 py-4 flex justify-between items-center shrink-0">
                                            <span className="text-[11px] font-bold text-discord-blurple">{playbackQueue.length} Tracks in Queue</span>
                                            <button
                                                onClick={() => setPlaybackQueue([])}
                                                className="text-[9px] font-bold text-white/20 hover:text-red-400 transition-colors uppercase tracking-widest"
                                            >
                                                Clear All
                                            </button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto px-4 pb-6 custom-scrollbar scroll-smooth">
                                            {playbackQueue.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center h-full text-white/10 italic">
                                                    <i className="fa-solid fa-terminal mb-4 text-3xl opacity-20"></i>
                                                    <p className="text-xs">Queue offline</p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-1.5">
                                                    {playbackQueue.slice(Math.max(0, currentTrackIndex - 1), currentTrackIndex + 100).map((track, relativeIdx) => {
                                                        const idx = Math.max(0, currentTrackIndex - 1) + relativeIdx;
                                                        const isActive = idx === currentTrackIndex;
                                                        return (
                                                            <div
                                                                key={`q_${track.id}_${idx}`}
                                                                className={`group flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${isActive ? 'bg-discord-blurple/10 ring-1 ring-discord-blurple/20' : 'hover:bg-white/5'}`}
                                                                onClick={() => selectTrack(idx, false)}
                                                            >
                                                                <div className="w-10 h-10 rounded-lg shrink-0 overflow-hidden relative shadow-lg bg-black/40">
                                                                    {(track.coverUrl || track.ytThumbnail) ? (
                                                                        <img src={track.coverUrl?.startsWith('/') ? `http://127.0.0.1:5888${track.coverUrl}?s=80` : (track.coverUrl || track.ytThumbnail)} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center"><i className="fa-solid fa-music text-xs opacity-20"></i></div>
                                                                    )}
                                                                    {isActive && isPlaying && (
                                                                        <div className="absolute inset-0 bg-discord-blurple/60 backdrop-blur-[1px] flex items-center justify-center gap-0.5">
                                                                            <span className="w-0.5 h-3 bg-white animate-bounce-short"></span>
                                                                            <span className="w-0.5 h-4 bg-white animate-bounce-short" style={{ animationDelay: '0.1s' }}></span>
                                                                            <span className="w-0.5 h-2 bg-white animate-bounce-short" style={{ animationDelay: '0.2s' }}></span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className={`text-[11px] font-bold truncate ${isActive ? 'text-discord-blurple' : 'text-white/70'}`}>{track.title}</p>
                                                                    <p className="text-[9px] text-white/30 truncate uppercase tracking-tight">{track.artist}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col overflow-hidden">
                                        {/* AI Context Summary */}
                                        <div className="p-4 border-b border-white/5 bg-white/2">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Neural Core Active</span>
                                            </div>
                                            <div className="text-[10px] text-white/60 leading-relaxed bg-black/30 p-3 rounded-lg border border-white/5">
                                                "{aiMessages[aiMessages.length - 1]?.text.slice(0, 100)}..."
                                            </div>
                                        </div>
                                        {/* Quick Hardware Snapshot */}
                                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                            <HardwareMonitor stats={sysStats} />
                                        </div>
                                        {/* Quick Voice/Prompt Input */}
                                        <div className="p-4 border-t border-white/5 bg-black/40">
                                            <div className="relative group">
                                                <input
                                                    type="text"
                                                    placeholder="Ask anything..."
                                                    className="w-full bg-white/5 border border-white/10 rounded-full px-4 py-2 text-[10px] text-white focus:outline-none focus:border-purple-500/50 transition-all placeholder:text-white/20"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleAiSubmit(e, e.target.value);
                                                            e.target.value = '';
                                                            setSidebarActiveTab('stats');
                                                        }
                                                    }}
                                                />
                                                <i className="fa-solid fa-paper-plane absolute right-4 top-1/2 -translate-y-1/2 text-[9px] text-white/20 group-hover:text-purple-400 transition-colors"></i>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </aside>
                    </div>

                </div >

                {/* Bottom Player Bar Component */}
                <PlayerBar
                    activeTrack={activeTrack}
                    currentlyEnriching={currentlyEnriching}
                    playbackQueue={playbackQueue}
                    setPlaybackQueue={setPlaybackQueue}
                    library={library}
                    setLibrary={setLibrary}
                    isShuffle={isShuffle}
                    toggleShuffle={toggleShuffle}
                    isMixMode={isMixMode}
                    setIsMixMode={setIsMixMode}
                    prevTrack={prevTrack}
                    seekBackward10={seekBackward10}
                    isPlaying={isPlaying}
                    togglePlay={togglePlay}
                    seekForward10={seekForward10}
                    nextTrack={nextTrack}
                    repeatMode={repeatMode}
                    toggleRepeat={toggleRepeat}
                    uiCurrentTimeTextRef={uiCurrentTimeTextRef}
                    currentProgressRef={currentProgressRef}
                    uiProgressInputRef={uiProgressInputRef}
                    duration={duration}
                    handleSeek={handleSeek}
                    handleDeviceSelect={handleDeviceSelect}
                    audioDeviceId={audioDeviceId}
                    showDevicePicker={showDevicePicker}
                    setShowDevicePicker={setShowDevicePicker}
                    audioDevices={audioDevices}
                    selectDevice={selectDevice}
                    togglePopUpView={togglePopUpView}
                    view={view}
                    initPiP={initPiP}
                    isMuted={isMuted}
                    toggleMute={toggleMute}
                    volume={volume}
                    handleVolume={handleVolume}
                />


                {/* YouTube Metadata Prompt Modal Layer */}
                <YtPromptModal
                    ytPromptData={ytPromptData}
                    setYtPromptData={setYtPromptData}
                    confirmYtDownload={confirmYtDownload}
                />
                <TrackContextMenu
                    contextMenu={contextMenu}
                    closeContextMenu={closeContextMenu}
                    openMetaEditor={openMetaEditor}
                    openTrimmer={openTrimmer}
                    replaceFromYoutube={replaceFromYoutube}
                    deleteSong={deleteSong}
                />
                <EditMetaModal
                    editMetaModal={editMetaModal}
                    setEditMetaModal={setEditMetaModal}
                    editorMsg={editorMsg}
                    editorSaving={editorSaving}
                    saveMetadata={saveMetadata}
                />
                <TrimModal
                    trimModal={trimModal}
                    setTrimModal={setTrimModal}
                    trimPreviewPlaying={trimPreviewPlaying}
                    setTrimPreviewPlaying={setTrimPreviewPlaying}
                    trimRange={trimRange}
                    setTrimRange={setTrimRange}
                    editorMsg={editorMsg}
                    editorSaving={editorSaving}
                    trimAudio={trimAudio}
                />

                {/* Toast Notifications */}
                <div className="toast-container">
                    {toasts.map(t => (
                        <div key={t.id} className={`toast toast-${t.type}`}>
                            {t.type === 'success' && <i className="fa-solid fa-check-circle mr-2"></i>}
                            {t.type === 'error' && <i className="fa-solid fa-triangle-exclamation mr-2"></i>}
                            {t.type === 'info' && <i className="fa-solid fa-circle-info mr-2"></i>}
                            {t.message}
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

