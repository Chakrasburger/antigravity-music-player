// src/components/Visualizer.js
// ChakrasPlayer - High Performance Audio Visualizer
// Props: analyserRef (React Ref to Web Audio AnalyserNode), isPlaying, color

const Visualizer = ({ analyserRef, isPlaying, color = '#5865f2', currentComment = "", performanceMode = false }) => {
    const canvasRef = React.useRef(null);
    const requestRef = React.useRef();
    const frameCount = React.useRef(0);

    const draw = React.useCallback(() => {
        if (!canvasRef.current || !analyserRef.current) return;

        // OPTIMIZATION: In performance mode, we skip frames (30fps instead of 60fps)
        if (performanceMode) {
            frameCount.current++;
            if (frameCount.current % 2 !== 0) {
                requestRef.current = requestAnimationFrame(draw);
                return;
            }
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { alpha: true }); // optimize context
        const analyser = analyserRef.current;
        
        // OPTIMIZATION: Use smaller fft size calculation in performance mode
        const bufferLength = performanceMode ? Math.min(64, analyser.frequencyBinCount) : analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        analyser.getByteFrequencyData(dataArray);

        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        // OPTIMIZATION: Simple color instead of gradient if performance is critical
        let fillStyle;
        if (performanceMode) {
            fillStyle = `${color}66`;
        } else {
            const gradient = ctx.createLinearGradient(0, height, 0, 0);
            gradient.addColorStop(0, `${color}11`);
            gradient.addColorStop(0.5, `${color}44`);
            gradient.addColorStop(1, `${color}aa`);
            fillStyle = gradient;
        }

        const barWidth = (width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        ctx.fillStyle = fillStyle;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = (dataArray[i] / 255) * height;
            
            // Draw bars
            if (!performanceMode && ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(x, height - barHeight, barWidth - 2, barHeight, [2, 2, 0, 0]);
                ctx.fill();
            } else {
                // Faster drawRect for performance mode
                ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight);
            }

            x += barWidth + 1;
        }

        requestRef.current = requestAnimationFrame(draw);
    }, [analyserRef, color, performanceMode]);

    React.useEffect(() => {
        if (isPlaying) {
            requestRef.current = requestAnimationFrame(draw);
        } else {
            cancelAnimationFrame(requestRef.current);
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
        }
        return () => cancelAnimationFrame(requestRef.current);
    }, [isPlaying, draw]);

    // Handle Resize
    React.useEffect(() => {
        const handleResize = () => {
            if (canvasRef.current && canvasRef.current.parentElement) {
                canvasRef.current.width = canvasRef.current.parentElement.clientWidth;
                canvasRef.current.height = canvasRef.current.parentElement.clientHeight;
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="w-full h-full relative pointer-events-none group">
            <canvas ref={canvasRef} className="w-full h-full opacity-40 group-hover:opacity-60 transition-opacity duration-700" />
            
            {/* AI Vibe Commentary Overlay */}
            {currentComment && (
                <div className="absolute inset-0 flex items-center justify-center p-8 text-center animate-in zoom-in fade-in duration-1000">
                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 px-6 py-4 rounded-2xl shadow-2xl max-w-lg">
                        <div className="flex items-center gap-3 mb-2 justify-center">
                            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
                            <span className="text-[10px] font-black text-purple-300 uppercase tracking-widest">IA Vibe Analysis</span>
                        </div>
                        <p className="text-sm md:text-base font-medium text-white/90 leading-relaxed italic">
                            "{currentComment}"
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

window.Visualizer = Visualizer;
