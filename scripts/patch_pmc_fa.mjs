import fs from "fs";

const p = "d:/LysiaETIC/frontend/src/pages/ProductManagementCenter.js";
let text = fs.readFileSync(p, "utf8");

const oldDash = `                {cards.map(c => (
                    <div key={c.label} className="ud-pm-dash-card" style={{ background: \`linear-gradient(135deg, \${c.color}08, \${c.color}04)\`, borderColor: \`\${c.color}20\` }}>
                        <motion.div className="ud-pm-dash-icon" style={{ background: \`\${c.color}15\`, color: c.color }}>{c.icon}</motion.div>`;

// fix - read actual from file first
const idx = text.indexOf("{cards.map(c => (");
console.log("cards map at", idx);

const oldDashReal = `                {cards.map(c => (
                    <div key={c.label} className="ud-pm-dash-card" style={{ background: \`linear-gradient(135deg, \${c.color}08, \${c.color}04)\`, borderColor: \`\${c.color}20\` }}>
                        <div className="ud-pm-dash-icon" style={{ background: \`\${c.color}15\`, color: c.color }}>{c.icon}</div>
                        <div>
                            <motion.div className="ud-pm-dash-val" style={{ color: c.color }}>{c.val}</div>
                            <div className="ud-pm-dash-label">{c.label}</div>
                        </div>
                    </div>
                ))}`;
