import os

filepath = "D:/LysiaETIC/frontend/src/pages/AICommandCenter.js"

with open(filepath, "rb") as f:
    raw = f.read()

print("File size:", len(raw), "bytes")
print()

# Search for double-encoded byte patterns and show context
print("=== Searching for byte patterns ===")
patterns = {
    "C3 85 (start of double-enc C5)": b"\xc3\x85",
    "C3 84 (start of double-enc C4)": b"\xc3\x84",
    "C3 83 (start of double-enc C3)": b"\xc3\x83",
    "C3 A2 (start of double-enc E2)": b"\xc3\xa2",
    "C3 82 (start of double-enc C2)": b"\xc3\x82",
    "C3 8E (start of double-enc CE)": b"\xc3\x8e",
    "C4 9F (correct g-breve)": b"\xc4\x9f",
    "C5 9F (correct s-cedilla)": b"\xc5\x9f",
    "C3 96 (correct O-umlaut)": b"\xc3\x96",
    "C3 9C (correct U-umlaut)": b"\xc3\x9c",
    "C3 87 (correct C-cedilla)": b"\xc3\x87",
    "E2 95 90 (correct box-dbl)": b"\xe2\x95\x90",
    "E2 80 94 (correct em-dash)": b"\xe2\x80\x94",
    "E2 82 BA (correct lira)": b"\xe2\x82\xba",
    "E2 94 80 (correct box-sgl)": b"\xe2\x94\x80",
    "E2 80 A2 (correct bullet)": b"\xe2\x80\xa2",
}

for name, pat in patterns.items():
    count = 0
    pos = 0
    first_pos = -1
    while True:
        pos = raw.find(pat, pos)
        if pos == -1:
            break
        if first_pos == -1:
            first_pos = pos
        count += 1
        pos += 1
    if count > 0:
        ctx = raw[max(0,first_pos-4):first_pos+len(pat)+8]
        hex_str = " ".join("{:02X}".format(b) for b in ctx)
        print("  {}: {} occ, first@{}: {}".format(name, count, first_pos, hex_str))
    else:
        print("  {}: NOT FOUND".format(name))

# Now look for "ba" followed by high bytes (corrupted "bas" in Turkish)
print()
print("=== Context around 'ba' + high byte (corrupted basarisiz etc) ===")
pos = 0
found = 0
while found < 5:
    pos = raw.find(b"ba", pos)
    if pos == -1:
        break
    if pos + 2 < len(raw) and raw[pos+2] > 0x7F:
        ctx = raw[pos:pos+16]
        hex_str = " ".join("{:02X}".format(b) for b in ctx)
        print("  @{}: {}".format(pos, hex_str))
        found += 1
    pos += 1

# Look for what comes after C3 83 (double-encoded C3 prefix)
print()
print("=== All C3 83 occurrences with context ===")
pos = 0
found = 0
while found < 15:
    pos = raw.find(b"\xc3\x83", pos)
    if pos == -1:
        break
    ctx = raw[max(0,pos-4):pos+10]
    hex_str = " ".join("{:02X}".format(b) for b in ctx)
    print("  @{}: {}".format(pos, hex_str))
    found += 1
    pos += 1

# Look for C3 A2 (double-encoded E2 prefix for box/special chars)
print()
print("=== First 10 C3 A2 occurrences with context ===")
pos = 0
found = 0
while found < 10:
    pos = raw.find(b"\xc3\xa2", pos)
    if pos == -1:
        break
    ctx = raw[pos:pos+12]
    hex_str = " ".join("{:02X}".format(b) for b in ctx)
    print("  @{}: {}".format(pos, hex_str))
    found += 1
    pos += 1

# Look for C3 85 (double-encoded C5 prefix for s-cedilla)
print()
print("=== First 5 C3 85 occurrences with context ===")
pos = 0
found = 0
while found < 5:
    pos = raw.find(b"\xc3\x85", pos)
    if pos == -1:
        break
    ctx = raw[pos:pos+12]
    hex_str = " ".join("{:02X}".format(b) for b in ctx)
    print("  @{}: {}".format(pos, hex_str))
    found += 1
    pos += 1
