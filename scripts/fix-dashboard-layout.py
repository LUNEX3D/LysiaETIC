p = "d:/LysiaETIC/frontend/src/pages/UserDashboard.js"
with open(p, encoding="utf-8") as f:
    lines = f.readlines()

# Fix mistaken </motion.div> closing dashboard-home-sticky (after notification AnimatePresence block)
for i, line in enumerate(lines):
    if i > 660 and i < 685 and "dashboard-home-sticky" not in line:
        if line.strip() == "</motion.div>" and i + 1 < len(lines) and "Bildirim paneli" in lines[i + 2]:
            lines[i] = line.replace("</motion.div>", "</div>")
            print("fixed sticky close at", i + 1)
            break

with open(p, "w", encoding="utf-8") as f:
    f.writelines(lines)
