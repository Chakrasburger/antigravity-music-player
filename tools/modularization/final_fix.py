with open('index_v2.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if 3378 <= i <= 3451:
        continue # Skip deleting the leftover DownloadsView block
    
    new_lines.append(line)
    
    if i == 3369:
        if "/>" in line:
            # We are at line 3369! Insert the missing closure for PlaylistsView
            new_lines.append("                                    )}\n")
            print("Inserted )} at line 3369")

with open('index_v2.html', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Done fixing syntax error!")
