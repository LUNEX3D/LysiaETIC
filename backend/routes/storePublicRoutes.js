const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/storePublicController");

router.post("/paytr/callback", ctrl.paytrCallback);
router.get("/resolve", ctrl.resolve);
router.get("/:slug/products", ctrl.listProducts);
router.get("/:slug/products/:productSlug", ctrl.getProduct);
router.get("/:slug/cart", ctrl.getCart);
router.post("/:slug/cart/items", ctrl.addToCart);
router.patch("/:slug/cart/items/:productId", ctrl.updateCartItem);
router.post("/:slug/checkout", ctrl.checkout);
router.get("/:slug/order/status", ctrl.orderStatus);
router.post("/:slug/inbox/message", ctrl.postInboxMessage);
router.get("/:slug/marketing/popups", ctrl.listMarketingPopups);
router.post("/:slug/marketing/affiliate/click", ctrl.trackAffiliateClick);
router.post("/:slug/marketing/popup/event", ctrl.trackPopupEvent);

module.exports = router;
