const mongoose = require("mongoose");
const { Schema } = mongoose;

const NavItemSchema = new Schema(
    {
        id: { type: String, required: true },
        label: { type: String, required: true, trim: true },
        url: { type: String, default: "" },
        pageId: { type: Schema.Types.ObjectId, ref: "WBPage", default: null },
        target: { type: String, enum: ["_self", "_blank"], default: "_self" },
        icon: { type: String, default: "" },
        isVisible: { type: Boolean, default: true },
        isMegaMenu: { type: Boolean, default: false },
        cssClass: { type: String, default: "" },
        translations: { type: Schema.Types.Mixed, default: () => ({}) },
        children: { type: Schema.Types.Mixed, default: [] },
        order: { type: Number, default: 0 },
    },
    { _id: false }
);

const WBNavigationSchema = new Schema(
    {
        siteId: { type: Schema.Types.ObjectId, ref: "WBSite", required: true, index: true },
        position: {
            type: String,
            required: true,
            enum: ["header", "footer", "footer-secondary", "mobile", "sidebar"],
            index: true,
        },
        name: { type: String, default: "" },
        items: { type: [NavItemSchema], default: [] },

        headerConfig: {
            style: { type: String, enum: ["default", "centered", "split", "overlay"], default: "default" },
            isSticky: { type: Boolean, default: true },
            isTransparent: { type: Boolean, default: false },
            showSearch: { type: Boolean, default: true },
            showCart: { type: Boolean, default: true },
            showWishlist: { type: Boolean, default: false },
            showLanguageSwitcher: { type: Boolean, default: false },
            showCurrencySwitcher: { type: Boolean, default: false },
            logoPosition: { type: String, enum: ["left", "center"], default: "left" },
            backgroundColor: { type: String, default: "" },
            textColor: { type: String, default: "" },
        },

        footerConfig: {
            columns: { type: Number, default: 4 },
            showSocialLinks: { type: Boolean, default: true },
            showNewsletterSignup: { type: Boolean, default: true },
            showPaymentIcons: { type: Boolean, default: true },
            copyrightText: { type: String, default: "" },
            backgroundColor: { type: String, default: "" },
            textColor: { type: String, default: "" },
        },
    },
    { timestamps: true }
);

WBNavigationSchema.index({ siteId: 1, position: 1 }, { unique: true });

module.exports = mongoose.model("WBNavigation", WBNavigationSchema);
