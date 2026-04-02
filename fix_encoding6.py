import os

filepath = "D:/LysiaETIC/frontend/src/pages/AICommandCenter.js"

with open(filepath, "rb") as f:
    raw = f.read()

# Remaining issue: emojis that start with "ğŸ" pattern
# ğ = U+011F = C4 9F in UTF-8
# The original emoji was F0 9F XX XX (4-byte UTF-8)
# After double-encoding: C3 B0 C2 9F C2 XX C2 XX
# The first fix script decoded C3 B0 -> but with cp1252,
# and then fix5 decoded further
# Let's check what "ğŸ" actually is in bytes now

# ğ = C4 9F, then what follows?
# Let's find all C4 9F occurrences and check context
print("=== Analyzing emoji patterns ===")
pos = 0
emoji_patterns = {}
count = 0
while True:
    pos = raw.find(b"\xc4\x9f", pos)
    if pos == -1:
        break
    # Check if this is part of an emoji (followed by specific bytes)
    # After partial fixes, the pattern might be:
    # C4 9F [some bytes for 0x9F decoded] [bytes for XX] [bytes for XX]
    ctx = raw[pos:pos+20]
    hex_str = " ".join("{:02X}".format(b) for b in ctx[:12])

    # Check if next bytes look like emoji continuation
    # The 9F byte was decoded via cp1252 to U+0178 (Ÿ) = C5 B8
    # Wait, but fix5 should have handled that...
    # Let me check: after fix5, what does the ğ + next bytes look like?

    if pos + 2 < len(raw):
        next_two = raw[pos+2:pos+4]
        # If followed by high bytes, likely emoji remnant
        if len(next_two) >= 1 and next_two[0] > 0x7F:
            key = hex_str[:20]
            if key not in emoji_patterns:
                emoji_patterns[key] = 0
                if len(emoji_patterns) <= 30:
                    txt = ctx[:12].decode("utf-8", errors="replace")
                    print("  @{}: {} = '{}'".format(pos, hex_str, txt))
            emoji_patterns[key] += 1
    count += 1
    pos += 1

print()
print("Total C4 9F occurrences:", count)
print("Unique patterns with high-byte followers:", len(emoji_patterns))

# Let's specifically look for the ğŸ pattern
# ğ = C4 9F, Ÿ would be... what in UTF-8?
# If the search tool shows "ğŸ" that means:
# ğ (C4 9F) followed by something that displays as Ÿ-like
# But Ÿ = U+0178 = C5 B8, or could be other things

# Let me search for C4 9F C5 B8 pattern (ğ + Ÿ)
print()
print("=== C4 9F C5 B8 pattern (partial emoji) ===")
pat = b"\xc4\x9f\xc5\xb8"
pos = 0
found = 0
while True:
    pos = raw.find(pat, pos)
    if pos == -1:
        break
    ctx = raw[pos:pos+16]
    hex_str = " ".join("{:02X}".format(b) for b in ctx)
    print("  @{}: {}".format(pos, hex_str))
    found += 1
    if found >= 10:
        break
    pos += 1
print("Total C4 9F C5 B8 occurrences:", raw.count(pat))

# So the emoji pattern is: C4 9F C5 B8 XX XX
# Original was: F0 9F XX XX
# Double encoded: C3 B0 C2 9F C2 XX C2 XX
# First fix (cp1252): C3 B0 -> ð (kept as-is or partially decoded)
# Actually, the first fix script used character-by-character approach
# C3 B0 = U+00F0 (ð), encode to latin-1 = byte F0
# C2 9F = U+009F, encode to latin-1 = byte 9F
# But U+009F in latin-1 IS byte 9F, so F0 9F would be decoded as UTF-8...
# F0 9F needs 2 more bytes. If the script grabbed 4 chars:
# U+00F0 U+009F U+00XX U+00XX -> latin1 bytes F0 9F XX XX -> UTF-8 decode = emoji
# But the script said it failed on U+2022 (bullet) which is > 0xFF
# So the fallback was used, which just kept chars as-is
#
# Then fix5 came along and found C3 B0 -> but wait, was C3 B0 still there?
# The first fix may have converted some chars but not others
#
# Actually looking at fix5 output: it found C3 B0 patterns and decoded them
# C3 B0 -> original_first = B0 + 40 = F0
# Then it looked for continuation bytes
# But the continuation bytes after the first fix were already partially decoded
#
# Hmm, let me just check: what is C4 9F C5 B8?
# C4 9F = ğ (U+011F)
# C5 B8 = Ÿ (U+0178)
#
# How did F0 9F become C4 9F C5 B8?
# F0 in cp1252 = U+00F0 (ð), UTF-8 = C3 B0
# 9F in cp1252 = U+0178 (Ÿ), UTF-8 = C5 B8
# So the first fix decoded F0 -> ð (C3 B0) and 9F -> Ÿ (C5 B8)
# Wait no, the ORIGINAL double-encoding was:
# F0 -> C3 B0 (UTF-8 of U+00F0)
# 9F -> C2 9F (UTF-8 of U+009F)
# Then the first fix script read C3 B0 as U+00F0, tried latin-1 encode -> byte F0
# And C2 9F as U+009F, tried latin-1 encode -> byte 9F
# Then tried to decode F0 9F as UTF-8 -> needs 4 bytes total, only had 2
# So it failed and kept the original chars
# Then fix5 found C3 B0 and decoded it as prefix for F0
# F0 needs 3 continuation bytes, each should be 80-BF
# Next byte after C3 B0 was C2 9F -> match_cp1252_byte found 9F -> 0x9F ✓
# Then next continuation... but wait, the original bytes after C2 9F were C2 XX C2 XX
# The first fix may have changed C2 XX too
#
# OK I think what happened is:
# Original double-encoded: C3 B0 C2 9F C2 A7 C2 A0 (for 🧠 F0 9F A7 A0)
# First fix (char by char with latin-1, failed, kept as-is): C3 B0 C2 9F C2 A7 C2 A0
# Fix5 found C3 B0 -> F0, then C2 9F -> 9F, then C2 A7 -> A7, then C2 A0 -> A0
# Result: F0 9F A7 A0 = 🧠 ✓
#
# But some emojis might have had their C2 9F converted by the first fix
# The first fix used encode('latin-1') which maps U+009F -> byte 0x9F
# But Python's latin-1 codec maps ALL U+0000-U+00FF to bytes 0x00-0xFF
# So U+009F -> 0x9F should work in latin-1 (unlike cp1252)
#
# Hmm but the first fix FAILED ("Full latin-1 re-encode failed") because of U+2022
# And used a buggy fallback. The fallback may have incorrectly handled some sequences.
#
# Let me just look at what we have and fix it directly.
# Pattern in file: C4 9F C5 B8 XX XX
# This should become: F0 9F XX XX (if XX XX are valid continuation bytes)
# But XX XX might also be partially decoded...

# Let me check what follows C4 9F C5 B8
print()
print("=== Full emoji remnant analysis ===")
pos = 0
while True:
    pos = raw.find(b"\xc4\x9f\xc5\xb8", pos)
    if pos == -1:
        break
    ctx = raw[pos:pos+20]
    hex_str = " ".join("{:02X}".format(b) for b in ctx)
    # Try to figure out what emoji this should be
    # C4 9F C5 B8 = was F0 9F, need 2 more bytes (each 80-BF)
    # The remaining bytes might be direct or cp1252-decoded
    print("  @{}: {}".format(pos, hex_str))
    pos += 1
