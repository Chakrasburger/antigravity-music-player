import os
import requests

def download_file(url, target_path):
    print(f"Downloading {url} to {target_path}...")
    response = requests.get(url, stream=True)
    if response.status_code == 200:
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        with open(target_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print("Success.")
    else:
        print(f"Failed to download {url}. Status code: {response.status_code}")

libs = {
    "https://unpkg.com/react@18/umd/react.production.min.js": "assets/lib/react.min.js",
    "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js": "assets/lib/react-dom.min.js",
    "https://unpkg.com/@babel/standalone/babel.min.js": "assets/lib/babel.min.js",
    "https://cdn.tailwindcss.com": "assets/lib/tailwind.min.js",
    "https://cdn.jsdelivr.net/npm/chart.js": "assets/lib/chart.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css": "assets/lib/fontawesome.min.css",
    "https://cdnjs.cloudflare.com/ajax/libs/jsmediatags/3.9.5/jsmediatags.min.js": "assets/lib/jsmediatags.min.js",
    "https://unpkg.com/dexie/dist/dexie.js": "assets/lib/dexie.js",
    "https://cdnjs.cloudflare.com/ajax/libs/color-thief/2.3.0/color-thief.umd.js": "assets/lib/color-thief.js"
}

base_dir = r"c:\Users\195058-0\Downloads\antigravity-music-player-master\antigravity-music-player-master"
os.chdir(base_dir)

for url, path in libs.items():
    download_file(url, path)

# FontAwesome also needs its webfonts folder for the css to work
webfonts_url = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/"
fonts = [
    "fa-brands-400.woff2", "fa-regular-400.woff2", "fa-solid-900.woff2",
    "fa-brands-400.ttf", "fa-regular-400.ttf", "fa-solid-900.ttf"
]

for font in fonts:
    download_file(webfonts_url + font, "assets/webfonts/" + font)
