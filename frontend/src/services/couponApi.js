import API from "./api";

export const validateCoupon = async (code, plan, billingCycle, baseAmount) => {
    const res = await API.post("/coupons/validate", {
        code,
        plan,
        billingCycle,
        baseAmount
    });
    return res.data;
};
