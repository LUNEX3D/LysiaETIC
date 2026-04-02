import os
import re

filepath = "D:/LysiaETIC/frontend/src/pages/AICommandCenter.js"

with open(filepath, "rb") as f:
    raw = f.read()

# Remove BOM if present
if raw[:3] == b'\xef\xbb\xbf':
    raw = raw[3:]
    print("BOM removed")

# Decode as UTF-8
text = raw.decode("utf-8")

# Build replacement map for double-encoded sequences
# When UTF-8 bytes are misread as Latin-1 then re-encoded as UTF-8:
# Original char -> UTF-8 bytes -> misread as Latin-1 chars -> re-encoded as UTF-8
replacements = {
    # Turkish lowercase
    "\u00c3\u00b6": "\u00f6",      # ö
    "\u00c3\u00bc": "\u00fc",      # ü
    "\u00c5\u009f": "\u015f",      # ş
    "\u00c4\u009f": "\u011f",      # ğ
    "\u00c4\u00b1": "\u0131",      # ı
    "\u00c3\u00a7": "\u00e7",      # ç
    # Turkish uppercase
    "\u00c4\u00b0": "\u0130",      # İ
    "\u00c3\u0087": "\u00c7",      # Ç  (C3 87)
    "\u00c3\u009c": "\u00dc",      # Ü  (C3 9C)
    "\u00c3\u0096": "\u00d6",      # Ö  (C3 96)
    "\u00c5\u009e": "\u015e",      # Ş
    # Box drawing double line
    "\u00e2\u0095\u0090": "\u2550",  # ═
    # Box drawing single line
    "\u00e2\u0094\u0080": "\u2500",  # ─
    # Em dash
    "\u00e2\u0080\u0094": "\u2014",  # —
    # Bullet
    "\u00e2\u0080\u00a2": "\u2022",  # •
    # Lira sign
    "\u00e2\u0082\u00ba": "\u20ba",  # ₺
    # Arrows
    "\u00e2\u0086\u0091": "\u2191",  # ↑
    "\u00e2\u0086\u0093": "\u2193",  # ↓
    # Check mark
    "\u00e2\u009c\u0085": "\u2705",  # ✅ (actually emoji)
    "\u00e2\u009c\u0094": "\u2714",  # ✔
    # Ellipsis
    "\u00e2\u0080\u00a6": "\u2026",  # …
    # Left/right quotes
    "\u00e2\u0080\u009c": "\u201c",  # "
    "\u00e2\u0080\u009d": "\u201d",  # "
    "\u00e2\u0080\u0098": "\u2018",  # '
    "\u00e2\u0080\u0099": "\u2019",  # '
    # Multiplication sign
    "\u00c3\u0097": "\u00d7",        # ×
    # Middle dot
    "\u00c2\u00b7": "\u00b7",        # ·
    # Plus-minus
    "\u00c2\u00b1": "\u00b1",        # ±
    # Degree
    "\u00c2\u00b0": "\u00b0",        # °
    # Delta (Greek)
    "\u00ce\u0094": "\u0394",        # Δ
    # Gear/cog emoji ⚙️
    "\u00e2\u009a\u0099": "\u2699",  # ⚙
    # Warning sign ⚠
    "\u00e2\u009a\u00a0": "\u26a0",  # ⚠
    # Star ⭐ - this is a multi-byte emoji
    # Various emojis that got corrupted (4-byte UTF-8 -> 4 latin-1 chars -> 4x2=8 bytes)
}

# Now handle the corrupted emojis - these are 4-byte UTF-8 sequences
# Pattern: F0 9F XX XX -> C3 B0 C5 B8 ... (double encoded)
# We need to catch the \u00c3\u00b0\u00c5\u00b8... pattern for emojis

# First, let's do a smarter approach: try to fix chunks
# For each sequence of chars > 127, try latin-1 decode
def fix_mixed_encoding(text):
    result = []
    i = 0
    length = len(text)

    while i < length:
        ch = text[i]

        # Check if this starts a double-encoded sequence
        # Double-encoded chars have high bytes (>= 0x80) when encoded to latin-1
        if ord(ch) >= 0xc0 and ord(ch) <= 0xf4:
            # This might be the start of a double-encoded sequence
            # Try to grab enough chars and decode
            best_match = None
            for end in range(i + 2, min(i + 8, length + 1)):
                chunk = text[i:end]
                try:
                    # Try to encode as latin-1 and decode as utf-8
                    decoded = chunk.encode("latin-1").decode("utf-8")
                    best_match = (end, decoded)
                    break
                except (UnicodeEncodeError, UnicodeDecodeError):
                    continue

            if best_match:
                end, decoded = best_match
                result.append(decoded)
                i = end
                continue

        # Check for \u00c3 pattern (first byte of double-encoded 2-byte UTF-8)
        if ch == "\u00c3" and i + 1 < length:
            next_ch = text[i + 1]
            try:
                pair = (ch + next_ch).encode("latin-1").decode("utf-8")
                result.append(pair)
                i += 2
                continue
            except (UnicodeEncodeError, UnicodeDecodeError):
                pass

        # Check for \u00c4 or \u00c5 pattern (first byte of double-encoded 2-byte UTF-8)
        if ch in ("\u00c4", "\u00c5") and i + 1 < length:
            next_ch = text[i + 1]
            try:
                pair = (ch + next_ch).encode("latin-1").decode("utf-8")
                result.append(pair)
                i += 2
                continue
            except (UnicodeEncodeError, UnicodeDecodeError):
                pass

        # Check for \u00c2 pattern (double-encoded single high byte like ·, ±, °)
        if ch == "\u00c2" and i + 1 < length:
            next_ch = text[i + 1]
            try:
                pair = (ch + next_ch).encode("latin-1").decode("utf-8")
                result.append(pair)
                i += 2
                continue
            except (UnicodeEncodeError, UnicodeDecodeError):
                pass

        # Check for \u00ce pattern (Greek letters like Delta)
        if ch == "\u00ce" and i + 1 < length:
            next_ch = text[i + 1]
            try:
                pair = (ch + next_ch).encode("latin-1").decode("utf-8")
                result.append(pair)
                i += 2
                continue
            except (UnicodeEncodeError, UnicodeDecodeError):
                pass

        # Check for \u00e2 pattern (3-byte UTF-8 sequences like ═, —, •, ₺, ⚙, ⚠)
        if ch == "\u00e2" and i + 2 < length:
            try:
                triple = text[i:i+3].encode("latin-1").decode("utf-8")
                result.append(triple)
                i += 3
                continue
            except (UnicodeEncodeError, UnicodeDecodeError):
                pass

        # Check for \u00c3\u00b0 pattern (start of 4-byte emoji sequences)
        if ch == "\u00c3" and i + 1 < length and text[i+1] == "\u00b0":
            # This is likely a double-encoded 4-byte UTF-8 (emoji)
            # F0 -> C3 B0, then next bytes also double-encoded
            # F0 9F XX XX -> C3 B0 | C2 9F | C2 XX | C2 XX (or similar)
            # Try various lengths
            for end in range(i + 4, min(i + 12, length + 1)):
                chunk = text[i:end]
                try:
                    decoded = chunk.encode("latin-1").decode("utf-8")
                    result.append(decoded)
                    i = end
                    break
                except (UnicodeEncodeError, UnicodeDecodeError):
                    continue
            else:
                result.append(ch)
                i += 1
            continue

        result.append(ch)
        i += 1

    return "".join(result)

print("Fixing mixed encoding...")
fixed = fix_mixed_encoding(text)

# Write back as UTF-8 without BOM
with open(filepath, "wb") as f:
    f.write(fixed.encode("utf-8"))

before_size = len(raw)
after_size = len(fixed.encode("utf-8"))
print("File size before: " + str(before_size) + " bytes")
print("File size after: " + str(after_size) + " bytes")

# Verify Turkish chars
for char, name in [
    ("\u00f6", "o-umlaut"),
    ("\u00fc", "u-umlaut"),
    ("\u015f", "s-cedilla"),
    ("\u011f", "g-breve"),
    ("\u0131", "dotless-i"),
    ("\u0130", "capital-I-dot"),
    ("\u00c7", "C-cedilla"),
    ("\u00dc", "U-umlaut"),
    ("\u00d6", "O-umlaut"),
    ("\u015e", "S-cedilla"),
    ("\u2550", "box-double"),
    ("\u2014", "em-dash"),
    ("\u20ba", "lira-sign"),
    ("\u2500", "box-single"),
]:
    count = fixed.count(char)
    if count > 0:
        print("  OK: " + name + " found " + str(count) + " times")
    else:
        print("  MISSING: " + name)

# Check for remaining corrupted patterns
remaining = 0
for bad in ["\u00c3\u00b6", "\u00c3\u00bc", "\u00c5\u009f", "\u00c4\u009f",
            "\u00c4\u00b1", "\u00c4\u00b0", "\u00c3\u009c", "\u00c3\u0096"]:
    c = fixed.count(bad)
    if c > 0:
        remaining += c
        print("  STILL BAD: " + repr(bad) + " x" + str(c))

if remaining == 0:
    print("")
    print("SUCCESS: All Turkish characters fixed!")
else:
    print("")
    print("WARNING: " + str(remaining) + " corrupted sequences remain")
