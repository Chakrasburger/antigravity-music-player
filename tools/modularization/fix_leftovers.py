with open('index_v2.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
for i, line in enumerate(lines):
    if "<h3 className=\"text-xl font-bold flex items-center gap-3\">" in line:
        start_idx = i - 1
        break

if start_idx != -1:
    end_idx = -1
    for i in range(start_idx, len(lines)):
        if "<SettingsView" in line:
            end_idx = i - 3  # The line with { is 2 lines above, the line before that is empty
            break

    if end_idx != -1:
        print(f"Deleting leftover lines from {start_idx} to {end_idx}")
        del lines[start_idx:end_idx+1]
        
        with open('index_v2.html', 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print("Done fixing syntax error!")
    else:
        print("Could not find end index.")
else:
    print("Could not find start index.")
