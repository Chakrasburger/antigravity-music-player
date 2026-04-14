import re

with open('index_v2.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace <aside className="glass-panel flex flex-col pt-6 pb-12 border-r border-white/5 h-full overflow-y-auto overflow-x-hidden">...</aside>
sidebar_regex = re.compile(r'\{\/\* Sidebar \*\/\}\n[ \t]*<aside className="glass-panel flex flex-col pt-6 pb-12 border-r border-white/5 h-full overflow-y-auto overflow-x-hidden">.*?</aside>', re.DOTALL)

replacement_ui = """{/* Sidebar Component */}
<Sidebar 
    view={view}
    setView={setView}
    scanDirectory={scanDirectory}
    isScanning={isScanning}
    ytDownloadProgress={ytDownloadProgress}
    batchDownloadQueue={batchDownloadQueue}
    seenDownloadsCount={seenDownloadsCount}
/>
"""

if sidebar_regex.search(text):
    text = sidebar_regex.sub(replacement_ui, text, count=1)
    
    # Add script tag to head
    app_script_regex = re.compile(r'(<script type="text/babel" src="src/components/Equalizer.js"></script>\n\s*<script type="text/babel">)')
    tag_to_insert = """<script type="text/babel" src="src/components/Equalizer.js"></script>
    <script type="text/babel" src="src/components/Sidebar.js"></script>
    <script type="text/babel">"""
    text = app_script_regex.sub(tag_to_insert, text, count=1)

    with open('index_v2.html', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Sidebar extracted successfully!")
else:
    print("Could not find Sidebar UI block.")
