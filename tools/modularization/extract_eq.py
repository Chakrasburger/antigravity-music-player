import re

with open('index_v2.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Strip eqDescriptions and activeEqTooltip from App state
app_state_regex1 = re.compile(r'^[ \t]*const \[activeEqTooltip, setActiveEqTooltip\] = useState\(null\);\n', re.MULTILINE)
app_state_regex2 = re.compile(r'^[ \t]*const eqDescriptions = \{[\s\S]*?16000: ".*?\}\n[ \t]*};\n', re.MULTILINE)
text = app_state_regex1.sub('', text)
text = app_state_regex2.sub('', text)

# 2. Replace Equalizer block with component
eq_ui_regex = re.compile(r'<!-- EQ Section - Analog Mixing Console UI -->[\s\S]*?(?=<!-- Audio Output Section -->)', re.MULTILINE)

replacement_ui = """<!-- EQ Section - Analog Mixing Console UI -->
<Equalizer 
    isEqEnabled={isEqEnabled}
    toggleEq={toggleEq}
    eqPreset={eqPreset}
    applyEqPreset={applyEqPreset}
    eqBands={eqBands}
    handleEqChange={handleEqChange}
/>
"""

if eq_ui_regex.search(text):
    text = eq_ui_regex.sub(replacement_ui, text, count=1)
    
    # 3. Add script tag to head
    app_script_regex = re.compile(r'(<script type="text/babel" src="src/components/AnalyticsDashboard.js"></script>\n\s*<script type="text/babel">)')
    tag_to_insert = """<script type="text/babel" src="src/components/AnalyticsDashboard.js"></script>
    <script type="text/babel" src="src/components/Equalizer.js"></script>
    <script type="text/babel">"""
    text = app_script_regex.sub(tag_to_insert, text, count=1)

    with open('index_v2.html', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Equalizer extracted successfully.")
else:
    print("Could not find Equalizer UI block.")
