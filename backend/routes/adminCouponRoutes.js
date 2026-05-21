const express = require("express");
const router = express.Router();
const { authMiddleware, adminMiddleware } = require("../middlewares/authMiddleware");
const adminCoupon = require("../controllers/admin/adminCouponController");

router.use(authMiddleware, adminMiddleware);

router.get("/stats", adminCoupon.getStats);
router.get("/redemptions", adminCoupon.listRedemptions);
router.get("/", adminCoupon.listCoupons);
router.get("/:id", adminCoupon.getCoupon);
router.post("/", adminCoupon.createCoupon);
router.put("/:id", adminCoupon.updateCoupon);
router.delete("/:id", adminCoupon.deleteCoupon);
router.post("/:id/toggle", adminCoupon.toggleCoupon);

module.exports = router;
