import re

with open('index_v2.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace modals block
modals_regex = re.compile(r'\{/\* YouTube Metadata Prompt Modal Layer \*/\}.*?\{/\* Toast Notifications \*/\}', re.DOTALL)

replacement_ui = """{/* YouTube Metadata Prompt Modal Layer */}
                        <YtPromptModal 
                            ytPromptData={ytPromptData} 
                            setYtPromptData={setYtPromptData} 
                            confirmYtDownload={confirmYtDownload} 
                        />
                        <TrackContextMenu
                            contextMenu={contextMenu}
                            closeContextMenu={closeContextMenu}
                            openMetaEditor={openMetaEditor}
                            openTrimmer={openTrimmer}
                            replaceFromYoutube={replaceFromYoutube}
                            deleteSong={deleteSong}
                        />
                        <EditMetaModal
                            editMetaModal={editMetaModal}
                            setEditMetaModal={setEditMetaModal}
                            editorMsg={editorMsg}
                            editorSaving={editorSaving}
                            saveMetadata={saveMetadata}
                        />
                        <TrimModal
                            trimModal={trimModal}
                            setTrimModal={setTrimModal}
                            trimPreviewPlaying={trimPreviewPlaying}
                            setTrimPreviewPlaying={setTrimPreviewPlaying}
                            trimRange={trimRange}
                            setTrimRange={setTrimRange}
                            editorMsg={editorMsg}
                            editorSaving={editorSaving}
                            trimAudio={trimAudio}
                        />

                        {/* Toast Notifications */}"""

if modals_regex.search(text):
    text = modals_regex.sub(replacement_ui, text, count=1)
    
    # Add script tag to head
    app_script_regex = re.compile(r'(<script type="text/babel" src="src/components/AiChat.js"></script>\n\s*<script type="text/babel">)')
    tag_to_insert = """<script type="text/babel" src="src/components/AiChat.js"></script>
    <script type="text/babel" src="src/components/Modals.js"></script>
    <script type="text/babel">"""
    text = app_script_regex.sub(tag_to_insert, text, count=1)

    with open('index_v2.html', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Modals extracted successfully!")
else:
    print("Could not find Modals block.")
