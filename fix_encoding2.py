import os

filepath = "D:/LysiaETIC/frontend/src/pages/AICommandCenter.js"

with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

# Direct string replacements for all remaining corrupted patterns
# These are the exact corrupted sequences found in the file

replacements = [
    # === BOX DRAWING (comment decorations) ===
    # Double line ═ (U+2550) - corrupted as 3 chars
    ("\u00e2\u0095\u0090", "\u2550"),
    # Single line ─ (U+2500) - corrupted as 3 chars
    ("\u00e2\u0094\u0080", "\u2500"),

    # === PUNCTUATION ===
    # Em dash — (U+2014)
    ("\u00e2\u0080\u0094", "\u2014"),
    # Bullet • (U+2022)
    ("\u00e2\u0080\u00a2", "\u2022"),
    # Lira sign ₺ (U+20BA)
    ("\u00e2\u0082\u00ba", "\u20ba"),
    # Left double quote " (U+201C)
    ("\u00e2\u0080\u009c", "\u201c"),
    # Right double quote " (U+201D)
    ("\u00e2\u0080\u009d", "\u201d"),
    # En dash – (U+2013)
    ("\u00e2\u0080\u0093", "\u2013"),

    # === TURKISH UPPERCASE ===
    # Ö (U+00D6) - C3 96 -> corrupted
    ("\u00c3\u0096", "\u00d6"),
    # Ü (U+00DC) - C3 9C -> corrupted
    ("\u00c3\u009c", "\u00dc"),
    # Ç (U+00C7) - C3 87 -> corrupted
    ("\u00c3\u0087", "\u00c7"),

    # === TURKISH LOWERCASE (any remaining) ===
    ("\u00c3\u00b6", "\u00f6"),  # ö
    ("\u00c3\u00bc", "\u00fc"),  # ü
    ("\u00c3\u00a7", "\u00e7"),  # ç
    ("\u00c4\u009f", "\u011f"),  # ğ
    ("\u00c4\u00b1", "\u0131"),  # ı
    ("\u00c5\u009f", "\u015f"),  # ş
    ("\u00c4\u00b0", "\u0130"),  # İ
    ("\u00c5\u009e", "\u015e"),  # Ş

    # === SYMBOLS ===
    # Arrows
    ("\u00e2\u0086\u0091", "\u2191"),  # ↑
    ("\u00e2\u0086\u0093", "\u2193"),  # ↓
    ("\u00e2\u0086\u0092", "\u2192"),  # →
    # Check marks
    ("\u00e2\u009c\u0085", "\u2705"),  # ✅
    ("\u00e2\u009c\u0094", "\u2714"),  # ✔
    # Warning
    ("\u00e2\u009a\u00a0", "\u26a0"),  # ⚠
    # Gear
    ("\u00e2\u009a\u0099", "\u2699"),  # ⚙
    # Question mark ornament
    ("\u00e2\u009d\u0093", "\u2753"),  # ❓
    # Middle dot
    ("\u00c2\u00b7", "\u00b7"),  # ·
    # Delta
    ("\u00ce\u0094", "\u0394"),  # Δ

    # === EMOJIS (4-byte UTF-8, double encoded) ===
    # Pattern: F0 9F XX XX -> C3 B0 C2 9F C2 XX C2 XX
    # 🧠 brain U+1F9E0 = F0 9F A7 A0
    ("\u00c3\u00b0\u00c2\u009f\u00c2\u00a7\u00c2\u00a0", "\U0001f9e0"),
    # 📊 chart U+1F4CA = F0 9F 93 8A
    ("\u00c3\u00b0\u00c2\u009f\u00c2\u0093\u00c2\u008a", "\U0001f4ca"),
    # 📋 clipboard U+1F4CB = F0 9F 93 8B
    ("\u00c3\u00b0\u00c2\u009f\u00c2\u0093\u00c2\u008b", "\U0001f4cb"),
    # 💰 money bag U+1F4B0 = F0 9F 92 B0
    ("\u00c3\u00b0\u00c2\u009f\u00c2\u0092\u00c2\u00b0", "\U0001f4b0"),
    # 💡 light bulb U+1F4A1 = F0 9F 92 A1
    ("\u00c3\u00b0\u00c2\u009f\u00c2\u0092\u00c2\u00a1", "\U0001f4a1"),
    # 📦 package U+1F4E6 = F0 9F 93 A6
    ("\u00c3\u00b0\u00c2\u009f\u00c2\u0093\u00c2\u00a6", "\U0001f4e6"),
    # 📈 chart increasing U+1F4C8 = F0 9F 93 88
    ("\u00c3\u00b0\u00c2\u009f\u00c2\u0093\u00c2\u0088", "\U0001f4c8"),
    # 🔥 fire U+1F525 = F0 9F 94 A5
    ("\u00c3\u00b0\u00c2\u009f\u00c2\u0094\u00c2\u00a5", "\U0001f525"),
    # 💤 zzz U+1F4A4 = F0 9F 92 A4
    ("\u00c3\u00b0\u00c2\u009f\u00c2\u0092\u00c2\u00a4", "\U0001f4a4"),
    # 🔴 red circle U+1F534 = F0 9F 94 B4
    ("\u00c3\u00b0\u00c2\u009f\u00c2\u0094\u00c2\u00b4", "\U0001f534"),
    # 🪙 coin U+1FA99 = F0 9F AA 99 (wait, this is different range)
    # 🛒 shopping cart U+1F6D2 = F0 9F 9B 92 (wait, actually 1F6D2 is not right)
    # Let me use the actual cart: 🛒 = U+1F6D2? No, U+1F6D2 is octagonal sign. Cart = U+1F6D2?
    # Actually shopping cart is U+1F6D2... let me check
    # 🛒 = U+1F6D2 = F0 9F 9B 92
    ("\u00c3\u00b0\u00c2\u009f\u00c2\u009b\u00c2\u0092", "\U0001f6d2"),
    # 💵 dollar banknote U+1F4B5 = F0 9F 92 B5
    ("\u00c3\u00b0\u00c2\u009f\u00c2\u0092\u00c2\u00b5", "\U0001f4b5"),
    # 🚀 rocket U+1F680 = F0 9F 9A 80
    ("\u00c3\u00b0\u00c2\u009f\u00c2\u009a\u00c2\u0080", "\U0001f680"),
    # 🏆 trophy U+1F3C6 = F0 9F 8F 86
    ("\u00c3\u00b0\u00c2\u009f\u00c2\u008f\u00c2\u0086", "\U0001f3c6"),
    # 🆘 SOS U+1F198 = F0 9F 86 98
    ("\u00c3\u00b0\u00c2\u009f\u00c2\u0086\u00c2\u0098", "\U0001f198"),
    # 🐄 cow U+1F404 = F0 9F 90 84
    ("\u00c3\u00b0\u00c2\u009f\u00c2\u0090\u00c2\u0084", "\U0001f404"),
    # 🐕 dog U+1F415 = F0 9F 90 95
    ("\u00c3\u00b0\u00c2\u009f\u00c2\u0090\u00c2\u0095", "\U0001f415"),
    # 💸 money with wings U+1F4B8 = F0 9F 92 B8
    ("\u00c3\u00b0\u00c2\u009f\u00c2\u0092\u00c2\u00b8", "\U0001f4b8"),
    # 🎯 direct hit/target U+1F3AF = F0 9F 8E AF
    ("\u00c3\u00b0\u00c2\u009f\u00c2\u008e\u00c2\u00af", "\U0001f3af"),
    # 📉 chart decreasing U+1F4C9 = F0 9F 93 89
    ("\u00c3\u00b0\u00c2\u009f\u00c2\u0093\u00c2\u0089", "\U0001f4c9"),
    # 🪙 coin U+1FA99 = F0 9F AA 99
    ("\u00c3\u00b0\u00c2\u009f\u00c2\u00aa\u00c2\u0099", "\U0001fa99"),
]

count_total = 0
for old, new in replacements:
    c = text.count(old)
    if c > 0:
        text = text.replace(old, new)
        count_total += c
        print("Fixed: " + repr(old) + " -> " + repr(new) + " (" + str(c) + " times)")

# Now handle any remaining corrupted emoji patterns generically
# Pattern: \u00c3\u00b0\u00c2\u009f followed by more \u00c2\u00XX sequences
# This is a 4-byte UTF-8 emoji double-encoded
import re

def fix_remaining_emoji(match):
    chars = match.group(0)
    try:
        fixed = chars.encode("latin-1").decode("utf-8")
        return fixed
    except:
        return chars

# Match pattern: C3 B0 followed by sequences of C2 XX (double-encoded 4-byte UTF-8)
# In the corrupted text, F0 becomes C3 B0, and bytes 80-BF become C2 80-C2 BF
pattern = re.compile("[\u00c3][\u00b0][\u00c2][\u0080-\u00bf][\u00c2][\u0080-\u00bf][\u00c2][\u0080-\u00bf]")
remaining_emojis = pattern.findall(text)
if remaining_emojis:
    print("Found " + str(len(remaining_emojis)) + " remaining emoji patterns, fixing...")
    for em in set(remaining_emojis):
        try:
            fixed_em = em.encode("latin-1").decode("utf-8")
            c = text.count(em)
            text = text.replace(em, fixed_em)
            count_total += c
            print("  Fixed emoji: " + repr(em) + " -> " + repr(fixed_em) + " (" + str(c) + " times)")
        except:
            print("  Could not fix: " + repr(em))

# Also try a more general pattern for any remaining double-encoded 3-byte sequences
pattern3 = re.compile("[\u00e2][\u0080-\u009f\u00a0-\u00bf][\u0080-\u009f\u00a0-\u00bf]")
remaining_3byte = pattern3.findall(text)
if remaining_3byte:
    print("Found " + str(len(remaining_3byte)) + " remaining 3-byte patterns, fixing...")
    for seq in set(remaining_3byte):
        try:
            fixed_seq = seq.encode("latin-1").decode("utf-8")
            c = text.count(seq)
            text = text.replace(seq, fixed_seq)
            count_total += c
            print("  Fixed 3-byte: " + repr(seq) + " -> " + repr(fixed_seq) + " (" + str(c) + " times)")
        except:
            pass

# Also catch remaining 2-byte double-encoded (C3 XX, C4 XX, C5 XX, C2 XX, CE XX)
for prefix in ["\u00c3", "\u00c4", "\u00c5", "\u00c2", "\u00ce"]:
    pattern2 = re.compile(re.escape(prefix) + "[\u0080-\u00bf]")
    remaining_2byte = pattern2.findall(text)
    if remaining_2byte:
        for seq in set(remaining_2byte):
            try:
                fixed_seq = seq.encode("latin-1").decode("utf-8")
                c = text.count(seq)
                text = text.replace(seq, fixed_seq)
                count_total += c
                print("  Fixed 2-byte: " + repr(seq) + " -> " + repr(fixed_seq) + " (" + str(c) + " times)")
            except:
                pass

print("")
print("Total replacements: " + str(count_total))

# Write back
with open(filepath, "w", encoding="utf-8", newline="\n") as f:
    f.write(text)

print("File written successfully")

# Verify
with open(filepath, "r", encoding="utf-8") as f:
    verify = f.read()

print("File size: " + str(len(verify.encode("utf-8"))) + " bytes")

# Check Turkish chars present
for char, name in [
    ("\u00f6", "o-umlaut"), ("\u00fc", "u-umlaut"), ("\u015f", "s-cedilla"),
    ("\u011f", "g-breve"), ("\u0131", "dotless-i"), ("\u0130", "capital-I-dot"),
    ("\u00c7", "C-cedilla"), ("\u00dc", "U-umlaut"), ("\u00d6", "O-umlaut"),
    ("\u015e", "S-cedilla"), ("\u2550", "box-double"), ("\u2014", "em-dash"),
    ("\u20ba", "lira-sign"), ("\u2500", "box-single"),
]:
    count = verify.count(char)
    if count > 0:
        print("  OK: " + name + " found " + str(count) + " times")
    else:
        print("  MISSING: " + name)

# Final corruption check
still_bad = 0
for bad_prefix in ["\u00c3", "\u00c4", "\u00c5"]:
    for i, ch in enumerate(verify):
        if ch == bad_prefix and i + 1 < len(verify):
            next_ord = ord(verify[i+1])
            if 0x80 <= next_ord <= 0xbf:
                still_bad += 1
                if still_bad <= 5:
                    context = verify[max(0,i-10):i+12]
                    print("  REMAINING: " + repr(context))

if still_bad == 0:
    print("")
    print("SUCCESS: ALL encoding issues fixed!")
else:
    print("")
    print("WARNING: " + str(still_bad) + " potential issues remain")
