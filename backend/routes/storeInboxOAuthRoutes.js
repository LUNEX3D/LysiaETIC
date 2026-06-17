const express = require("express");
const router = express.Router();
const inboxCtrl = require("../controllers/storeInboxController");

/** Meta / Google OAuth geri dönüşü — tarayıcı yönlendirmesi (JWT state ile doğrulanır) */
router.get("/inbox/instagram/oauth/callback", inboxCtrl.instagramOAuthCallback);
router.get("/inbox/google/oauth/callback", inboxCtrl.googleInboxOAuthCallback);

module.exports = router;
