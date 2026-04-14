with open('index_v2.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

def find_block(start_str):
    start_idx = -1
    for i, line in enumerate(lines):
        if start_str in line:
            start_idx = i - 1  # The line with `{`
            break

    if start_idx == -1:
        return -1, -1

    end_idx = -1
    brackets = 0
    for i in range(start_idx, len(lines)):
        brackets += lines[i].count('{')
        brackets -= lines[i].count('}')
        if brackets == 0 and i > start_idx + 2:
            end_idx = i
            break
    
    return start_idx, end_idx

# Delete and replace batch-import
bi_start, bi_end = find_block("view === 'batch-import' && (")
if bi_start != -1:
    bi_replacement = """                                    {view === 'batch-import' && (
                                        <BatchImportView 
                                            batchDownloadQueue={batchDownloadQueue}
                                            setBatchDownloadQueue={setBatchDownloadQueue}
                                        />
                                    )}\n"""
    lines[bi_start:bi_end+1] = [bi_replacement]

# Find and replace downloads (Note: lines shifted due to previous replacement)
dl_start, dl_end = find_block("view === 'downloads' && (")
if dl_start != -1:
    dl_replacement = """                                    {view === 'downloads' && (
                                        <DownloadsView 
                                            setView={setView}
                                            handleBatchUpload={handleBatchUpload}
                                            ytDownloadProgress={ytDownloadProgress}
                                            batchDownloadQueue={batchDownloadQueue}
                                        />
                                    )}\n"""
    lines[dl_start:dl_end+1] = [dl_replacement]

text = "".join(lines)

# Add script tags
import re
app_script_regex = re.compile(r'(<script type="text/babel" src="src/components/SettingsView.js"></script>)')
tag_to_insert = """<script type="text/babel" src="src/components/SettingsView.js"></script>
    <script type="text/babel" src="src/components/BatchImportView.js"></script>
    <script type="text/babel" src="src/components/DownloadsView.js"></script>"""
text = app_script_regex.sub(tag_to_insert, text, count=1)

with open('index_v2.html', 'w', encoding='utf-8') as f:
    f.write(text)
print("Downloads extracted successfully!")
