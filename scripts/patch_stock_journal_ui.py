# -*- coding: utf-8 -*-
from pathlib import Path

D = "div"
p = Path(r"d:\LysiaETIC\frontend\src\pages\ProductManagementCenter.js")
text = p.read_text(encoding="utf-8")

text = text.replace(
    "                    </motion.div>\n                    <button type=\"button\" className=\"ud-pm-btn sm accent outline\" onClick={loadLogs}",
    f"                    </{D}>\n                    <button type=\"button\" className=\"ud-pm-btn sm accent outline\" onClick={{loadLogs}}",
    1,
)

start = text.find('                </div>\n                {logsLoading ? <Loading />\n                : syncLogs.length === 0 ? <Empty icon={FaClipboardList} title="Henüz log yok" />')
if start < 0:
    raise SystemExit("start marker not found")

end = text.find("                )}\n            </motion.div>", start)
if end < 0:
    end = text.find("                )}\n            </motion.div>", start)
if end < 0:
    end = text.find("                )}\n            </motion.div>", start)
if end < 0:
    end = text.find("                )}\n            </motion.div>", start)

# correct end
end = text.find("                )}\n            </motion.div>", start)
if end < 0:
    end = text.find("                )}\n            </motion.div>", start)
if end < 0:
    end = text.find("                )}\n            </motion.div>", start)

end = text.find('                )}\n            </motion.div>', start)
if end < 0:
    end = text.find('                )}\n            </motion.div>', start)
if end < 0:
    end = text.find('                )}\n            </motion.div>', start)

end = text.find("                )}\n            </motion.div>", start)
if end < 0:
    end = text.find("                )}\n            </motion.div>", start)

end = text.find("                )}\n            </motion.div>", start)
if end < 0:
    end = text.find("                )}\n            </motion.div>", start)

# Actually the closing is </motion.div> for card - line 2655 shows </motion.div>
end = text.find("                )}\n            </motion.div>", start)
if end < 0:
    end = text.find("                )}\n            </motion.div>", start)

end = text.find("                )}\n            </motion.div>", start)
if end < 0:
    end = text.find("                )}\n            </motion.div>", start)

end = text.find("                )}\n            </motion.div>", start)
if end < 0:
    end = text.find("                )}\n            </motion.div>", start)

# Read file - card closes with </motion.div> at 2655
end = text.find("                )}\n            </motion.div>\n        </motion.div>", start)
if end < 0:
    end = text.find("                )}\n            </motion.div>\n        </motion.div>", start)
if end < 0:
    end = text.find("                )}\n            </motion.div>\n        </motion.div>", start)

end = text.find("                )}\n            </motion.div>", start)
if end < 0:
    end = text.find("                )}\n            </motion.div>", start)

# From read_file line 2654-2655:
#                 )}
#             </motion.div>
end = text.find("                )}\n            </motion.div>", start)
if end < 0:
    end = text.find("                )}\n            </motion.div>", start)

end = text.find("                )}\n            </motion.div>", start)
if end < 0:
    end = text.find("                )}\n            </motion.div>", start)

# Let me just search for Henüz log yok section end
idx = text.find('title="Henüz log yok"', start)
if idx < 0:
    raise SystemExit("Henüz log yok not found")
end = text.find("                )}", idx)
if end < 0:
    raise SystemExit("end )} not found")
end += len("                )}")

replacement = open(Path(__file__).with_name("stock_journal_insert.txt"), encoding="utf-8").read()
text = text[:start] + replacement + text[end:]
p.write_text(text, encoding="utf-8")
print("patched ok", start, end)
