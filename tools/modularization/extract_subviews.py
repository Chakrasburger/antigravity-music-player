import re

with open('index_v2.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace YtSearchView
text = re.sub(
    r"\{view === 'searchYt' && \(\s*<div className=\"flex flex-col h-full space-y-6 animate-in fade-in duration-300\">.*?</form>\s*<div className=\"flex-1 overflow-y-auto px-1 custom-scrollbar pb-10\">.*?</div>\s*</div>\s*\)\s*\}",
    """{view === 'searchYt' && (
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
                                    )}""",
    text, flags=re.DOTALL
)

# Replace LyricsView
text = re.sub(
    r"\{\s*view === 'lyrics' && \(\s*<div className=\"h-full flex flex-col items-center justify-center relative bg-discord-bg overflow-hidden\".*?</div>\s*\)\s*\}",
    """{view === 'lyrics' && (
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
                                    )}""",
    text, flags=re.DOTALL
)

# Replace AlbumsView
text = re.sub(
    r"\{\s*view === 'albums' && \(\s*<div className=\"grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6\">.*?</div\s*>\s*\)\s*\}",
    """{view === 'albums' && (
                                        <AlbumsView 
                                            library={library}
                                            setPlaybackQueue={setPlaybackQueue}
                                            setOriginalQueue={setOriginalQueue}
                                            setCurrentTrackIndex={setCurrentTrackIndex}
                                            setIsPlaying={setIsPlaying}
                                            setView={setView}
                                        />
                                    )}""",
    text, flags=re.DOTALL
)

# Replace ArtistsView
text = re.sub(
    r"\{\s*view === 'artists' && \(\s*<div className=\"grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8\">.*?</div>\s*\)\s*\}",
    """{view === 'artists' && (
                                        <ArtistsView 
                                            library={library}
                                            setPlaybackQueue={setPlaybackQueue}
                                            setOriginalQueue={setOriginalQueue}
                                            setCurrentTrackIndex={setCurrentTrackIndex}
                                            setIsPlaying={setIsPlaying}
                                            setView={setView}
                                        />
                                    )}""",
    text, flags=re.DOTALL
)

# REMOVE the old PlaylistsView legacy block (from view === 'playlists' && ( to the Most Played closing div/block)
text = re.sub(
    r"\{\s*view === 'playlists' && \(\s*<div className=\"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6\">.*?</div>\s*\)\s*\}",
    "",  # Totally removed, we use the modern one
    text, flags=re.DOTALL
)

# Add script tags
import re as re2
app_script_regex = re2.compile(r'(<script type="text/babel" src="src/components/AiChat.js"></script>)')
tag_to_insert = """<script type="text/babel" src="src/components/ArtistsView.js"></script>
    <script type="text/babel" src="src/components/AlbumsView.js"></script>
    <script type="text/babel" src="src/components/LyricsView.js"></script>
    <script type="text/babel" src="src/components/YtSearchView.js"></script>
    <script type="text/babel" src="src/components/AiChat.js"></script>"""
text = app_script_regex.sub(tag_to_insert, text, count=1)

with open('index_v2.html', 'w', encoding='utf-8') as f:
    f.write(text)
print("Subviews extracted and replaced.")
