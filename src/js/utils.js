// src/js/utils.js
// ChakrasPlayer - Utilidades globales
// Expone: window.API_BASE, window.callBackend, window.formatTime, window.parseID3

(function(global) {
  'use strict';

  // API_BASE: compatible con PyWebView (file://) y navegador directo
  const API_BASE = (() => {
      const h = window.location.hostname;
      if (!h || h === '' || h === '127.0.0.1') return 'http://127.0.0.1:5888';
      return `http://${h}:5888`;
  })();

  // callBackend: fetch con fallback automático
  const callBackend = async (url, options) => {
      try {
          const res = await fetch(url, options);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return await res.json();
      } catch (e) {
          if (url.includes('127.0.0.1')) {
              const res = await fetch(url.replace('127.0.0.1', 'localhost'), options);
              return await res.json();
          }
          throw e;
      }
  };

  // formatTime: segundos -> "M:SS"
  const formatTime = (seconds) => {
      if (seconds === undefined || seconds === null || isNaN(seconds) || seconds < 0) return "--:--";
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // parseID3: lee tags ID3 de un File/Blob con jsmediatags
  const parseID3 = (file) => {
      return new Promise((resolve) => {
          const baseName = file.name.replace(/\.[^/.]+$/, "");
          let fallbackArtist = "Unknown Artist";
          let fallbackTitle = baseName;

          if (baseName.includes(" - ")) {
              const parts = baseName.split(" - ");
              fallbackArtist = parts[0].trim();
              fallbackTitle = parts.slice(1).join(" - ").trim();
          } else if (baseName.includes("-")) {
              const parts = baseName.split("-");
              if (parts.length > 1) {
                  fallbackArtist = parts[0].trim();
                  fallbackTitle = parts.slice(1).join("-").trim();
              }
          }

          window.jsmediatags.read(file, {
              onSuccess: (tag) => {
                  resolve({
                      title: tag.tags.title || fallbackTitle,
                      artist: tag.tags.artist || fallbackArtist,
                      album: tag.tags.album || "Unknown Album",
                      coverUrl: null
                  });
              },
              onError: () => {
                  resolve({
                      title: fallbackTitle,
                      artist: fallbackArtist,
                      album: "Unknown Album",
                      coverUrl: null
                  });
              }
          });
      });
  };

  // Exponer
  global.API_BASE    = API_BASE;
  global.callBackend = callBackend;
  global.formatTime  = formatTime;
  global.parseID3    = parseID3;

})(window);
