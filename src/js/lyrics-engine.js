// src/js/lyrics-engine.js
// ChakrasPlayer - Lyrics Engine
// Expone: window.LyricsEngine

(function(global) {
  'use strict';

  /**
   * Parsea un string en formato LRC a array de líneas con timestamps.
   * @param {string} lrcString
   * @returns {Array<{time: number, text: string, type: string}>}
   */
  function parseLrc(lrcString) {
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
  }

  /**
   * Busca y carga letras desde el backend.
   * @param {string} artist
   * @param {string} title
   * @returns {Promise<Array|null>} Array de líneas parseadas, o null
   */
  async function loadLyrics(artist, title) {
      if (!artist || !title) return null;
      try {
          const res = await fetch(`${window.API_BASE}/api/lyrics/search`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ artist, title })
          });
          const data = await res.json();
          if (data.lyrics) return parseLrc(data.lyrics);
          return null;
      } catch (e) {
          console.error('[LyricsEngine] Error:', e);
          return null;
      }
  }

  global.LyricsEngine = { parseLrc, loadLyrics };

})(window);
