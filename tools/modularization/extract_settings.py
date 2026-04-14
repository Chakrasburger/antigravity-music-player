with open('index_v2.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
for i, line in enumerate(lines):
    if "view === 'settings' && (" in line:
        start_idx = i - 1  # The line with just `{`
        break

if start_idx != -1:
    end_idx = -1
    open_divs = 0
    in_settings = False
    
    # Simple bracket matching logic for the entire React expression
    brackets = 0
    for i in range(start_idx, len(lines)):
        brackets += lines[i].count('{')
        brackets -= lines[i].count('}')
        if brackets == 0 and i > start_idx + 2:
            end_idx = i
            break
            
    print(f"Found settings block from {start_idx} to {end_idx}")
    
    replacement_str = """                                    {
                                        view === 'settings' && (
                                        <SettingsView
                                            settingsTab={settingsTab}
                                            setSettingsTab={setSettingsTab}
                                            remoteEnabled={remoteEnabled}
                                            setRemoteEnabled={setRemoteEnabled}
                                            globalTunnelUrl={globalTunnelUrl}
                                            isLanReachable={isLanReachable}
                                            localIp={localIp}
                                            serverPort={serverPort}
                                            addToast={addToast}
                                            themeSettings={themeSettings}
                                            setThemeSettings={setThemeSettings}
                                            performanceMode={performanceMode}
                                            togglePerformanceMode={togglePerformanceMode}
                                            isEqEnabled={isEqEnabled}
                                            toggleEq={toggleEq}
                                            eqPreset={eqPreset}
                                            applyEqPreset={applyEqPreset}
                                            eqBands={eqBands}
                                            handleEqChange={handleEqChange}
                                            handleDeviceSelect={handleDeviceSelect}
                                            audioDeviceId={audioDeviceId}
                                            clearLibrary={clearLibrary}
                                            setLibrary={setLibrary}
                                            crossfade={crossfade}
                                            setCrossfade={setCrossfade}
                                            isAutoplay={isAutoplay}
                                            setIsAutoplay={setIsAutoplay}
                                            isNormalize={isNormalize}
                                            setIsNormalize={setIsNormalize}
                                            isGapless={isGapless}
                                            setIsGapless={setIsGapless}
                                            library={library}
                                            userPlaylists={userPlaylists}
                                            aiProvider={aiProvider}
                                            localModel={localModel}
                                        />
                                    )}\n"""
    
    new_lines = lines[:start_idx] + [replacement_str] + lines[end_idx+1:]
    
    text = "".join(new_lines)
    
    # Add script tag
    import re
    app_script_regex = re.compile(r'(<script type="text/babel" src="src/components/PlaylistsView.js"></script>)')
    tag_to_insert = """<script type="text/babel" src="src/components/PlaylistsView.js"></script>
    <script type="text/babel" src="src/components/SettingsView.js"></script>"""
    text = app_script_regex.sub(tag_to_insert, text, count=1)

    with open('index_v2.html', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Successfully replaced.")
else:
    print("Could not find start idx.")
