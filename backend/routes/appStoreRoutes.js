const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const ctrl = require("../controllers/appStoreController");

router.use(authMiddleware, subscriptionMiddleware);

router.get("/catalog", ctrl.getCatalog);
router.get("/installed", ctrl.getInstalled);
router.post("/install", ctrl.install);
router.delete("/install/:appKey", ctrl.uninstall);

module.exports = router;
