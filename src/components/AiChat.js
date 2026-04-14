// src/components/AiChat.js
// ChakrasPlayer - AI Assistant Component
// Requiere globals: React

const AiChat = ({
    localModel, setLocalModel,
    library,
    aiMessages, setAiMessages,
    showApiConfig, setShowApiConfig,
    aiProvider, setAiProvider,
    availableModels, setAvailableModels,
    openRouterKey, setOpenRouterKey,
    openRouterModel, setOpenRouterModel,
    customApiKey, setCustomApiKey,
    chatEndRef,
    isAiThinking,
    handleAiSubmit,
    aiInput, setAiInput,
    playAiPlaylist,
    setPlaybackQueue,
    setCurrentTrackIndex,
    playTrackCore,
    addToast,
    cancelAiRequest,
    isSidebarVersion = false
}) => {
    // Stats are now passed from App.js if available, otherwise fetch locally
    const [localStats, setLocalStats] = React.useState(null);
    const [attachedImage, setAttachedImage] = React.useState(null);
    const fileInputRef = React.useRef(null);

    React.useEffect(() => {
        if (!isSidebarVersion) {
            const fetchStats = async () => {
                try {
                    const res = await fetch('http://127.0.0.1:5888/api/system-monitor');
                    if (res.ok) setLocalStats(await res.json());
                } catch (e) {}
            };
            fetchStats();
            const interval = setInterval(fetchStats, 5000);
            return () => clearInterval(interval);
        }
    }, [isSidebarVersion]);

    const stats = isSidebarVersion ? null : (localStats);

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAttachedImage(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    if (isSidebarVersion) {
        return (
            <div className="flex flex-col h-full w-full overflow-hidden bg-black/10">
                {/* Compact Messages */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
                    {aiMessages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom duration-300`}>
                            <div className={`flex flex-col gap-1 max-w-[85%]`}>
                                <div className={`px-3 py-2 rounded-xl text-[11px] leading-relaxed border ${msg.role === 'user' ? 'bg-purple-600/50 border-white/10 text-white ml-auto' : 'bg-white/5 border-white/5 text-discord-text'}`}>
                                    {msg.image && <img src={msg.image} className="mb-2 rounded w-full h-auto max-h-32 object-cover" />}
                                    {msg.text}
                                </div>
                                {msg.playlist && (
                                    <button onClick={() => playAiPlaylist(msg.playlist)} className="mt-1 px-3 py-1.5 accent-gradient hover:opacity-90 rounded-lg text-[10px] font-bold text-white flex items-center justify-center gap-2 transition-all">
                                        <i className="fa-solid fa-play text-[9px]"></i> Usar Playlist ({msg.playlist.length})
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={chatEndRef}></div>
                </div>

                {/* Compact Input */}
                <div className="p-3 bg-white/5 border-t border-white/5">
                    {attachedImage && (
                        <div className="relative mb-2 inline-block">
                            <img src={attachedImage} className="h-10 w-10 object-cover rounded border border-white/20" />
                            <button onClick={() => setAttachedImage(null)} className="absolute -top-1 -right-1 bg-red-500 rounded-full w-4 h-4 text-[8px] flex items-center justify-center"><i className="fa-solid fa-x"></i></button>
                        </div>
                    )}
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        if (!aiInput.trim() && !attachedImage) return;
                        handleAiSubmit(e, null, attachedImage);
                        setAttachedImage(null);
                    }} className="flex items-center gap-2">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-discord-muted hover:text-white transition-colors p-1"><i className="fa-solid fa-paperclip text-sm"></i></button>
                        <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />
                        <input
                            value={aiInput}
                            onChange={(e) => setAiInput(e.target.value)}
                            className="flex-1 bg-black/40 border border-white/5 rounded-full px-4 py-2 text-[11px] outline-none focus:border-purple-500/50 transition-all font-medium text-white/90"
                            placeholder="Pregunta o adjunta..."
                        />
                        <button type="submit" disabled={isAiThinking} className="w-8 h-8 rounded-full accent-gradient flex items-center justify-center text-white shadow-lg disabled:opacity-50 transition-transform active:scale-95">
                            <i className={`fa-solid ${isAiThinking ? 'fa-spinner fa-spin' : 'fa-paper-plane'} text-[10px]`}></i>
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full p-8 animate-in fade-in duration-500">
            <div className="flex flex-col flex-1 rounded-2xl overflow-hidden glass-panel border border-white/10 shadow-2xl relative">
            <div className="accent-glass backdrop-blur-md p-4 flex items-center justify-between border-b border-white/10 z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full accent-gradient flex items-center justify-center text-white shadow-lg">
                        <i className="fa-solid fa-brain"></i>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white tracking-tight">ChakrasPlayer IA</h2>
                        <p className="text-xs flex items-center gap-1.5 flex-wrap" style={{ color: 'var(--color-primary)' }}>
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse"></span>
                            {aiProvider === 'gemini' ? 'Gemini 2.5 Flash' : 
                             aiProvider === 'openrouter' ? (openRouterModel || 'OpenRouter Pro') : 
                             (localModel || 'AI Engine')} · {library.length} canciones
                            {stats && (
                                <span className="ml-2 px-1.5 py-0.5 rounded bg-black/30 border border-white/10 text-[9px] font-mono tracking-wider" style={{ color: 'var(--color-primary)' }}>
                                    <i className={`fa-solid ${aiProvider === 'ollama' ? (stats.gpu_active ? 'fa-microchip' : 'fa-server') : 'fa-cloud'}`} style={{ opacity: 0.8 }}></i> 
                                    {' '}{aiProvider === 'ollama' ? (stats.gpu_active ? 'GPU' : 'CPU') : 'Cloud'} {aiProvider === 'ollama' ? (stats.gpu_active ? stats.gpu_percent : stats.cpu_percent) + '%' : 'Active'}
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setAiMessages([{ role: 'ai', text: '¡Hola! Soy tu asistente de música. ¿Qué quieres escuchar hoy? Puedo crear playlists, controlar la reproducción, y ayudarte a descubrir tu biblioteca. 🎵', playlist: null }])}
                        className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition-all"
                        title="Limpiar chat"
                    >
                        <i className="fa-solid fa-broom text-sm"></i>
                    </button>
                    <button
                        onClick={() => setShowApiConfig(!showApiConfig)}
                        className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center text-white/70 transition-colors"
                        title="Configurar IA"
                    >
                        <i className={`fa-solid ${showApiConfig ? 'fa-xmark' : 'fa-gear'}`}></i>
                    </button>
                </div>
            </div>

            {showApiConfig && (
                <div className="bg-discord-secondary/95 backdrop-blur-md p-6 border-b border-white/10 animate-in slide-in-from-top duration-300">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-discord-muted uppercase mb-2">Proveedor de IA</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setAiProvider('ollama'); localStorage.setItem('chakras_ai_provider', 'ollama'); }}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${aiProvider === 'ollama' ? 'bg-discord-blurple border-discord-blurple text-white shadow-lg' : 'bg-discord-secondary border-white/5 text-discord-muted hover:bg-discord-tertiary'}`}
                                >
                                    <i className="fa-solid fa-microchip mr-1.5 opacity-60"></i> Local
                                </button>
                                <button
                                    onClick={() => { setAiProvider('gemini'); localStorage.setItem('chakras_ai_provider', 'gemini'); }}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${aiProvider === 'gemini' ? 'bg-green-600 border-green-600 text-white shadow-lg' : 'bg-discord-secondary border-white/5 text-discord-muted hover:bg-discord-tertiary'}`}
                                >
                                    <i className="fa-solid fa-cloud-sun mr-1.5 opacity-60"></i> Nube (Gratis)
                                </button>
                                <button
                                    onClick={() => { setAiProvider('openrouter'); localStorage.setItem('chakras_ai_provider', 'openrouter'); }}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${aiProvider === 'openrouter' ? 'bg-purple-600 border-purple-600 text-white shadow-lg' : 'bg-discord-secondary border-white/5 text-discord-muted hover:bg-discord-tertiary'}`}
                                >
                                    <i className="fa-solid fa-bolt mr-1.5 opacity-60"></i> Avanzado / Pro
                                </button>
                            </div>
                        </div>
                        <div>
                            {aiProvider === 'ollama' ? (
                                <div className="animate-in fade-in slide-in-from-right duration-300">
                                    <label className="block text-[10px] font-bold text-discord-muted uppercase mb-2">Modelo Local (Ollama)</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={localModel}
                                            onChange={(e) => { setLocalModel(e.target.value); localStorage.setItem('chakras_local_model', e.target.value); }}
                                            className="flex-1 bg-discord-tertiary border border-white/5 rounded-lg px-3 py-2 text-sm outline-none focus:border-discord-blurple/50 text-discord-text"
                                        >
                                            {availableModels && availableModels.length > 0 ? (
                                                availableModels.map(name => (
                                                    <option key={name} value={name}>{name}</option>
                                                ))
                                            ) : (
                                                <option value={localModel}>{localModel} (Actual)</option>
                                            )}
                                        </select>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const res = await fetch('http://127.0.0.1:5888/api/ollama/models');
                                                    const data = await res.json();
                                                    if (data.models) setAvailableModels(data.models);
                                                    addToast("Modelos actualizados", "success");
                                                } catch (e) { addToast("Error al refrescar", "error"); }
                                            }}
                                            className="p-2 bg-discord-bg hover:bg-discord-hover rounded-lg border border-white/5"
                                            title="Refrescar Lista"
                                        >
                                            <i className="fa-solid fa-rotate-right text-xs"></i>
                                        </button>
                                    </div>
                                </div>
                            ) : aiProvider === 'openrouter' ? (
                                <div className="animate-in fade-in slide-in-from-right duration-300 flex flex-col gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-discord-muted uppercase mb-1">OpenRouter Key (Paga o Gratis)</label>
                                        <div className="relative">
                                            <input
                                                type="password"
                                                value={openRouterKey}
                                                onChange={(e) => { setOpenRouterKey(e.target.value); localStorage.setItem('chakras_openrouter_key', e.target.value); }}
                                                className="w-full bg-discord-tertiary border border-white/5 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-discord-blurple/50 pr-8"
                                                placeholder="sk-or-v1-..."
                                            />
                                            <i className="fa-solid fa-key absolute right-2.5 top-2 text-discord-muted opacity-30 text-[10px]"></i>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-discord-muted uppercase mb-1">Modelo Seleccionado</label>
                                        <div className="flex flex-col gap-2">
                                            <select 
                                                className="w-full bg-discord-tertiary border border-white/5 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-discord-blurple/50"
                                                onChange={(e) => { setOpenRouterModel(e.target.value); localStorage.setItem('chakras_openrouter_model', e.target.value); }}
                                                value={["google/gemini-2.0-flash-lite-preview-02-05:free", "deepseek/deepseek-chat:free", "meta-llama/llama-3.3-70b-instruct:free", "google/gemini-2.0-flash-001"].includes(openRouterModel) ? openRouterModel : "custom"}
                                            >
                                                <optgroup label="Modelos Gratuitos (Populares)">
                                                    <option value="google/gemini-2.0-flash-lite-preview-02-05:free">Gemini 2.0 Flash Lite (GRATIS)</option>
                                                    <option value="meta-llama/llama-3.3-70b-instruct:free">Llama 3.3 70B (GRATIS)</option>
                                                    <option value="deepseek/deepseek-chat:free">DeepSeek V3 (GRATIS)</option>
                                                </optgroup>
                                                <optgroup label="Modelos de Pago / Pro">
                                                    <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash (Recomendado)</option>
                                                    <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
                                                    <option value="custom">-- Otro (Escribir abajo) --</option>
                                                </optgroup>
                                            </select>
                                            {(!["google/gemini-2.0-flash-lite-preview-02-05:free", "deepseek/deepseek-chat:free", "meta-llama/llama-3.3-70b-instruct:free", "google/gemini-2.0-flash-001", "openai/gpt-4o-mini"].includes(openRouterModel)) && (
                                                <input
                                                    type="text"
                                                    value={openRouterModel === 'custom' ? '' : openRouterModel}
                                                    onChange={(e) => { setOpenRouterModel(e.target.value); localStorage.setItem('chakras_openrouter_model', e.target.value); }}
                                                    className="w-full bg-discord-tertiary border border-white/5 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-discord-blurple/50"
                                                    placeholder="ej: x-ai/grok-beta"
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="animate-in fade-in slide-in-from-right duration-300">
                                    <label className="block text-[10px] font-bold text-discord-muted uppercase mb-2">Google Gemini Key (Soporta nivel Gratis)</label>
                                    <div className="relative">
                                        <input
                                            type="password"
                                            value={customApiKey}
                                            onChange={(e) => { setCustomApiKey(e.target.value); localStorage.setItem('chakras_gemini_key', e.target.value); }}
                                            className="w-full bg-discord-tertiary border border-white/5 rounded-lg px-3 py-2 text-sm outline-none focus:border-discord-blurple/50 pr-10"
                                            placeholder="AIzaSy..."
                                        />
                                        <i className="fa-solid fa-cloud-sun absolute right-3 top-2.5 text-discord-muted opacity-30"></i>
                                    </div>
                                    <p className="mt-2 text-[9px] text-green-400">Excelente para uso diario sin costo desde Google AI Studio.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 custom-scrollbar">
                {aiMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}>
                        {msg.role === 'ai' && (
                            <div className="w-8 h-8 rounded-full accent-gradient flex items-center justify-center text-white text-xs mr-3 flex-shrink-0 mt-1 shadow-lg">
                                <i className="fa-solid fa-brain"></i>
                            </div>
                        )}
                        <div className={`flex flex-col gap-2 max-w-[75%]`}>
                            <div className={`px-5 py-3.5 rounded-2xl border ${msg.role === 'user' ? 'user-bubble-gradient text-white rounded-br-sm border-white/10' : 'text-discord-text rounded-bl-sm border-white/10'}`} style={{ lineHeight: 1.65, fontSize: '0.9rem', ...(msg.role === 'ai' ? { background: 'rgba(18,18,32,0.40)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)' } : {}) }}>
                                {msg.image && (
                                    <div className="mb-2 w-full max-w-[200px] rounded-lg overflow-hidden border border-white/20">
                                        <img src={msg.image} className="w-full h-auto object-cover" alt="Attached preview" />
                                    </div>
                                )}
                                {msg.text}
                            </div>
                            {msg.playlist && msg.playlist.length > 0 && (
                                <div className="rounded-xl overflow-hidden border border-white/10" style={{ background: 'rgba(30,30,30,0.8)' }}>
                                    <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'var(--color-primary-soft)' }}>
                                        <div className="flex items-center gap-2">
                                            <i className="fa-solid fa-list-ol accent-text text-xs"></i>
                                            <span className="text-sm font-bold text-white/80">{msg.playlistName || 'Playlist'}</span>
                                            <span className="text-xs text-white/30">({msg.playlist.length} canciones)</span>
                                        </div>
                                        <button onClick={() => playAiPlaylist(msg.playlist)} className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105 accent-gradient" style={{ color: 'white' }}>
                                            <i className="fa-solid fa-play text-[10px]"></i> Reproducir
                                        </button>
                                    </div>
                                    <div className="px-3 py-2 flex flex-col gap-0.5" style={{ maxHeight: 200, overflowY: 'auto' }}>
                                        {msg.playlist.slice(0, 10).map((track, ti) => {
                                            const raw = track.coverUrl || track.ytThumbnail || track.uploaderThumbnail;
                                            const coverSrc = raw ? (raw.startsWith('/') ? `http://127.0.0.1:5888${raw}` : raw) : null;
                                            return (
                                                <div key={ti} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-white/5 cursor-pointer transition-colors" onClick={() => { setPlaybackQueue(msg.playlist); setCurrentTrackIndex(ti); playTrackCore(track); }}>
                                                    <span className="text-xs text-white/25 w-5 text-right">{ti + 1}</span>
                                                    {coverSrc ? (
                                                        <img src={coverSrc} className="w-8 h-8 rounded object-cover flex-shrink-0" style={{ background: '#282828' }} onError={e => e.target.style.display = 'none'} />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: '#282828' }}>
                                                            <i className="fa-solid fa-music text-white/20 text-[10px]"></i>
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-medium text-white/80 truncate">{track.title}</p>
                                                        <p className="text-[10px] text-white/30 truncate">{track.artist || 'Unknown'}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isAiThinking && (
                    <div className="flex justify-start animate-in fade-in duration-300">
                        <div className="w-8 h-8 rounded-full accent-gradient flex items-center justify-center text-white text-xs mr-3 flex-shrink-0 mt-1 shadow-lg">
                            <i className="fa-solid fa-brain animate-pulse"></i>
                        </div>
                        <div className="bg-discord-secondary/80 px-5 py-3 rounded-2xl rounded-bl-md text-discord-muted flex items-center gap-3 border border-white/5 shadow-lg">
                            <div className="flex gap-1">
                                <span className="w-2 h-2 rounded-full accent-gradient animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-2 h-2 rounded-full accent-gradient animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-2 h-2 rounded-full accent-gradient animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                            <span className="text-sm">Analizando...</span>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef}></div>
            </div>

            {/* Input Wrapper */}
            <div className="p-4 border-t border-white/5 bg-discord-secondary/50 flex flex-col gap-2">
                {attachedImage && (
                    <div className="flex items-center gap-2 animate-in slide-in-from-bottom duration-300">
                        <div className="relative">
                            <img src={attachedImage} className="h-12 w-12 object-cover rounded shadow-md border border-white/10" />
                            <button onClick={() => setAttachedImage(null)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] shadow-lg hover:scale-110 transition-transform">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </div>
                )}
                <form onSubmit={(e) => { e.preventDefault(); if (!aiInput.trim() && !attachedImage) return; handleAiSubmit(e, null, attachedImage); setAttachedImage(null); }} className="flex items-center gap-3">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full flex items-center justify-center text-discord-muted hover:text-white hover:bg-white/5 transition-colors"><i className="fa-solid fa-paperclip"></i></button>
                    <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <input value={aiInput} onChange={(e) => setAiInput(e.target.value)} className="flex-1 bg-discord-tertiary rounded-full px-5 py-3 outline-none focus:ring-1 focus:ring-purple-500/50 transition-all text-sm" placeholder="Responde o envía una imagen..." />
                    <button type="submit" disabled={isAiThinking} className="w-12 h-12 rounded-full flex items-center justify-center text-white transition-all transform active:scale-95 shadow-lg disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>
                        <i className={`fa-solid ${isAiThinking ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                    </button>
                </form>
            </div>
            </div>
        </div>
    );
};

window.AiChat = React.memo(AiChat);
