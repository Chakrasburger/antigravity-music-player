with open('index_v2.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Delete lines 3389 to 3493 (0-indexed: 3388 to 3493)
del lines[3388:3493]

with open('index_v2.html', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Deleted leftover PlaylistsView lines.")
