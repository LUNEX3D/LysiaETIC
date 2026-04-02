import os

filepath = "D:/LysiaETIC/frontend/src/pages/AICommandCenter.js"

# Read raw bytes
with open(filepath, "rb") as f:
    raw = f.read()

# Remove BOM if present
if raw[:3] == b'\xef\xbb\xbf':
    raw = raw[3:]

# The problem: some sequences were triple-encoded or partially fixed
# Strategy: scan byte by byte looking for C3/C4/C5/C2/CE/E2 sequences
# that indicate double-encoded UTF-8, and fix them

result = bytearray()
i = 0
fixes = 0

while i < len(raw):
    b = raw[i]

    # Check for 3-byte double-encoded sequences (E2 XX XX encoded as C3 A2 + ...)
    # Actually in the file the E2-based chars show as: C3 A2 C2 80 C2 XX or similar
    # But after first fix pass, they might be: E2 80 94 (correct) or still broken

    # Pattern: C3 followed by 80-BF = double-encoded 2-byte UTF-8
    # C3 83 C2 XX = triple encoded (C3 XX was double-encoded, then C3 83 C2 XX is triple)

    # Let's check for the actual patterns we see in search results:
    # "ÅŸ" = C5 9F but showing as C3 85 C5 B8 ... no
    # Let me think differently.

    # The search results show these corrupted strings (as they appear when read as UTF-8):
    # "ÅŸ" -> this is bytes C3 85 C5 B8? No...
    # When I see "ÅŸ" in the search output, that's the tool showing me what's in the file
    # "Å" = U+00C5 = byte C3 85 in UTF-8
    # "Ÿ" = U+0178 = bytes C5 B8 in UTF-8  ... wait that doesn't match
    # Actually "ÅŸ" = "Å" + "Ÿ"
    # "Å" = U+00C5, UTF-8: C3 85
    # "Ÿ" = U+009F ... but that's a control char. In UTF-8 it would be C2 9F
    # So "ÅŸ" in the file = bytes C3 85 C2 9F
    # Original: ş = U+015F = UTF-8 bytes C5 9F
    # Double encoded: C5 -> C3 85, 9F -> C2 9F => C3 85 C2 9F
    # So the file has C3 85 C2 9F where it should have C5 9F

    # Similarly:
    # "ÄŸ" = Ä + Ÿ = U+00C4 + U+009F
    # In file bytes: C3 84 C2 9F, should be: C4 9F (ğ)

    # "Ã–" = Ã + – ... wait
    # "Ã" = U+00C3, "–" = U+0096 (control char)
    # In file bytes: C3 83 C2 96, should be: C3 96 (Ö)
    # But wait, C3 83 is "Ã" and C2 96 is a control char
    # So this is TRIPLE encoded! Original C3 96 -> double: C3 83 C2 96

    # "Ãœ" = Ã + œ = U+00C3 + U+0153
    # Hmm, "œ" = U+0153 = C5 93 in UTF-8... that's 2 bytes
    # Actually let me re-examine. The search shows "Ãœ"
    # "Ã" = U+00C3 = C3 83 in UTF-8
    # "œ" ... wait, is it "Ã" + "œ" or "Ã" + "\x9C"?
    # U+009C = C2 9C in UTF-8
    # So "Ãœ" in file = C3 83 C2 9C, should be C3 9C (Ü)

    # "Ã‡" = "Ã" + "‡"
    # "‡" = U+2021? No that would be E2 80 A1
    # Actually U+0087 = C2 87 in UTF-8
    # So "Ã‡" = C3 83 C2 87, should be C3 87 (Ç)

    # For box drawing "â•" = â + • + ...
    # "â" = U+00E2 = C3 A2 in UTF-8
    # "•" could be various things
    # ═ = U+2550 = E2 95 90
    # Double encoded: E2->C3 A2, 95->C2 95, 90->C2 90
    # So "â•" prefix = C3 A2 C2 95, full ═ = C3 A2 C2 95 C2 90

    # "â€"" = em dash — = U+2014 = E2 80 94
    # Double: C3 A2 C2 80 C2 94

    # "â‚º" = ₺ = U+20BA = E2 82 BA
    # Double: C3 A2 C2 82 C2 BA

    # "â"€" = ─ = U+2500 = E2 94 80
    # Double: C3 A2 C2 94 C2 80

    # "âœ…" = ✅ = U+2705 = E2 9C 85
    # Double: C3 A2 C2 9C C2 85

    # Emojis "ğŸ" prefix:
    # "ğ" = U+011F = C4 9F in UTF-8
    # "Ÿ" = U+009F = C2 9F in UTF-8
    # Wait, that means the first fix converted part of the emoji
    # Original emoji e.g. 🧠 = F0 9F A7 A0
    # Double encoded: F0->C3 B0, 9F->C2 9F, A7->C2 A7, A0->C2 A0
    # First fix script converted C3 B0 C2 9F...
    # C3 B0 = ð (U+00F0), but the script converted C4 9F to ğ
    # Hmm, that means C3 B0 wasn't there, or the first script partially decoded
    # Let me check: if C3 B0 was decoded to F0 (as latin1->utf8 for 2-byte),
    # then C2 9F decoded to 9F, giving F0 9F... but then A7 A0 also need fixing
    # The first script's character-by-character approach may have partially fixed things

    # OK let me just do this pragmatically with the ACTUAL byte patterns in the file

    # === 4-byte pattern: C3 8x C2 xx (double-encoded C3 xx, i.e. Ö Ü Ç etc) ===
    if b == 0xC3 and i + 3 < len(raw) and raw[i+1] == 0x83 and raw[i+2] == 0xC2:
        # This is double-encoded: original was C3 XX, became C3 83 C2 XX
        original_second = raw[i+3]
        result.append(0xC3)
        result.append(original_second)
        fixes += 1
        i += 4
        continue

    # === 4-byte pattern: C3 85 C2 xx (double-encoded C5 xx, i.e. ş Ş) ===
    if b == 0xC3 and i + 3 < len(raw) and raw[i+1] == 0x85 and raw[i+2] == 0xC2:
        original_second = raw[i+3]
        result.append(0xC5)
        result.append(original_second)
        fixes += 1
        i += 4
        continue

    # === 4-byte pattern: C3 84 C2 xx (double-encoded C4 xx, i.e. ğ ı İ) ===
    if b == 0xC3 and i + 3 < len(raw) and raw[i+1] == 0x84 and raw[i+2] == 0xC2:
        original_second = raw[i+3]
        result.append(0xC4)
        result.append(original_second)
        fixes += 1
        i += 4
        continue

    # === 4-byte pattern: C3 82 C2 xx (double-encoded C2 xx, i.e. · ° ±) ===
    if b == 0xC3 and i + 3 < len(raw) and raw[i+1] == 0x82 and raw[i+2] == 0xC2:
        original_second = raw[i+3]
        result.append(0xC2)
        result.append(original_second)
        fixes += 1
        i += 4
        continue

    # === 4-byte pattern: C3 8E C2 xx (double-encoded CE xx, i.e. Greek Δ) ===
    if b == 0xC3 and i + 3 < len(raw) and raw[i+1] == 0x8E and raw[i+2] == 0xC2:
        original_second = raw[i+3]
        result.append(0xCE)
        result.append(original_second)
        fixes += 1
        i += 4
        continue

    # === 6-byte pattern: C3 A2 C2 xx C2 xx (double-encoded E2 xx xx, i.e. ═ — ₺ ─ ✅ • etc) ===
    if b == 0xC3 and i + 5 < len(raw) and raw[i+1] == 0xA2 and raw[i+2] == 0xC2 and raw[i+4] == 0xC2:
        b2 = raw[i+3]
        b3 = raw[i+5]
        result.append(0xE2)
        result.append(b2)
        result.append(b3)
        fixes += 1
        i += 6
        continue

    # === 8-byte pattern for emojis: partially decoded ===
    # After first fix, emojis might be: C4 9F + remaining bytes
    # Original 4-byte emoji F0 9F XX XX was double-encoded as:
    # C3 B0 C2 9F C2 XX C2 XX (8 bytes)
    # First fix converted C4 9F (ğ) from... hmm
    # Actually let me check what "ğŸ" is in bytes
    # ğ = U+011F = C4 9F
    # Ÿ = U+0178 = C5 B8 ... or is it U+009F = C2 9F?
    # The display shows "ğŸ" which in UTF-8 would be C4 9F + ...
    # If the next char is displayed as "Ÿ" that could be various things
    # Let me just check the actual bytes around known emoji positions

    # For emojis, the pattern after partial fix might be:
    # The first script converted C3 B0 -> but wait, C3 B0 = U+00F0 = ð
    # If the script tried to fix C3 B0 as a 2-byte sequence, it would have
    # looked for C3 B0 and decoded it to U+00F0 (ð), not ğ
    # But search shows "ğŸ" which is C4 9F ...
    # Hmm, C4 9F is ğ (U+011F). That's NOT what C3 B0 decodes to.
    # C3 B0 in latin-1 decode = bytes C3 B0 -> latin1 chars \xC3\xB0 ->
    # No wait. The first script did: text.encode('latin-1').decode('utf-8') char by char
    # For the emoji F0 9F A7 A0, double-encoded bytes are: C3 B0 C2 9F C2 A7 C2 A0
    # Read as UTF-8: C3 B0 = U+00F0 (ð), C2 9F = U+009F, C2 A7 = U+00A7 (§), C2 A0 = U+00A0 (nbsp)
    # The first script tried encode('latin-1') on each char:
    # U+00F0 -> latin1 byte F0 ✓
    # U+009F -> latin1 byte 9F ✓
    # U+00A7 -> latin1 byte A7 ✓
    # U+00A0 -> latin1 byte A0 ✓
    # Then decode F0 9F A7 A0 as UTF-8 = U+1F9E0 = 🧠 ✓
    # So the first script SHOULD have fixed emojis... unless it failed
    # The first script said "Full latin-1 re-encode failed" because of U+2022 (•)
    # which is > U+00FF and can't be encoded to latin-1
    # So it used the character-by-character fallback which was buggy

    # Let me check: what does "ğŸ" actually look like in bytes?
    # If the file has C4 9F C5 B8 that would be ğ + Ÿ(U+0178)
    # But C4 9F is ğ which is a valid Turkish char
    # The first script may have incorrectly decoded C3 B0 C2 9F as C4 9F (ğ)
    # because C3 B0 -> latin1 -> 0xC3 0xB0 ... no that's not right

    # Actually I think what happened is:
    # C3 B0 was decoded as UTF-8 char U+00F0
    # Then the script tried to find a 2-char sequence starting with U+00F0
    # U+00F0 can't be encoded to latin-1 (it CAN, F0 is in latin-1 range)
    # So U+00F0 -> latin1 byte 0xF0
    # Then with next char U+009F -> latin1 byte 0x9F
    # F0 9F needs 2 more bytes for valid UTF-8 (it's a 4-byte sequence start)
    # So the 2-char decode failed, and it fell through to single char
    # U+00F0 -> just kept as is? Or the fallback was broken

    # I think the emojis got mangled by the first script's fallback
    # Let me just look for the actual byte pattern of "ğŸ" in the file

    # ğ = C4 9F, then what follows?
    # If I see C4 9F followed by something that looks like emoji continuation...
    # Actually, the first script's fallback just appended text[i] for failures
    # So C3 B0 (U+00F0 = ð) stayed as ð, and C2 9F (U+009F) stayed
    # But search shows "ğŸ" not "ðŸ"...
    # Unless the SECOND script (fix_encoding2.py) did something
    # fix_encoding2.py had replacement "\u00c3\u00b0\u00c2\u009f..." but found 0 matches
    # Because the first script already changed the bytes!

    # OK I need to just look at actual bytes. Let me handle this differently.
    # Let me just output the file and check specific positions.
    pass

    result.append(b)
    i += 1

# Write result
with open(filepath, "wb") as f:
    f.write(bytes(result))

print("Fixes applied: " + str(fixes))
print("File size: " + str(len(result)) + " bytes")

# Verify
text = bytes(result).decode("utf-8")
for char, name in [
    ("\u00f6", "o-umlaut"), ("\u00fc", "u-umlaut"), ("\u015f", "s-cedilla"),
    ("\u011f", "g-breve"), ("\u0131", "dotless-i"), ("\u0130", "capital-I-dot"),
    ("\u00c7", "C-cedilla"), ("\u00dc", "U-umlaut"), ("\u00d6", "O-umlaut"),
    ("\u015e", "S-cedilla"), ("\u2550", "box-double"), ("\u2014", "em-dash"),
    ("\u20ba", "lira-sign"), ("\u2500", "box-single"), ("\u2022", "bullet"),
]:
    count = text.count(char)
    if count > 0:
        print("  OK: " + name + " x" + str(count))
    else:
        print("  MISSING: " + name)

# Check for remaining corrupted patterns
bad = 0
for pattern_name, bseq in [
    ("C3 83 C2", bytes([0xC3, 0x83, 0xC2])),
    ("C3 84 C2", bytes([0xC3, 0x84, 0xC2])),
    ("C3 85 C2", bytes([0xC3, 0x85, 0xC2])),
    ("C3 A2 C2", bytes([0xC3, 0xA2, 0xC2])),
    ("C3 82 C2", bytes([0xC3, 0x82, 0xC2])),
]:
    c = bytes(result).count(bseq)
    if c > 0:
        bad += c
        print("  STILL BAD: " + pattern_name + " x" + str(c))

if bad == 0:
    print("Double-encoded 2/3-byte sequences: ALL FIXED")
else:
    print("WARNING: " + str(bad) + " double-encoded sequences remain")
