const roles = {
    admin: [
        
    ],
    editor: [
        
    ],
    viewer: [
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
        'viewSelf'
    ]
};

function hasPermission(role, permission) {
    return roles[role]?.includes(permission);
}

module.exports = { roles, hasPermission };