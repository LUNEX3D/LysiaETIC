const {
    computeHbLineCustomerAmount,
    computeHbLineUnitCustomerPrice,
} = require("../services/hepsiburadaService");

const cases = [
    {
        name: "100->50 kampanya (totalPrice=50)",
        item: {
            unitPrice: { amount: 100 },
            totalPrice: { amount: 50 },
            merchantDiscount: { totalPrice: { amount: 50 } },
            quantity: 1,
        },
        expect: 50,
    },
    {
        name: "100->50 (sadece indirim, total yok)",
        item: {
            unitPrice: { amount: 100 },
            merchantDiscount: { totalPrice: { amount: 50 } },
            quantity: 1,
        },
        expect: 50,
    },
    {
        name: "HB ornek (total=1, hbDisc=75)",
        item: {
            unitPrice: { amount: 1 },
            totalPrice: { amount: 1 },
            hbDiscount: { totalPrice: { amount: 75 } },
            quantity: 1,
        },
        expect: 1,
    },
];

let ok = 0;
for (const c of cases) {
    const got = computeHbLineCustomerAmount(c.item);
    const pass = Math.abs(got - c.expect) < 0.01;
    console.log(`${pass ? "OK" : "FAIL"} ${c.name}: got=${got} expect=${c.expect}`);
    if (pass) ok++;
}
process.exit(ok === cases.length ? 0 : 1);
