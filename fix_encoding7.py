import os, codecs

filepath = "D:/LysiaETIC/frontend/src/pages/AICommandCenter.js"

with open(filepath, "rb") as f:
    raw = f.read()

# Build cp1252 reverse map: UTF-8 bytes of cp1252-decoded char -> original byte
cp1252_utf8_to_byte = {}
for byte_val in range(0x80, 0xA0):
    try:
        char = bytes([byte_val]).decode('cp1252')
        utf8_bytes = char.encode('utf-8')
        cp1252_utf8_to_byte[utf8_bytes] = byte_val
    except:
        pass

# Also add direct C2 XX mappings for bytes A0-BF
for byte_val in range(0xA0, 0xC0):
    cp1252_utf8_to_byte[bytes([0xC2, byte_val])] = byte_val

# And single-byte pass-through for 80-FF that might appear directly
# (some bytes like 0x81, 0x8D, 0x8F, 0x90, 0x9D map to themselves in cp1252)

def try_decode_cp1252_byte(data, pos):
    """Try to match a cp1252-decoded byte at position. Returns (original_byte, consumed) or None."""
    if pos >= len(data):
        return None
    # Try longest matches first (3-byte UTF-8 sequences from cp1252)
    for length in (3, 2, 1):
        if pos + length <= len(data):
            chunk = bytes(data[pos:pos+length])
            if chunk in cp1252_utf8_to_byte:
                return (cp1252_utf8_to_byte[chunk], length)
    return None

# The emoji pattern in the file:
# C4 9F C5 B8 [byte3_encoded] [byte4_encoded]
# This represents F0 9F XX XX where:
# F0 was double-encoded and partially fixed to become C4 9F (ğ)
# 9F was cp1252-decoded to U+0178 (Ÿ) = C5 B8
# XX bytes are cp1252-decoded continuation bytes

# Actually let me verify: C4 9F = ğ (U+011F)
# How did F0 become C4 9F?
# F0 in UTF-8 double-encoding: F0 -> C3 B0 (UTF-8 of U+00F0)
# The first fix script's buggy fallback may have done something weird
# OR fix5 decoded C3 B0 incorrectly
# C3 B0: original_first = B0 + 40 = F0, then looked for continuation
# But F0 starts a 4-byte sequence needing 3 continuation bytes
# If it couldn't find valid continuations, it would have skipped
# and just kept C3 B0 as-is
# Then... hmm
#
# Wait - maybe the first fix DID partially work on some emoji bytes
# The first fix tried char-by-char latin-1 encode:
# C3 B0 = U+00F0, latin-1 encode = byte F0
# C2 9F = U+009F, latin-1 encode = byte 9F
# These two bytes F0 9F start a 4-byte UTF-8 sequence
# The script then needed 2 more bytes:
# C2 A7 = U+00A7, latin-1 = byte A7
# C2 A0 = U+00A0, latin-1 = byte A0
# F0 9F A7 A0 = valid UTF-8 for U+1F9E0 (🧠)
# So the first fix SHOULD have decoded this correctly...
# Unless the next bytes weren't C2 XX but something else
#
# But the first fix FAILED entirely ("Full latin-1 re-encode failed")
# because somewhere in the file there was a char > U+00FF (like U+2022 bullet)
# that can't be encoded to latin-1.
# The fallback was character-by-character and was BUGGY.
#
# OK forget the analysis. The pattern is clear from the data:
# C4 9F C5 B8 = should be F0 9F (start of 4-byte emoji)
# Followed by 2 more cp1252-encoded continuation bytes
# Let me just fix this pattern.

result = bytearray()
i = 0
fixes = 0

while i < len(raw):
    # Check for emoji pattern: C4 9F C5 B8 [cont1] [cont2]
    if (i + 3 < len(raw) and
        raw[i] == 0xC4 and raw[i+1] == 0x9F and
        raw[i+2] == 0xC5 and raw[i+3] == 0xB8):

        # This is F0 9F ..., need 2 more continuation bytes
        m1 = try_decode_cp1252_byte(raw, i + 4)
        if m1:
            byte3, consumed1 = m1
            m2 = try_decode_cp1252_byte(raw, i + 4 + consumed1)
            if m2:
                byte4, consumed2 = m2
                if 0x80 <= byte3 <= 0xBF and 0x80 <= byte4 <= 0xBF:
                    # Valid emoji!
                    result.append(0xF0)
                    result.append(0x9F)
                    result.append(byte3)
                    result.append(byte4)
                    fixes += 1
                    i += 4 + consumed1 + consumed2
                    continue

    result.append(raw[i])
    i += 1

with open(filepath, "wb") as f:
    f.write(bytes(result))

print("Emoji fixes applied:", fixes)
print("File size:", len(raw), "->", len(result))

# Verify emojis
text = bytes(result).decode("utf-8", errors="replace")

# Check for specific emojis
emoji_checks = [
    ("\U0001f9e0", "brain"),
    ("\U0001f4b0", "money-bag"),
    ("\U0001f4cb", "clipboard"),
    ("\U0001f4e6", "package"),
    ("\U0001f4c8", "chart-up"),
    ("\U0001f525", "fire"),
    ("\U0001f6a8", "siren"),
    ("\U0001f4b8", "money-wings"),
    ("\U0001f3af", "target"),
    ("\U0001f680", "rocket"),
    ("\U0001f4ca", "bar-chart"),
    ("\U0001f4a1", "lightbulb"),
    ("\U0001f4a4", "zzz"),
    ("\U0001f534", "red-circle"),
    ("\U0001f3c6", "trophy"),
    ("\U0001f4b5", "dollar"),
    ("\U0001f6d2", "cart"),
    ("\U0001f404", "cow"),
    ("\U0001f415", "dog"),
    ("\U0001f4c9", "chart-down"),
    ("\U0001f947", "gold-medal"),
    ("\U0001f948", "silver-medal"),
    ("\U0001f949", "bronze-medal"),
    ("\U0001f4b4", "yen"),
    ("\U0001f50d", "magnify"),
    ("\U0001f48a", "pill"),
    ("\U0001f6ab", "prohibited"),
    ("\U0001f3f7", "label"),
]

found_emojis = 0
for emoji, name in emoji_checks:
    c = text.count(emoji)
    if c > 0:
        print("  OK: {} ({}) x{}".format(name, emoji, c))
        found_emojis += c

print()
print("Total emojis found:", found_emojis)

# Check if any C4 9F C5 B8 patterns remain
remaining = bytes(result).count(b"\xc4\x9f\xc5\xb8")
if remaining == 0:
    print("SUCCESS: All emoji patterns fixed!")
else:
    print("WARNING: {} emoji patterns remain".format(remaining))
    # Show first few
    pos = 0
    shown = 0
    while shown < 5:
        pos = bytes(result).find(b"\xc4\x9f\xc5\xb8", pos)
        if pos == -1:
            break
        ctx = bytes(result[pos:pos+16])
        hex_str = " ".join("{:02X}".format(b) for b in ctx)
        print("  @{}: {}".format(pos, hex_str))
        shown += 1
        pos += 1

# Also verify Turkish chars still OK
print()
for char, name in [
    ("\u015f", "s-cedilla"), ("\u011f", "g-breve"),
    ("\u00d6", "O-umlaut"), ("\u00dc", "U-umlaut"), ("\u00c7", "C-cedilla"),
]:
    count = text.count(char)
    print("  {}: {} x{}".format("OK" if count > 0 else "MISSING", name, count))
