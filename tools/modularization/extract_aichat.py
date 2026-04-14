import re

with open('index_v2.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace {view === 'ai-assistant' && ( ... )}
# Search from: {view === 'ai-assistant' && (
# To the end of the AI UI block which ends with:
#                                                 </form>
#                                             </div>
#                                         </div>
#                                     )}
# Wait, I can use a carefully crafted regex.
# Actually, the block is clearly identified by `<div className="flex flex-col h-[calc(100vh-280px)] w-full max-w-4xl mx-auto rounded-2xl overflow-hidden glass-panel border border-white/10 shadow-2xl relative">`
aichat_regex = re.compile(r'\{view === \'ai-assistant\' && \(\n[ \t]*<div className="flex flex-col h-\[calc\(100vh-280px\)\] w-full max-w-4xl mx-auto rounded-2xl overflow-hidden glass-panel border border-white/10 shadow-2xl relative">.*?<button type="submit" disabled=\{isAiThinking\}[\s\S]*?</i>\n[ \t]*</button>\n[ \t]*</form>\n[ \t]*</div>\n[ \t]*</div>\n[ \t]*\)\}', re.DOTALL)

replacement_ui = """{view === 'ai-assistant' && (
    <AiChat 
        localModel={localModel} setLocalModel={setLocalModel}
        library={library}
        aiMessages={aiMessages} setAiMessages={setAiMessages}
        showApiConfig={showApiConfig} setShowApiConfig={setShowApiConfig}
        aiProvider={aiProvider} setAiProvider={setAiProvider}
        availableModels={availableModels} setAvailableModels={setAvailableModels}
        openRouterKey={openRouterKey} setOpenRouterKey={setOpenRouterKey}
        openRouterModel={openRouterModel} setOpenRouterModel={setOpenRouterModel}
        customApiKey={customApiKey} setCustomApiKey={setCustomApiKey}
        chatEndRef={chatEndRef}
        isAiThinking={isAiThinking}
        handleAiSubmit={handleAiSubmit}
        aiInput={aiInput} setAiInput={setAiInput}
        playAiPlaylist={playAiPlaylist}
        setPlaybackQueue={setPlaybackQueue}
        setCurrentTrackIndex={setCurrentTrackIndex}
        playTrackCore={playTrackCore}
        addToast={addToast}
    />
)}"""

if aichat_regex.search(text):
    text = aichat_regex.sub(replacement_ui, text, count=1)
    
    # Add script tag to head
    app_script_regex = re.compile(r'(<script type="text/babel" src="src/components/LibraryView.js"></script>\n\s*<script type="text/babel">)')
    tag_to_insert = """<script type="text/babel" src="src/components/LibraryView.js"></script>
    <script type="text/babel" src="src/components/AiChat.js"></script>
    <script type="text/babel">"""
    text = app_script_regex.sub(tag_to_insert, text, count=1)

    with open('index_v2.html', 'w', encoding='utf-8') as f:
        f.write(text)
    print("AiChat extracted successfully!")
else:
    print("Could not find AiChat UI block.")
