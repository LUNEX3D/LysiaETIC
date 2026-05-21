const fs = require("fs");
const path = require("path");
const p = path.join(__dirname, "../frontend/src/pages/ProductManagementCenter.js");
let t = fs.readFileSync(p, "utf8");

const needle =
    "                            </table>\n                        </div>\n                    <motion.div className=\"ud-pm-card\"";
const rep =
    "                            </table>\n                        </motion.div>\n                    </motion.div>\n                </motion.div>\n                    <motion.div className=\"ud-pm-card\"";

// hidden wrapper is <motion.div className="ud-pm-hidden"> — only that close is </motion.div>
const needleFixed =
    "                            </table>\n                        </div>\n                    <motion.div className=\"ud-pm-card\"";
const repFixed =
    "                            </table>\n                        </motion.div>\n                    </motion.div>\n                </motion.div>\n                    <motion.div className=\"ud-pm-card\"";

// DIV version (correct)
const n =
    "                            </table>\n                        </div>\n                    <motion.div className=\"ud-pm-card\"";
const r =
    "                            </table>\n                        </motion.div>\n                    </motion.div>\n                </motion.div>\n                    <motion.div className=\"ud-pm-card\"";

const nDiv =
    "                            </table>\n                        </div>\n                    <motion.div className=\"ud-pm-card\"";
const rDiv =
    "                            </table>\n                        </motion.div>\n                    </motion.div>\n                </motion.div>\n                    <motion.div className=\"ud-pm-card\"";

// Final correct strings - all div except motion hidden close
const needleDiv =
    "                            </table>\n                        </div>\n                    <motion.div className=\"ud-pm-card\"";
const repDiv =
    "                            </table>\n                        </motion.div>\n                    </motion.div>\n                </motion.div>\n                    <motion.div className=\"ud-pm-card\"";

const NEEDLE =
    "                            </table>\n                        </div>\n                    <motion.div className=\"ud-pm-card\"";
const REPL =
    "                            </table>\n                        </motion.div>\n                    </motion.div>\n                </motion.div>\n                    <motion.div className=\"ud-pm-card\"";

// STOP - use literal:
const needleReal = `                            </table>
                        </div>
                    <div className="ud-pm-card"`;
const replReal = `                            </table>
                        </div>
                    </div>
                </motion.div>
                    <div className="ud-pm-card"`;

if (!t.includes(needleReal)) {
    console.error("not found");
    process.exit(1);
}
t = t.replace(needleReal, replReal);
fs.writeFileSync(p, t);
console.log("ok");
