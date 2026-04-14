// src/js/audio-engine.js
// ChakrasPlayer - Web Audio Engine
// Expone: window.AudioEngine

(function(global) {
  'use strict';

  const AudioEngine = {

      init(refs, eqBands, isEqEnabled, volume) {
          if (!refs.audioContextRef.current) {
              const AudioContext = window.AudioContext || window.webkitAudioContext;
              refs.audioContextRef.current = new AudioContext();

              refs.analyserRef.current = refs.audioContextRef.current.createAnalyser();
              refs.analyserRef.current.fftSize = 256;

              refs.gainNodeRef.current = refs.audioContextRef.current.createGain();

              // Create EQ chain
              refs.eqNodesRef.current = eqBands.map((band, i) => {
                  const filter = refs.audioContextRef.current.createBiquadFilter();
                  filter.type = i === 0 ? 'lowshelf' : i === eqBands.length - 1 ? 'highshelf' : 'peaking';
                  filter.frequency.value = band.freq;
                  filter.Q.value = 1;
                  filter.gain.value = isEqEnabled ? band.gain : 0;
                  return filter;
              });

              // Two audio tags for crossfade
              if (!refs.audioTagRef.current) refs.audioTagRef.current = document.getElementById('engine-audio-tag');
              if (!refs.audioTagRef2.current) refs.audioTagRef2.current = document.getElementById('engine-audio-tag-2');

              refs.sourceNodeRef.current = refs.audioContextRef.current.createMediaElementSource(refs.audioTagRef.current);
              refs.sourceNodeRef2.current = refs.audioContextRef.current.createMediaElementSource(refs.audioTagRef2.current);

              refs.gainNodeRef.current = refs.audioContextRef.current.createGain(); // For tag 1
              refs.gainNodeRef2.current = refs.audioContextRef.current.createGain(); // For tag 2

              // Routing: Source1/2 -> individual nodes -> EQ chain -> mainGain -> Analyser -> Dest
              refs.sourceNodeRef.current.connect(refs.gainNodeRef.current);
              refs.sourceNodeRef2.current.connect(refs.gainNodeRef2.current);

              refs.gainNodeRef.current.connect(refs.eqNodesRef.current[0]);
              refs.gainNodeRef2.current.connect(refs.eqNodesRef.current[0]);

              let lastNode = refs.eqNodesRef.current[0];
              for (let i = 1; i < refs.eqNodesRef.current.length; i++) {
                  lastNode.connect(refs.eqNodesRef.current[i]);
                  lastNode = refs.eqNodesRef.current[i];
              }

              // Main output gain
              const mainGain = refs.audioContextRef.current.createGain();
              mainGain.gain.value = volume;
              refs.mainGainRef.current = mainGain;

              lastNode.connect(mainGain);
              mainGain.connect(refs.analyserRef.current);
              refs.analyserRef.current.connect(refs.audioContextRef.current.destination);

              console.log("[AudioEngine] Multi-Source X-Fade inicializado");
          }
          if (refs.audioContextRef.current && refs.audioContextRef.current.state === 'suspended') {
              refs.audioContextRef.current.resume();
          }
      },

      startProgressLoop(refs, uiRefs, callbacks) {
          if (refs.reqAnimFrameRef.current) cancelAnimationFrame(refs.reqAnimFrameRef.current);

          const update = () => {
              const audio = refs.activeTagIdx.current === 0 ? refs.audioTagRef.current : refs.audioTagRef2.current;
              if (audio && !audio.paused) {
                  const activeTrack = callbacks.getActiveTrack();
                  const current = audio.currentTime + (activeTrack?.lyricsOffset || 0);
                  const dur = audio.duration;

                  // Sync Ref for Seek and Lyrics
                  callbacks.currentProgressRef.current = current;

                  if (dur > 0) {
                      const perc = (current / dur) * 100;

                      if (uiRefs.uiProgressInputRef.current) {
                          uiRefs.uiProgressInputRef.current.value = current;
                          uiRefs.uiProgressInputRef.current.max = dur;
                          uiRefs.uiProgressInputRef.current.style.background = `linear-gradient(to right, var(--color-vibrant, var(--color-blurple)) ${perc}%, var(--color-tertiary) ${perc}%)`;
                      }

                      if (uiRefs.uiCurrentTimeTextRef.current) {
                          uiRefs.uiCurrentTimeTextRef.current.textContent = window.formatTime ? window.formatTime(current) : Math.floor(current);
                      }

                      // Update active row visualizers natively
                      const listActiveRow = document.getElementById('active-row-bg-list');
                      if (listActiveRow) listActiveRow.style.background = `linear-gradient(to right, var(--color-vibrant-dark) 0%, var(--color-vibrant-dark) ${perc}%, transparent ${perc}%, transparent 100%)`;

                      const queueActiveRow = document.getElementById('active-row-bg-queue');
                      if (queueActiveRow) queueActiveRow.style.background = `linear-gradient(to right, var(--color-vibrant-dark) 0%, var(--color-vibrant-dark) ${perc}%, transparent ${perc}%, transparent 100%)`;

                      // Karaoke Lyrics Sync
                      const lyricsData = callbacks.getLyricsData();
                      if (lyricsData && uiRefs.lyricsContainerRef.current) {
                          const lData = lyricsData;
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

                                  const children = uiRefs.lyricsContainerRef.current.children;
                                  for (let i = 0; i < lData.length; i++) {
                                      const el = children[i + 1];
                                      if (!el) continue;

                                      if (i === actIdx) {
                                          if (!el.classList.contains('active-lyric-line')) {
                                              el.classList.add('active-lyric-line');
                                              el.classList.remove('inactive-lyric-line');
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

                      // Visualizer
                      if (refs.analyserRef.current) {
                          const dataArray = new Uint8Array(refs.analyserRef.current.frequencyBinCount);
                          refs.analyserRef.current.getByteFrequencyData(dataArray);
                          let sum = 0;
                          const bassBins = 8;
                          for (let i = 0; i < bassBins; i++) sum += dataArray[i];
                          const avgBass = sum / bassBins;
                          const intensity = Math.max(0, (avgBass - 160) / 95);
                          const scale = 1.0 + (intensity * 0.15);
                          const brightness = 1.0 + (intensity * 1.5);
                          const pulseOpacity = 0.5 + (intensity * 0.8);

                          document.documentElement.style.setProperty('--beat-scale', scale);
                          document.documentElement.style.setProperty('--beat-bright', brightness);
                          document.documentElement.style.setProperty('--beat-opacity', pulseOpacity);
                      }

                      // React Sync
                      callbacks.setCurrentTime(prev => (Math.abs(prev - current) > 0.1) ? current : prev);

                      // Stats Logging
                      if (!callbacks.hasLoggedPlayRef.current && current > (dur * 0.5)) {
                          callbacks.hasLoggedPlayRef.current = true;
                          const track = refs.playbackQueueRef?.current?.[refs.currentTrackIndexRef?.current];
                          if (track) callbacks.logPlay(track.artist, dur / 60, track.id);
                      }

                      // Crossfade Trigger
                      if (callbacks.isMixMode && dur > 10 && current > (dur - 5) && !refs.isCrossfading.current) {
                          refs.isCrossfading.current = true;
                          console.log("[MixMode] Starting 5s Crossfade...");
                          const currGain = refs.activeTagIdx.current === 0 ? refs.gainNodeRef.current : refs.gainNodeRef2.current;
                          if (currGain) currGain.gain.linearRampToValueAtTime(0, refs.audioContextRef.current.currentTime + 5);
                          callbacks.nextTrack(true, true);
                      }
                  }
              }
              refs.reqAnimFrameRef.current = requestAnimationFrame(update);
          };
          refs.reqAnimFrameRef.current = requestAnimationFrame(update);
      },

      async playTrack(track, isCrossfadeTransition, refs, callbacks) {
          if (!track) return;

          if (refs.audioContextRef.current && refs.audioContextRef.current.state === 'suspended') {
              refs.audioContextRef.current.resume().catch(() => { });
          }
          if (!refs.audioContextRef.current) callbacks.initIfNeeded();

          callbacks.setIsLoading(true);

          if (isCrossfadeTransition) {
              refs.activeTagIdx.current = refs.activeTagIdx.current === 0 ? 1 : 0;
          } else {
              refs.activeTagIdx.current = 0;
              refs.isCrossfading.current = false;
              if (refs.gainNodeRef.current) refs.gainNodeRef.current.gain.value = 1;
              if (refs.gainNodeRef2.current) refs.gainNodeRef2.current.gain.value = 0;
          }

          const audio = refs.activeTagIdx.current === 0 ? refs.audioTagRef.current : refs.audioTagRef2.current;
          const otherAudio = refs.activeTagIdx.current === 0 ? refs.audioTagRef2.current : refs.audioTagRef.current;
          const gain = refs.activeTagIdx.current === 0 ? refs.gainNodeRef.current : refs.gainNodeRef2.current;
          const otherGain = refs.activeTagIdx.current === 0 ? refs.gainNodeRef2.current : refs.gainNodeRef.current;

          if (!audio) return;

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
              gain.gain.linearRampToValueAtTime(1, refs.audioContextRef.current.currentTime + 5);
          }

          const localPlay = () => {
              audio.play().then(() => {
                  callbacks.setIsPlaying(true);
                  callbacks.setActiveTrack(track);
                  callbacks.setIsLoading(false);
              }).catch((e) => {
                  console.error('[Playback] Error playing track:', e);
                  callbacks.setIsLoading(false);
              });
          };

          audio.onloadedmetadata = () => {
              if (audio.duration && audio.duration !== Infinity && !isNaN(audio.duration)) {
                  callbacks.setDuration(audio.duration);
              }
          };

          audio.onended = () => {
              callbacks.onEnded();
          };

          localPlay();
      },

      applyEqBand(bandIndex, gainValue, refs) {
          if (refs.audioContextRef.current && refs.eqNodesRef.current[bandIndex]) {
              const ctx = refs.audioContextRef.current;
              refs.eqNodesRef.current[bandIndex].gain.linearRampToValueAtTime(gainValue, ctx.currentTime + 0.1);
          }
      },

      toggleEq(enabled, eqBands, refs) {
          if (refs.audioContextRef.current) {
              const ctx = refs.audioContextRef.current;
              refs.eqNodesRef.current.forEach((filter, idx) => {
                  filter.gain.linearRampToValueAtTime(enabled ? eqBands[idx].gain : 0, ctx.currentTime + 0.1);
              });
          }
      },

      resumeContext(refs) {
          if (refs.audioContextRef.current && refs.audioContextRef.current.state === 'suspended') {
              refs.audioContextRef.current.resume().catch(() => {});
          }
      }
  };

  global.AudioEngine = AudioEngine;

})(window);
