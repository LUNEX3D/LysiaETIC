/**
 * Fatura tutarlarını çöz — DB totals, kalemler veya UBL XML
 */

const sumLinesTotals = (lines) => {
    if (!Array.isArray(lines) || !lines.length) {
        return { lineExtensionAmount: 0, totalTax: 0, payableAmount: 0 };
    }

    let lineExtensionAmount = 0;
    let totalTax = 0;

    for (const line of lines) {
        const qty = Number(line.quantity || 1);
        const price = Number(line.unitPrice || 0);
        const disc = Number(line.discountAmount || 0);
        const lineTotal =
            Number(line.lineTotal) > 0
                ? Number(line.lineTotal)
                : qty * price - disc;
        const vatRate = Number(line.vatRate ?? 20);
        const vatAmount =
            Number(line.vatAmount) > 0
                ? Number(line.vatAmount)
                : lineTotal * (vatRate / 100);

        lineExtensionAmount += lineTotal;
        totalTax += vatAmount;
    }

    return {
        lineExtensionAmount: Number(lineExtensionAmount.toFixed(2)),
        totalTax: Number(totalTax.toFixed(2)),
        payableAmount: Number((lineExtensionAmount + totalTax).toFixed(2)),
    };
};

const pickUblAmount = (xmlText, tag) => {
    const text = String(xmlText || "");
    const re = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([^<]+)<`, "i");
    const m = text.match(re);
    if (!m) return 0;
    const n = Number(String(m[1]).trim());
    return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : 0;
};

/** UBL Invoice LegalMonetaryTotal bloğundan tutarlar */
const extractTotalsFromUblXml = (xmlText) => {
    const text = String(xmlText || "");
    if (!text) return null;

    const legalMatch = text.match(
        /<(?:[\w-]+:)?LegalMonetaryTotal[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?LegalMonetaryTotal>/i
    );
    const block = legalMatch ? legalMatch[1] : text;

    const lineExtensionAmount = pickUblAmount(block, "LineExtensionAmount") || pickUblAmount(block, "TaxExclusiveAmount");
    const totalTax = pickUblAmount(block, "TaxAmount") || pickUblAmount(text, "TaxAmount");
    let payableAmount = pickUblAmount(block, "PayableAmount") || pickUblAmount(block, "TaxInclusiveAmount");

    if (!(payableAmount > 0) && lineExtensionAmount > 0) {
        payableAmount = Number((lineExtensionAmount + totalTax).toFixed(2));
    }

    if (!(payableAmount > 0) && !(lineExtensionAmount > 0)) return null;

    return {
        lineExtensionAmount: lineExtensionAmount || Math.max(0, payableAmount - totalTax),
        totalTax,
        payableAmount,
        taxInclusiveAmount: payableAmount,
    };
};

/**
 * @param {Object} inv — Invoice lean doc veya normalize edilmiş satır
 */
const resolveInvoiceTotals = (inv) => {
    const t = inv?.totals || {};
    let payableAmount = Number(t.payableAmount || t.taxInclusiveAmount || inv?.tutar || 0);
    let lineExtensionAmount = Number(t.lineExtensionAmount || t.taxExclusive || inv?.kdvHaric || 0);
    let totalTax = Number(t.totalTax || t.taxAmount || inv?.kdv || 0);

    if (!(payableAmount > 0) || !(lineExtensionAmount > 0)) {
        const fromLines = sumLinesTotals(inv?.lines);
        if (!(lineExtensionAmount > 0) && fromLines.lineExtensionAmount > 0) {
            lineExtensionAmount = fromLines.lineExtensionAmount;
        }
        if (!(totalTax > 0) && fromLines.totalTax > 0) {
            totalTax = fromLines.totalTax;
        }
        if (!(payableAmount > 0) && fromLines.payableAmount > 0) {
            payableAmount = fromLines.payableAmount;
        }
    }

    if (!(payableAmount > 0) && lineExtensionAmount > 0) {
        payableAmount = Number((lineExtensionAmount + totalTax).toFixed(2));
    }
    if (!(lineExtensionAmount > 0) && payableAmount > 0) {
        lineExtensionAmount = Number(Math.max(0, payableAmount - totalTax).toFixed(2));
    }

    return {
        lineExtensionAmount,
        totalTax,
        payableAmount,
        taxInclusiveAmount: payableAmount,
    };
};

module.exports = {
    sumLinesTotals,
    extractTotalsFromUblXml,
    resolveInvoiceTotals,
};
