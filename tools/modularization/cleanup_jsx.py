with open('index_v2.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Ranges to delete (0-indexed)
# 3038-3040 -> lines[3037:3040]
# 3052-3060 -> lines[3051:3060]
# 3072-3083 -> lines[3071:3083]

# Note: deleting from bottom to top to keep indices stable
del lines[3071:3083]
del lines[3051:3060]
del lines[3037:3040]

with open('index_v2.html', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Cleanup successful.")
