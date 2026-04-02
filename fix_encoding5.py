import os

filepath = "D:/LysiaETIC/frontend/src/pages/AICommandCenter.js"

with open(filepath, "rb") as f:
    raw = f.read()

# The first fix script partially decoded using cp1252 interpretation
# So bytes 80-9F got decoded to their cp1252 Unicode equivalents
# instead of staying as raw byte values.
#
# We need to reverse this: find sequences where a C3 XX prefix
# is followed by a cp1252-decoded character, and reconstruct
# the original UTF-8.
#
# cp1252 byte -> Unicode char -> UTF-8 bytes (what's in file now)
# 0x80 -> U+20AC -> E2 82 AC
# 0x81 -> U+0081 -> C2 81
# 0x82 -> U+201A -> E2 80 9A
# 0x83 -> U+0192 -> C6 92
# 0x84 -> U+201E -> E2 80 9E
# 0x85 -> U+2026 -> E2 80 A6
# 0x86 -> U+2020 -> E2 80 A0
# 0x87 -> U+2021 -> E2 80 A1
# 0x88 -> U+02C6 -> CB 86
# 0x89 -> U+2030 -> E2 80 B0
# 0x8A -> U+0160 -> C5 A0
# 0x8B -> U+2039 -> E2 80 B9
# 0x8C -> U+0152 -> C5 92
# 0x8D -> U+008D -> C2 8D
# 0x8E -> U+017D -> C5 BD
# 0x8F -> U+008F -> C2 8F
# 0x90 -> U+0090 -> C2 90
# 0x91 -> U+2018 -> E2 80 98
# 0x92 -> U+2019 -> E2 80 99
# 0x93 -> U+201C -> E2 80 9C
# 0x94 -> U+2014 -> E2 80 94
# 0x95 -> U+2022 -> E2 80 A2
# 0x96 -> U+2013 -> E2 80 93
# 0x97 -> U+2014 -> E2 80 94  (wait, same as 94?)
# Actually 0x97 -> U+2014 is wrong. Let me be precise:
# 0x97 -> U+02DC -> CB 9C  ... no
# Let me use Python to build the map properly

# Build reverse map: for each cp1252 byte 0x80-0x9F,
# what UTF-8 bytes does its Unicode codepoint produce?
import codecs

cp1252_to_utf8 = {}
for byte_val in range(0x80, 0xA0):
    try:
        char = bytes([byte_val]).decode('cp1252')
        utf8_bytes = char.encode('utf-8')
        cp1252_to_utf8[byte_val] = utf8_bytes
    except:
        cp1252_to_utf8[byte_val] = bytes([byte_val])

# Print the map for debugging
print("=== cp1252 byte -> UTF-8 bytes map ===")
for bv, ub in sorted(cp1252_to_utf8.items()):
    hex_str = " ".join("{:02X}".format(b) for b in ub)
    print("  0x{:02X} -> {}".format(bv, hex_str))

# Now build the reverse: UTF-8 bytes -> original cp1252 byte value
utf8_to_cp1252_byte = {}
for byte_val, utf8_bytes in cp1252_to_utf8.items():
    utf8_to_cp1252_byte[utf8_bytes] = byte_val

print()
print("=== Fixing file ===")

# Strategy: scan for C3 XX sequences where XX indicates a double-encoded prefix byte
# The double-encoded pattern is:
# Original UTF-8 byte pair: [first_byte] [second_byte]
# After double-encoding with cp1252 interpretation:
# [first_byte encoded as UTF-8] [second_byte decoded via cp1252 then encoded as UTF-8]
#
# For first_byte in C0-FF range: C3 (first_byte - 0x40) in UTF-8
# For second_byte in 80-9F range: cp1252 Unicode char's UTF-8 encoding
# For second_byte in A0-BF range: C2 (second_byte) in UTF-8 ... but first fix may have changed this too

# The first_byte prefixes we care about:
# C3 -> encoded as C3 83 (since C3 is U+00C3, UTF-8 = C3 83)
# C4 -> encoded as C3 84
# C5 -> encoded as C3 85
# C2 -> encoded as C3 82
# CE -> encoded as C3 8E
# E2 -> encoded as C3 A2

# For each, the second byte was decoded via cp1252 if in 80-9F range,
# or as C2 XX if in A0-BF range

# For 3-byte originals (E2 XX XX), there are TWO continuation bytes to fix

result = bytearray()
i = 0
fixes = 0

def match_cp1252_byte(raw, pos):
    """Try to match a cp1252-decoded byte at position pos in raw.
    Returns (original_byte_value, bytes_consumed) or None."""
    if pos >= len(raw):
        return None

    b = raw[pos]

    # If it's a simple byte A0-BF, it would be encoded as C2 XX
    if b == 0xC2 and pos + 1 < len(raw) and 0x80 <= raw[pos+1] <= 0xBF:
        return (raw[pos+1], 2)

    # For bytes 80-9F, they were decoded via cp1252 to Unicode chars
    # which then got UTF-8 encoded as multi-byte sequences
    # Try to match each known cp1252 UTF-8 sequence
    for byte_val in range(0x80, 0xA0):
        utf8_seq = cp1252_to_utf8[byte_val]
        seq_len = len(utf8_seq)
        if pos + seq_len <= len(raw) and raw[pos:pos+seq_len] == utf8_seq:
            return (byte_val, seq_len)

    return None

while i < len(raw):
    b = raw[i]

    # Check for C3 XX pattern where XX maps to a UTF-8 prefix byte
    if b == 0xC3 and i + 1 < len(raw):
        second = raw[i+1]
        # C3 83 = double-encoded C3 (Ã = U+00C3)
        # C3 84 = double-encoded C4 (Ä = U+00C4)
        # C3 85 = double-encoded C5 (Å = U+00C5)
        # C3 82 = double-encoded C2 (Â = U+00C2)
        # C3 A2 = double-encoded E2 (â = U+00E2)
        # C3 8E = double-encoded CE (Î = U+00CE)
        # C3 B0 = double-encoded F0 (ð = U+00F0) - for emojis

        original_first = second + 0x40  # reverse UTF-8 encoding of C3 XX

        if original_first in (0xC3, 0xC4, 0xC5, 0xC2, 0xCE):
            # 2-byte UTF-8 sequence: need 1 continuation byte
            m = match_cp1252_byte(raw, i + 2)
            if m:
                orig_second, consumed = m
                # Verify this makes a valid UTF-8 2-byte sequence
                if 0x80 <= orig_second <= 0xBF:
                    result.append(original_first)
                    result.append(orig_second)
                    fixes += 1
                    i += 2 + consumed
                    continue

        elif original_first == 0xE2:
            # 3-byte UTF-8 sequence: need 2 continuation bytes
            m1 = match_cp1252_byte(raw, i + 2)
            if m1:
                orig_second, consumed1 = m1
                m2 = match_cp1252_byte(raw, i + 2 + consumed1)
                if m2:
                    orig_third, consumed2 = m2
                    if 0x80 <= orig_second <= 0xBF and 0x80 <= orig_third <= 0xBF:
                        result.append(0xE2)
                        result.append(orig_second)
                        result.append(orig_third)
                        fixes += 1
                        i += 2 + consumed1 + consumed2
                        continue

        elif original_first == 0xF0:
            # 4-byte UTF-8 sequence (emojis): need 3 continuation bytes
            m1 = match_cp1252_byte(raw, i + 2)
            if m1:
                orig_b2, c1 = m1
                m2 = match_cp1252_byte(raw, i + 2 + c1)
                if m2:
                    orig_b3, c2 = m2
                    m3 = match_cp1252_byte(raw, i + 2 + c1 + c2)
                    if m3:
                        orig_b4, c3 = m3
                        if (0x80 <= orig_b2 <= 0xBF and
                            0x80 <= orig_b3 <= 0xBF and
                            0x80 <= orig_b4 <= 0xBF):
                            result.append(0xF0)
                            result.append(orig_b2)
                            result.append(orig_b3)
                            result.append(orig_b4)
                            fixes += 1
                            i += 2 + c1 + c2 + c3
                            continue

    result.append(b)
    i += 1

# Write result
with open(filepath, "wb") as f:
    f.write(bytes(result))

print("Fixes applied:", fixes)
print("File size before:", len(raw), "-> after:", len(result))

# Verify
text = bytes(result).decode("utf-8", errors="replace")
print()
print("=== Verification ===")
for char, name in [
    ("\u00f6", "o-umlaut"), ("\u00fc", "u-umlaut"), ("\u015f", "s-cedilla"),
    ("\u011f", "g-breve"), ("\u0131", "dotless-i"), ("\u0130", "capital-I-dot"),
    ("\u00c7", "C-cedilla"), ("\u00dc", "U-umlaut"), ("\u00d6", "O-umlaut"),
    ("\u015e", "S-cedilla"), ("\u2550", "box-double"), ("\u2014", "em-dash"),
    ("\u20ba", "lira-sign"), ("\u2500", "box-single"), ("\u2022", "bullet"),
]:
    count = text.count(char)
    status = "OK" if count > 0 else "MISSING"
    print("  {}: {} x{}".format(status, name, count))

# Check for remaining double-encoded patterns
remaining = 0
for prefix_byte in [0x83, 0x84, 0x85, 0x82, 0xA2, 0x8E, 0xB0]:
    pat = bytes([0xC3, prefix_byte])
    pos = 0
    while True:
        pos = bytes(result).find(pat, pos)
        if pos == -1:
            break
        # Check if followed by a cp1252-decoded sequence
        next_pos = pos + 2
        if next_pos < len(result):
            nb = result[next_pos]
            if nb in (0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xCB, 0xE2):
                remaining += 1
                if remaining <= 5:
                    ctx = bytes(result[max(0,pos-3):pos+10])
                    hex_str = " ".join("{:02X}".format(b) for b in ctx)
                    print("  REMAINING @{}: {}".format(pos, hex_str))
        pos += 1

if remaining == 0:
    print()
    print("SUCCESS: ALL encoding issues fixed!")
else:
    print()
    print("WARNING: {} potential issues remain".format(remaining))
