import re

with open('index_v2.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace block
pattern = re.compile(r"\{view === 'playlists' && \(\s*<div className=\"flex flex-col min-h-full animate-in fade-in duration-500\">.*?</div>\s*\)\}", re.DOTALL)

replacement = """{view === 'playlists' && (
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
                                    )}"""

if pattern.search(text):
    text = pattern.sub(replacement, text, count=1)
    
    # Add script tag
    app_script_regex = re.compile(r'(<script type="text/babel" src="src/components/Modals.js"></script>)')
    tag_to_insert = """<script type="text/babel" src="src/components/Modals.js"></script>
    <script type="text/babel" src="src/components/PlaylistsView.js"></script>"""
    text = app_script_regex.sub(tag_to_insert, text, count=1)

    with open('index_v2.html', 'w', encoding='utf-8') as f:
        f.write(text)
    print("PlaylistsView extracted successfully!")
else:
    print("Could not find PlaylistsView block.")
