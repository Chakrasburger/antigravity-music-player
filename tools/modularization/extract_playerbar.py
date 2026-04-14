import re

with open('index_v2.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace <footer ...>...</footer>
# The footer starts after {/* Bottom Player Bar */}
playerbar_regex = re.compile(r'\{\/\* Bottom Player Bar \*\/\}\n[ \t]*<footer className="w-full h-\[90px\] shrink-0 glass-panel border-t border-white/5 px-6 flex items-center justify-between z-50 shadow-\[0_-4px_30px_rgba\(0,0,0,0\.1\)\] relative" >.*?</footer>', re.DOTALL)

replacement_ui = """{/* Bottom Player Bar Component */}
<PlayerBar 
    activeTrack={activeTrack}
    currentlyEnriching={currentlyEnriching}
    playbackQueue={playbackQueue}
    setPlaybackQueue={setPlaybackQueue}
    library={library}
    setLibrary={setLibrary}
    isShuffle={isShuffle}
    toggleShuffle={toggleShuffle}
    isMixMode={isMixMode}
    setIsMixMode={setIsMixMode}
    prevTrack={prevTrack}
    seekBackward10={seekBackward10}
    isPlaying={isPlaying}
    togglePlay={togglePlay}
    seekForward10={seekForward10}
    nextTrack={nextTrack}
    repeatMode={repeatMode}
    toggleRepeat={toggleRepeat}
    uiCurrentTimeTextRef={uiCurrentTimeTextRef}
    currentProgressRef={currentProgressRef}
    uiProgressInputRef={uiProgressInputRef}
    duration={duration}
    handleSeek={handleSeek}
    handleDeviceSelect={handleDeviceSelect}
    audioDeviceId={audioDeviceId}
    showDevicePicker={showDevicePicker}
    setShowDevicePicker={setShowDevicePicker}
    audioDevices={audioDevices}
    selectDevice={selectDevice}
    togglePopUpView={togglePopUpView}
    view={view}
    initPiP={initPiP}
    isMuted={isMuted}
    toggleMute={toggleMute}
    volume={volume}
    handleVolume={handleVolume}
/>
"""

if playerbar_regex.search(text):
    text = playerbar_regex.sub(replacement_ui, text, count=1)
    
    # Add script tag to head
    app_script_regex = re.compile(r'(<script type="text/babel" src="src/components/Sidebar.js"></script>\n\s*<script type="text/babel">)')
    tag_to_insert = """<script type="text/babel" src="src/components/Sidebar.js"></script>
    <script type="text/babel" src="src/components/PlayerBar.js"></script>
    <script type="text/babel">"""
    text = app_script_regex.sub(tag_to_insert, text, count=1)

    with open('index_v2.html', 'w', encoding='utf-8') as f:
        f.write(text)
    print("PlayerBar extracted successfully!")
else:
    print("Could not find PlayerBar UI block.")
