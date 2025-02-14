const roles = {
    owner: [
        'viewDashboard',
        'viewEntry',
        'viewOrders',
        'uploadPdf',
        'uploadImage',
        'editNotifications',
        'createOrders',
        'editOrders',
        'deleteOrders',
        'viewInvoices',
        'viewFiles',
        'uploadFiles',
        'editFiles',
        'deleteFiles',
        'updateFiles',
        'editSelf',
        'viewSelf',

        'viewWidgets',
        'bulkOrders'
    ],
    partner: [
        'viewDashboard',
        'viewEntry',
        'viewOrders',
        'uploadPdf',
        'uploadImage',
        'editNotifications',
        'createOrders',
        'editOrders',
        'deleteOrders',
        'viewInvoices',
        'viewFiles',
        'uploadFiles',
        'editFiles',
        'deleteFiles',
        'updateFiles',
        'editSelf',
        'viewSelf',
        'bulkOrders'
    ],
    donor: [
        'viewDashboard',
        'viewEntry',
        'viewOrders',
        'uploadPdf',
        'uploadImage',
        'editNotifications',
        'createOrders',
        'editOrders',
        'deleteOrders',
        'viewInvoices',
        'viewFiles',
        'uploadFiles',
        'editFiles',
        'deleteFiles',
        'updateFiles',
        'editSelf',
        'viewSelf',
        'bulkUploads'
    ],
};

function hasPermission(role, permission) {
    return roles[role]?.includes(permission);
}

module.exports = { roles, hasPermission };
