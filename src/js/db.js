// src/js/db.js
// ChakrasPlayer - Database Layer (Dexie.js + StorageApi)
// Cargado ANTES que cualquier componente React.
// Expone: window.db, window.StorageApi

(function(global) {
  'use strict';

  // Requiere: window.Dexie (cargado antes desde assets/lib/dexie.js)
  const db = new Dexie("ChakrasPlayerDB");

  db.version(2).stores({
      tracks: "id, title, artist, album, genre, dateAdded",
      stats: "artist",
      settings: "key",
      themes: "id",
      deleted_tracks: "id"
  });

  const StorageApi = {
      async setSetting(key, value) { await db.settings.put({ key, value }); },
      async getSetting(key) {
          const res = await db.settings.get(key);
          return res ? res.value : null;
      },
      async saveFolderPath(path) { await this.setSetting('folderPath', path); },
      async getFolderPath() { return await this.getSetting('folderPath'); },
      async saveTracks(tracks) {
          const blacklisted = await this.getBlacklistedTracks();
          const filtered = tracks.filter(t => !blacklisted.has(t.id));
          await db.tracks.bulkPut(filtered);
      },
      async saveTrack(track) {
          const blacklisted = await this.getBlacklistedTracks();
          if (!blacklisted.has(track.id)) await db.tracks.put(track);
      },
      async getAllTracks() { return await db.tracks.toArray(); },
      async updateTrack(id, newData) {
          const track = await db.tracks.get(id);
          if (track) {
              const updated = { ...track, ...newData };
              await db.tracks.put(updated);
              return updated;
          }
          return null;
      },
      async clearTracks() { await db.tracks.clear(); },
      async deleteTrack(id) {
          await db.tracks.delete(id);
          await db.deleted_tracks.put({ id });
      },
      async getBlacklistedTracks() {
          const list = await db.deleted_tracks.toArray();
          return new Set(list.map(l => l.id));
      },
      async logPlay(artist, minutesAdded, trackId = null) {
          if (!artist) return;
          const now = new Date();
          const hour = now.getHours();

          if (trackId) {
              const track = await db.tracks.get(trackId);
              if (track) {
                  track.playCount = (track.playCount || 0) + 1;
                  track.lastPlayed = now.getTime();
                  await db.tracks.put(track);
              }
          }

          let data = await db.stats.get(artist) || { artist, minutes: 0, playCount: 0, hourlyStats: new Array(24).fill(0) };
          data.minutes += minutesAdded;
          data.playCount += 1;
          data.hourlyStats[hour] = (data.hourlyStats[hour] || 0) + 1;
          await db.stats.put(data);

          let globalStats = await this.getSetting('global_hourly_stats') || new Array(24).fill(0);
          globalStats[hour]++;
          await this.setSetting('global_hourly_stats', globalStats);
      },
      async rateTrack(trackId, rating) {
          const track = await db.tracks.get(trackId);
          if (track) {
              track.rating = rating;
              await db.tracks.put(track);
          }
      },
      async getStats() {
          const items = await db.stats.toArray();
          items.sort((a, b) => b.minutes - a.minutes);
          return items;
      },
      async saveCustomTheme(theme) { await db.themes.put({ id: 'active', ...theme }); },
      async getCustomTheme() {
          const res = await db.themes.get('active');
          if (res) { delete res.id; return res; }
          return null;
      }
  };

  // Exponer globalmente
  global.db = db;
  global.StorageApi = StorageApi;

})(window);
