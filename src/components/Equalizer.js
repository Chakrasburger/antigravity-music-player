// src/components/Equalizer.js
// ChakrasPlayer - Equalizer Component
// Requiere globals: React

const { useState } = React;

const Equalizer = ({ isEqEnabled, toggleEq, eqPreset, applyEqPreset, eqBands, handleEqChange }) => {
    const [activeEqTooltip, setActiveEqTooltip] = useState(null);

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

    return (
        <div className="glass-panel border border-white/20 dark:border-white/10 rounded-xl w-full max-w-[880px] shadow-[0_12px_44px_rgba(0,0,0,0.3)] mx-auto overflow-hidden relative">
            {/* Mac OS Title Bar Simulation */}
            <div className="bg-white/10 dark:bg-black/20 backdrop-blur-md px-4 py-3 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                <div className="flex gap-2 z-10">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e] outline-none shadow-sm cursor-pointer"></div>
                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123] outline-none shadow-sm cursor-pointer"></div>
                    <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29] outline-none shadow-sm cursor-pointer"></div>
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 text-center">
                    <span className="text-[12px] font-extrabold text-discord-blurple tracking-[0.2em] uppercase select-none drop-shadow-sm">Equalizer</span>
                </div>
                <div className="w-[50px]"></div> {/* Spacer for symmetry */}
            </div>

            <div className="p-5 pb-12 relative">
                {/* EQ Controls Header */}
                <div className="flex justify-between items-center mb-6 relative z-10 px-2 lg:px-4">
                    <label className="flex items-center gap-2.5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 px-2 py-1 -ml-2 rounded transition-colors">
                        <input type="checkbox" checked={isEqEnabled} onChange={toggleEq} className="accent-discord-blurple w-4 h-4 rounded cursor-pointer shadow-sm" />
                        <span className="text-[13px] font-semibold text-black/80 dark:text-white/90 select-none">On</span>
                    </label>

                    <select
                        value={eqPreset}
                        onChange={(e) => applyEqPreset(e.target.value)}
                        className="bg-white/60 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded font-semibold text-[13px] px-3 py-1.5 text-black/80 dark:text-white/90 outline-none w-[140px] shadow-sm cursor-pointer appearance-none transition-colors hover:bg-white dark:hover:bg-black/60 focus:ring-2 focus:ring-discord-blurple/50"
                        style={{ backgroundImage: `url('data:image/svg+xml;utf8,<svg fill="currentColor" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/></svg>')`, backgroundRepeat: 'no-repeat', backgroundPositionX: '95%', backgroundPositionY: '50%' }}
                    >
                        {['Manual', 'Flat', 'Bass Boost', 'Electronic', 'Vocal', 'Dance', 'Acoustic'].map(p => (
                            <option key={p} value={p} className="text-black bg-white select-none">{p}</option>
                        ))}
                    </select>
                </div>

                <div className="relative w-full h-[360px] mx-auto mt-8 mb-16">
                    {/* dB Grid Lines (Background) */}
                    <div className="absolute inset-x-[30px] inset-y-0 flex flex-col justify-between pointer-events-none z-0">
                        <div className="w-full border-t border-black/10 dark:border-white/10 relative flex items-center justify-between">
                            <span className="absolute -left-10 text-[10px] text-discord-blurple font-bold tracking-widest select-none">+12</span>
                            <span className="absolute -right-10 text-[10px] text-discord-blurple font-bold tracking-widest select-none">+12</span>
                        </div>
                        <div className="w-full border-t border-black/10 dark:border-white/10 relative flex items-center justify-between">
                            <span className="absolute -left-8 text-[10px] text-black/60 dark:text-white/50 font-bold tracking-widest select-none bg-white/30 dark:bg-black/30 px-1 rounded backdrop-blur-sm">0</span>
                            <span className="absolute -right-8 text-[10px] text-black/60 dark:text-white/50 font-bold tracking-widest select-none bg-white/30 dark:bg-black/30 px-1 rounded backdrop-blur-sm">0</span>
                        </div>
                        <div className="w-full border-t border-black/10 dark:border-white/10 relative flex items-center justify-between">
                            <span className="absolute -left-10 text-[10px] text-discord-blurple font-bold tracking-widest select-none">-12</span>
                            <span className="absolute -right-10 text-[10px] text-discord-blurple font-bold tracking-widest select-none">-12</span>
                        </div>
                    </div>

                    {/* Bands Container */}
                    <div className={`absolute inset-x-[60px] inset-y-0 flex justify-between items-center z-10 ${!isEqEnabled ? 'opacity-[0.35] grayscale pointer-events-none' : ''} transition-all duration-300`}>
                        {eqBands.map((band, idx) => {
                            return (
                                <div key={idx} className="flex flex-col items-center w-8 relative group shrink-0 h-full justify-center">
                                    <span className="text-[10px] bg-discord-blurple text-white font-bold px-2 py-0.5 rounded shadow-lg opacity-0 group-hover:opacity-100 absolute top-[-24px] pointer-events-none transition-opacity select-none z-20 tooltip-bounce tracking-wider">{band.gain > 0 ? '+' : ''}{band.gain.toFixed(1)} dB</span>

                                    <div className="relative h-[360px] flex justify-center w-full">
                                        <input
                                            type="range"
                                            min="-12"
                                            max="12"
                                            step="0.1"
                                            value={band.gain}
                                            onChange={(e) => handleEqChange(idx, e.target.value)}
                                            className="eq-slider absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 appearance-none origin-center -rotate-90 cursor-pointer"
                                            style={{ width: '360px' }}
                                        />
                                    </div>

                                    <div className="flex flex-col items-center gap-[6px] absolute -bottom-[44px]">
                                        <span className="text-[10px] text-black/80 dark:text-white/80 font-extrabold leading-none select-none tracking-widest">{band.freq >= 1000 ? (band.freq / 1000) + 'K' : band.freq}</span>
                                        <button
                                            onClick={() => setActiveEqTooltip(activeEqTooltip === idx ? null : idx)}
                                            className={`w-[16px] h-[16px] rounded-full text-[9px] flex items-center justify-center font-bold border transition-colors ${activeEqTooltip === idx ? 'bg-discord-blurple text-white border-discord-blurple shadow-md' : 'bg-black/5 dark:bg-white/5 backdrop-blur-sm text-black/50 dark:text-white/50 border-black/20 dark:border-white/20 hover:text-black dark:hover:text-white hover:border-black/40 dark:hover:border-white/40'}`}
                                            title="¿Qué hace esta frecuencia?"
                                        >
                                            ?
                                        </button>
                                    </div>

                                    {/* Tooltip Popup */}
                                    {activeEqTooltip === idx && (
                                        <div className="absolute bottom-[66px] left-1/2 -translate-x-1/2 w-48 bg-black/80 dark:bg-white/90 backdrop-blur-xl border border-white/10 p-3 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 text-center text-white dark:text-black">
                                            <div className="font-extrabold text-discord-blurple dark:text-discord-blurple mb-1 border-b border-white/10 dark:border-black/10 pb-1.5 text-[12px] uppercase tracking-wider">{band.freq >= 1000 ? (band.freq / 1000) + ' kHz' : band.freq + ' Hz'}</div>
                                            <p className="leading-relaxed text-white/90 dark:text-black/80 text-[11px] font-medium mt-1.5">{eqDescriptions[band.freq]}</p>
                                            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-black/80 dark:border-t-white/90"></div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
