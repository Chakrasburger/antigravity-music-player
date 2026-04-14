import re

with open('index_v2.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace <>{/* view === 'songs' ... */}</> 
# The block is right under: {(view === 'songs' || view === 'queue') && !permissionNeeded && !isScanning && (
library_regex = re.compile(r'\{\(view === \'songs\' \|\| view === \'queue\'\) && !permissionNeeded && !isScanning && \(\n[ \t]*<>(.*?)\n[ \t]*</>\n[ \t]*\)\}', re.DOTALL)

replacement_ui = """{(view === 'songs' || view === 'queue') && !permissionNeeded && !isScanning && (
    <LibraryView 
        view={view}
        library={library}
        librarySearchQuery={librarySearchQuery}
        setLibrarySearchQuery={setLibrarySearchQuery}
        displayList={displayList}
        performInitialSync={performInitialSync}
        isServerConnected={isServerConnected}
        setVsScrollTop={setVsScrollTop}
        startIdx={startIdx}
        visibleItems={visibleItems}
        ROW_HEIGHT={ROW_HEIGHT}
        currentTrackIndex={currentTrackIndex}
        activeTrack={activeTrack}
        openContextMenu={openContextMenu}
        selectTrack={selectTrack}
        currentlyEnriching={currentlyEnriching}
        ytDownloadProgress={ytDownloadProgress}
        enrichmentQueue={enrichmentQueue}
        isPlaying={isPlaying}
        durationRef={durationRef}
        currentProgressRef={currentProgressRef}
        setLibrary={setLibrary}
        setPlaybackQueue={setPlaybackQueue}
    />
)}"""

if library_regex.search(text):
    text = library_regex.sub(replacement_ui, text, count=1)
    
    # Add script tag to head
    app_script_regex = re.compile(r'(<script type="text/babel" src="src/components/PlayerBar.js"></script>\n\s*<script type="text/babel">)')
    tag_to_insert = """<script type="text/babel" src="src/components/PlayerBar.js"></script>
    <script type="text/babel" src="src/components/LibraryView.js"></script>
    <script type="text/babel">"""
    text = app_script_regex.sub(tag_to_insert, text, count=1)

    with open('index_v2.html', 'w', encoding='utf-8') as f:
        f.write(text)
    print("LibraryView extracted successfully!")
else:
    print("Could not find LibraryView UI block.")
