const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const couponController = require("../controllers/couponController");

router.use(authMiddleware);

router.post("/validate", couponController.validate);

module.exports = router;
