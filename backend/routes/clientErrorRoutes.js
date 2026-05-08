const express = require("express");
const router = express.Router();
const { authMiddleware, adminMiddleware } = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/clientErrorController");

router.post("/", authMiddleware, ctrl.createClientError);
router.post("/bulk", authMiddleware, ctrl.createClientErrorsBulk);
router.get("/me", authMiddleware, ctrl.getClientErrorsMine);
router.get("/admin", authMiddleware, adminMiddleware, ctrl.getClientErrorsAdmin);

module.exports = router;
