# 📱 Guía: Crear ChakrasPlayer Móvil con Vibe Coding

## Resumen

Esta guía te explica cómo replicar las funciones principales de ChakrasPlayer como app móvil usando **Vibe Coding** (programar con IA generativa). La app de escritorio ya tiene un sistema de control remoto (`/remote`) que funciona desde el navegador del celular, pero si quieres una **app nativa** con capacidades completas, sigue esta guía.

---

## Arquitectura Recomendada

```
┌─────────────────────────────┐
│     ChakrasPlayer Móvil     │
│  (React Native / Expo)      │
├─────────────────────────────┤
│  UI Layer (React Native)    │
│  - Player Screen            │
│  - Library Browser          │
│  - Search & Download        │
│  - AI Assistant             │
│  - Lyrics Viewer            │
├─────────────────────────────┤
│  Audio Engine               │
│  - react-native-track-player│
│  - Background playback      │
│  - Lock screen controls     │
├─────────────────────────────┤
│  Data Layer                 │
│  - SQLite (local library)   │
│  - AsyncStorage (settings)  │
│  - File System (downloads)  │
├─────────────────────────────┤
│  Network Layer              │
│  - Gemini API (IA)          │
│  - YouTube search (yt-dlp)  │
│  - Synced Lyrics API        │
│  - Chakras Remote API       │
└─────────────────────────────┘
```

### Framework Recomendado: **React Native con Expo**
- ✅ JavaScript (misma tecnología que ChakrasPlayer desktop)
- ✅ Expo simplifica el build para iOS y Android
- ✅ Las IAs generan código React Native excelente
- ✅ Acceso a audio nativo, filesystem, Bluetooth

---

## Funciones Principales a Replicar

### 1. 🎵 Reproductor de Audio Local
**Descripción**: Reproducir archivos MP3/FLAC/M4A almacenados en el dispositivo.

**Dependencia clave**: `react-native-track-player`

**Prompt para Vibe Coding**:
```
Crea un reproductor de música con React Native y Expo que use 
react-native-track-player. Necesito:
- Pantalla principal con lista de canciones del dispositivo
- Reproductor con controles (play/pause, next, prev, shuffle, repeat)  
- Barra de progreso con seek
- Control de volumen
- Reproducción en background con controles en lock screen
- Diseño oscuro estilo Spotify con colores #0a0a0a fondo y #5865F2 acentos
- Portadas de álbum extraídas de los metadatos de los archivos
```

**Dependencias a instalar**:
```bash
npx expo install react-native-track-player
npx expo install expo-media-library
npx expo install expo-file-system
npx expo install @react-native-async-storage/async-storage
```

---

### 2. 📚 Biblioteca de Canciones con Metadatos
**Descripción**: Escanear el dispositivo, extraer metadatos (título, artista, álbum, portada).

**Prompt para Vibe Coding**:
```
Agrega un sistema de biblioteca musical que:
- Escanee la carpeta de música del dispositivo usando expo-media-library
- Extraiga metadatos ID3 de archivos MP3 usando react-native-get-music-files
  o music-metadata
- Almacene la biblioteca en SQLite local (expo-sqlite)
- Muestre la biblioteca organizada por: Canciones, Álbumes, Artistas
- Incluya búsqueda instantánea por título/artista
- Muestre portadas de álbum
- Permita editar metadatos manualmente
```

**Dependencias**:
```bash
npx expo install expo-sqlite
npx expo install expo-media-library
npm install react-native-get-music-files
```

---

### 3. 🔍 Búsqueda y Descarga desde YouTube
**Descripción**: Buscar canciones en YouTube y descargarlas.

> ⚠️ **Nota importante**: `yt-dlp` no corre directamente en móvil. Hay 2 opciones:

**Opción A**: Usar la API del servidor desktop (si están en la misma red)
```
Agrega una pantalla "Buscar en YouTube" que se conecte al servidor de 
ChakrasPlayer desktop en la red local (http://IP_LOCAL:5888/api/search).
- Campo de búsqueda con resultados en tarjetas
- Cada resultado muestra: thumbnail, título, canal, duración
- Botón de descarga que envía la solicitud al servidor desktop
- Barra de progreso de descarga
- Al completar, el archivo se transfiere al celular automáticamente
```

**Opción B**: Backend propio en la nube
```
Crea un backend serverless (Vercel/Railway) con un endpoint que reciba una 
URL de YouTube y use yt-dlp para extraer el audio. El endpoint retorna 
un link de descarga temporal. La app móvil llama a este endpoint.
```

---

### 4. 🤖 Asistente IA (Gemini API)
**Descripción**: Chat con IA que sugiere playlists basadas en tu biblioteca.

**Prompt para Vibe Coding**:
```
Agrega un chat de IA musical que:
- Use la API de Google Gemini (gemini-2.5-flash) directamente desde la app
- El usuario ingresa un prompt (ej: "hazme un playlist para entrenar")
- La IA recibe la biblioteca del usuario como contexto
- La IA responde con texto + opcionalmente una playlist en JSON
- Si hay playlist, mostrar un card con botón "Reproducir Mix"
- Interfaz tipo chat con burbujas (usuario=azul, IA=gris oscuro)
- Guardar API Key en AsyncStorage
- Contador de uso diario (máximo 1500 llamadas/día)

URL de la API: 
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=API_KEY
Body: { "contents": [{ "parts": [{ "text": "prompt aquí" }] }] }
```

---

### 5. 🎤 Letras Sincronizadas
**Descripción**: Mostrar letras con timestamps sincronizados al audio.

**Prompt para Vibe Coding**:
```
Agrega una pantalla de letras sincronizadas (LRC) que:
- Busque letras usando la API: https://lrclib.net/api/search?q=ARTISTA+TITULO
- Parse el formato LRC [mm:ss.ms] texto
- Muestre las letras en scroll vertical
- La línea activa sea grande y brillante, las inactivas sean tenues
- Auto-scroll suave para mantener la línea activa centrada
- Permita tocar una línea para saltar a ese punto del audio
- Efecto karaoke: la línea activa se llena de color progresivamente
- Si no hay letras sincronizadas, mostrar letras estáticas
```

---

### 6. 📡 Chakras Remote (Control Bidireccional)
**Descripción**: Control remoto bidireccional entre móvil y desktop.

**Prompt para Vibe Coding**:
```
Agrega una función "Chakras Connect" que permita:
- Descubrir el servidor ChakrasPlayer en la red local (mDNS o IP manual)
- Conectarse al servidor desktop via HTTP
- Modo REMOTO: Controlar la reproducción del desktop desde el celular
  - Enviar comandos: POST http://IP:5888/api/remote/command
    Body: { "command": "toggle|next|prev|volume|seek", "value": ... }
  - Leer estado: GET http://IP:5888/api/remote/state
- Modo RECEPTOR: Recibir audio del desktop (streaming)
  - El desktop envía el audio stream al celular
- UI tipo Spotify Connect:
  - Banner inferior "Reproduciendo en PC"
  - Botón para cambiar entre reproducción local y remota
```

---

## Estructura de Archivos Sugerida

```
chakras-mobile/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx        # Tab navigator
│   │   ├── library.tsx        # Biblioteca principal
│   │   ├── search.tsx         # Búsqueda YouTube
│   │   ├── ai.tsx             # Asistente IA
│   │   └── settings.tsx       # Configuración
│   ├── player.tsx             # Reproductor fullscreen
│   ├── lyrics.tsx             # Letras sincronizadas
│   └── remote.tsx             # Chakras Remote/Connect
├── components/
│   ├── MiniPlayer.tsx         # Mini player (bottom bar)
│   ├── TrackCard.tsx          # Tarjeta de canción
│   ├── AlbumGrid.tsx          # Grid de álbumes
│   ├── AIChatBubble.tsx       # Burbuja de chat IA
│   └── DevicePicker.tsx       # Selector Bluetooth
├── services/
│   ├── audioService.ts        # react-native-track-player setup
│   ├── libraryService.ts      # Escaneo y metadatos
│   ├── geminiService.ts       # API de Gemini
│   ├── lyricsService.ts       # Búsqueda de letras
│   └── remoteService.ts       # Chakras Connect
├── store/
│   ├── playerStore.ts         # Estado global (Zustand)
│   └── settingsStore.ts       # Configuración persistente
├── assets/
│   └── fonts/
├── app.json
├── package.json
└── tsconfig.json
```

---

## Prompt Maestro para Iniciar el Proyecto

Usa este prompt para que la IA genere el esqueleto completo:

```
Crea una app de reproductor de música con React Native y Expo (Expo Router). 
La app se llama "ChakrasPlayer" y tiene las siguientes características:

DISEÑO:
- Tema oscuro premium (#0a0a0a fondo, #5865F2 acentos, glassmorphism)
- Tipografía Inter
- Animaciones fluidas
- Diseño inspirado en Spotify

PANTALLAS:
1. Library: Lista de canciones con portadas, virtualización para rendimiento
2. Search: Búsqueda de música (conecta a servidor local o YouTube API)  
3. AI: Chat con Gemini 2.5 Flash para sugerencias de playlists
4. Settings: Tema, API Key de Gemini, Conexión remota, Audio output
5. Player: Vista fullscreen con portada grande, controles, letras
6. Remote: Chakras Connect para controlar PC desde celular

AUDIO:
- Usar react-native-track-player para reproducción
- Soporte para MP3, FLAC, M4A
- Reproducción en background
- Lock screen controls
- Shuffle, repeat, queue

DATOS:
- SQLite para biblioteca
- AsyncStorage para settings
- Zustand para estado global

Genera la estructura completa del proyecto con código funcional.
```

---

## Pasos para Construir

### Paso 1: Crear el proyecto
```bash
npx create-expo-app@latest chakras-mobile --template tabs
cd chakras-mobile
```

### Paso 2: Instalar dependencias
```bash
npx expo install react-native-track-player
npx expo install expo-sqlite expo-media-library expo-file-system
npx expo install @react-native-async-storage/async-storage
npm install zustand
npm install react-native-reanimated react-native-gesture-handler
```

### Paso 3: Configurar Track Player
Sigue la [documentación oficial](https://rntp.dev/docs/basics/getting-started).

### Paso 4: Usar Vibe Coding
Con cada prompt de la sección anterior, pide a la IA que genere el componente completo. Itera sobre cada pantalla.

### Paso 5: Build
```bash
# Desarrollo
npx expo start

# Build Android APK
eas build --platform android --profile preview

# Build iOS (requiere cuenta Apple Developer)
eas build --platform ios --profile preview
```

---

## Flujo de Datos: Escritorio ↔ Móvil

```
┌──────────────┐         HTTP/WiFi          ┌──────────────┐
│  ChakrasPlayer│◄─────────────────────────►│ ChakrasPlayer│
│   Desktop     │                            │   Móvil      │
│  (Python +    │  GET /api/remote/state     │  (React      │
│   WebView)    │  POST /api/remote/command  │   Native)    │
│               │  POST /api/remote/update   │              │
│  Puerto 5888  │  GET /api/library          │              │
│  IP: 192.168.x│  POST /api/search          │              │
│               │  POST /api/download        │              │
└──────────────┘                            └──────────────┘
```

### Sincronización de Biblioteca
1. El móvil se conecta al desktop via WiFi
2. Llama a `GET /api/library` para obtener la lista de canciones
3. Puede solicitar descargas con `POST /api/download`
4. Los archivos descargados se transfieren vía `GET /api/file?path=...`

### Control Remoto Bidireccional
1. **Móvil → Desktop**: Envía comandos de reproducción
2. **Desktop → Móvil**: Comparte estado de reproducción en tiempo real
3. Ambos pueden reproducir audio independientemente

---

## Notas Importantes

1. **yt-dlp no funciona en móvil** — usa el servidor desktop o un backend en la nube
2. **Bluetooth en React Native** — usa `react-native-ble-plx` para descubrir dispositivos
3. **Audio en background** — requiere configuración especial en iOS (Background Modes)
4. **Permisos** — necesitas solicitar permisos de almacenamiento y audio
5. **La versión web del Remote** (`http://IP:5888/remote`) ya está funcional y no requiere instalar ninguna app

---

*Generado para ChakrasPlayer v2.0 — Abril 2026*
