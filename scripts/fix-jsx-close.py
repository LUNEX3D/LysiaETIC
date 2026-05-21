p = "d:/LysiaETIC/frontend/src/components/pm/ChannelPricesTab.js"
with open(p, encoding="utf-8") as f:
    t = f.read()
bad = 'ud-pm-product-list-name">{mp.name || "İsimsiz"}</motion.div>'
good = 'ud-pm-product-list-name">{mp.name || "İsimsiz"}</div>'
if bad not in t:
    print("pattern not found")
    exit(1)
t = t.replace(bad, good, 1)
with open(p, "w", encoding="utf-8") as f:
    f.write(t)
print("fixed")
