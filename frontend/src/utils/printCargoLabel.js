/** Etiket yazdırma — yalnızca kargo etiketi (dashboard değil) */

const TY_LABEL_PRINT_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #fff; color: #111; }
body {
  font-family: "Segoe UI", system-ui, -apple-system, Arial, sans-serif;
  padding: 12mm;
}
.ty-cargo-label {
  background: #fff;
  color: #1a1a1a;
  padding: 20px 22px;
  max-width: 210mm;
  margin: 0 auto;
}
.ty-cargo-label__warn {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  background: #fff8e6;
  border: 1px solid #f0d78c;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 18px;
  font-size: 12px;
  line-height: 1.5;
  color: #333;
}
.ty-cargo-label__warn-icon { color: #c90; font-weight: 700; font-size: 15px; flex-shrink: 0; }
.ty-cargo-label__warn p { margin: 0; }
.ty-cargo-label__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}
.ty-cargo-label__logo-main {
  font-size: 26px;
  font-weight: 800;
  color: #f27a1a;
}
.ty-cargo-label__logo-cargo {
  text-align: right;
  font-size: 14px;
  font-weight: 700;
  color: #f27a1a;
  line-height: 1.2;
}
.ty-cargo-label__logo-cargo span {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #333;
  margin-top: 2px;
}
.ty-cargo-label__logo-cargo--yurtici { color: #0066b3; font-size: 20px; font-weight: 800; }
.ty-cargo-label__logo-cargo--yurtici span { color: #0066b3; font-size: 20px; font-weight: 800; }
.ty-cargo-label__logo-cargo--ptt { color: #d4a017; font-size: 20px; font-weight: 800; }
.ty-cargo-label__logo-cargo--ptt span { color: #c41e3a; font-weight: 800; }
.ty-cargo-label__logo-cargo--aras { color: #e30613; font-size: 20px; font-weight: 800; }
.ty-cargo-label__logo-cargo--mng { color: #004a8f; font-size: 20px; font-weight: 800; }
.ty-cargo-label__logo-cargo--surat { color: #0054a6; font-size: 18px; font-weight: 800; }
.ty-cargo-label__logo-cargo--horoz { color: #f39200; font-size: 18px; font-weight: 800; }
.ty-cargo-label__logo-cargo--kolay { color: #7b2cbf; font-size: 16px; font-weight: 800; }
.ty-cargo-label__logo-cargo--ceva,
.ty-cargo-label__logo-cargo--dhl,
.ty-cargo-label__logo-cargo--generic { color: #333; font-size: 17px; font-weight: 800; }
.ty-cargo-label__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.ty-cargo-label__box {
  border: 1px solid #d8d8d8;
  border-radius: 10px;
  padding: 16px 18px;
  min-height: 200px;
}
.ty-cargo-label__box h3 {
  margin: 0 0 14px;
  font-size: 14px;
  font-weight: 700;
  color: #222;
}
.ty-cargo-label dl { margin: 0; }
.ty-cargo-label__row { margin-bottom: 12px; }
.ty-cargo-label__row:last-child { margin-bottom: 0; }
.ty-cargo-label__row dt {
  font-size: 11px;
  font-weight: 600;
  color: #666;
  margin-bottom: 3px;
}
.ty-cargo-label__row dd {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  word-break: break-word;
}
.ty-cargo-label__box--barcode { display: flex; flex-direction: column; }
.ty-cargo-label__barcode {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 8px;
}
.ty-cargo-label__barcode svg { max-width: 100%; height: auto; }
.ty-cargo-label__barcode-num {
  margin-top: 10px;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #111;
}
@page { size: A4; margin: 10mm; }
@media print {
  body { padding: 0; }
  .ty-cargo-label { box-shadow: none; border-radius: 0; }
}
`;

function buildPrintDocumentHtml(element, title = "Kargo Etiketi") {
    const labelHtml = element?.outerHTML || "";
    const safeTitle = String(title).replace(/</g, "&lt;");
    return (
        `<!DOCTYPE html><html lang="tr"><head>` +
        `<meta charset="utf-8"/>` +
        `<title>${safeTitle}</title>` +
        `<style>${TY_LABEL_PRINT_CSS}</style>` +
        `</head><body>${labelHtml}</body></html>`
    );
}

function printViaIframe(html) {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "Kargo etiketi yazdır");
    iframe.style.cssText =
        "position:fixed;left:0;top:0;width:210mm;height:297mm;border:0;z-index:99999;" +
        "opacity:0.01;pointer-events:none;";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
        iframe.remove();
        return false;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const win = iframe.contentWindow;
    const cleanup = () => {
        setTimeout(() => {
            try {
                iframe.remove();
            } catch {
                /* ignore */
            }
        }, 1500);
    };

    const runPrint = () => {
        try {
            win.focus();
            win.print();
        } catch {
            iframe.remove();
            return false;
        }
        cleanup();
        return true;
    };

    setTimeout(runPrint, 450);
    return true;
}

function printViaPopup(html) {
    // noopener KULLANMA — Chrome'da document yazılamaz, about:blank kalır
    const w = window.open("", "_blank");
    if (!w) return false;

    w.document.open();
    w.document.write(html);
    w.document.close();

    const runPrint = () => {
        try {
            w.focus();
            w.print();
        } catch {
            return false;
        }
        return true;
    };

    if (w.document.readyState === "complete") {
        setTimeout(runPrint, 400);
    } else {
        w.addEventListener("load", () => setTimeout(runPrint, 200));
        setTimeout(runPrint, 900);
    }

    w.addEventListener("afterprint", () => {
        try {
            w.close();
        } catch {
            /* ignore */
        }
    });

    return true;
}

/**
 * Yalnızca etiket yazdırır.
 * @param {HTMLElement} element
 * @param {string} [title]
 */
export function printCargoLabelOnly(element, title = "Kargo Etiketi") {
    if (!element || !element.outerHTML?.trim()) return false;

    const html = buildPrintDocumentHtml(element, title);
    if (printViaIframe(html)) return true;
    return printViaPopup(html);
}
