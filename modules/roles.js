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
        'bulk-select'
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
        'bulk-select',
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
