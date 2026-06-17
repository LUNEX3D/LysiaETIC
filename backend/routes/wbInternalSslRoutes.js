"use strict";

const express = require("express");
const router = express.Router();
const { wbSslInternalAuth } = require("../middlewares/wbSslInternalAuth");
const ctrl = require("../controllers/wbInternalSslController");

router.get("/internal/wb/ssl/authorize", wbSslInternalAuth, ctrl.authorizeDomain);

module.exports = router;
