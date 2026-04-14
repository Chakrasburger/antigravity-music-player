import re

with open('index_v2.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Replace Dexie DB setup and utils (lines 121-254 approx)
# It starts with '<!-- Dexie.js Setup -->' and ends with '</script>' before '<!-- React Application -->'
dexie_block_regex = re.compile(r'<!-- Dexie.js Setup -->.*?<script>.*?</script>', re.DOTALL)

script_tags = """
    <!-- FASE 3: Módulos JS puros (sin JSX) -->
    <script src="src/js/db.js"></script>
    <script src="src/js/utils.js"></script>
    <script src="src/js/lyrics-engine.js"></script>
    <script src="src/js/audio-engine.js"></script>
"""

if dexie_block_regex.search(html):
    html = dexie_block_regex.sub(script_tags, html, count=1)
    print("Replaced Dexie block.")
else:
    print("Dexie block not found.")

# 2. Remove utils from babel config. 
# Search for API_BASE, callBackend, formatTime in the babel script and remove them.
# They are between 'const API_BASE = (() => {' and 'const formatTime = (seconds) => { ... };'
utils_regex = re.compile(r'// \u2500\u2500\u2500 API_BASE:.*?};\n', re.DOTALL)
if utils_regex.search(html):
    html = utils_regex.sub('', html, count=1)
    print("Removed utils from Babel script.")
else:
    print("Utils in Babel script not found.")

with open('index_v2.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Done updating HTML.")
