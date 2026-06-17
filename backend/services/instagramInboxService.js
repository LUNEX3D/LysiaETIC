/** @deprecated — inbox/metaInboxService + inbox/inboxSyncService kullanın */
module.exports = {
    ...require("./inbox/metaInboxService"),
    syncConversations: (storeId) => require("./inbox/metaInboxService").syncMetaChannel(storeId, "instagram"),
    listConversations: (storeId) => require("./inbox/inboxSyncService").listConversations(storeId, null),
    listMessages: (storeId, userId, id) => require("./inbox/inboxSyncService").listMessages(storeId, userId, id),
    sendMessage: (storeId, id, text) => require("./inbox/inboxSyncService").sendMessage(storeId, null, id, text),
    connectDemoInstagram: () => ({ error: "INBOX_DEMO için metaInbox.connectMetaChannel kullanın" }),
    handleOAuthCallback: (code, state) => require("./inbox/metaInboxService").handleOAuthCallback(code, state),
    getDashboardRedirectUrl: require("./inbox/metaInboxService").getDashboardRedirectUrl,
    isMetaConfigured: require("./inbox/metaInboxService").isMetaConfigured,
    isDemoMode: require("./inbox/metaInboxService").isDemoMode,
    buildOAuthUrl: (storeId, userId) => require("./inbox/metaInboxService").buildOAuthUrl(storeId, userId, "instagram"),
};
