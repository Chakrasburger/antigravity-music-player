import re

with open('index_v2.html', 'r', encoding='utf-8') as f:
    text = f.read()

analytics_regex = re.compile(r'\n[ \t]*const AnalyticsDashboard = \(\{ library \}\) => \{.*?(?=\n[ \t]*const root = ReactDOM\.createRoot)', re.DOTALL)

script_tag = """
        // Componentes extraídos
        // AnalyticsDashboard se carga desde src/components/AnalyticsDashboard.js
"""

if analytics_regex.search(text):
    text = analytics_regex.sub(script_tag, text, count=1)
    # Now we need to add the <script type="text/babel" src="src/components/AnalyticsDashboard.js"></script>
    # right before <script type="text/babel"> (the main app script).
    # It is right after `<!-- React Application -->`
    app_script_regex = re.compile(r'(<!-- React Application -->\n\s*<script type="text/babel">)')
    tag_to_insert = """<!-- React Application -->
    <!-- FASE 5: Componentes React con Babel standalone -->
    <script type="text/babel" src="src/components/AnalyticsDashboard.js"></script>
    <script type="text/babel">"""
    
    text = app_script_regex.sub(tag_to_insert, text, count=1)
    
    with open('index_v2.html', 'w', encoding='utf-8') as f:
        f.write(text)
    print("AnalyticsDashboard extracted successfully.")
else:
    print("Could not find AnalyticsDashboard.")
