const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/loginPageConfigController");

router.get("/login-page", ctrl.getPublicConfig);

module.exports = router;
