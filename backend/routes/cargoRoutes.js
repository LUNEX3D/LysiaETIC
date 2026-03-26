const express = require("express");
const router = express.Router();
const cargoController = require("../controllers/cargoController");

// URL örneği: /api/cargo/6799622c3fb654fd4a95c0ab?startDate=2025-01-01&endDate=2025-02-22
router.get("/:userId", cargoController.getCargoTrackingOrders);

module.exports = router;
