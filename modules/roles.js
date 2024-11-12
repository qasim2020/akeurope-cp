const roles = {
    admin: [
        'viewDashboard',
    ],
    editor: [
        'viewDashboard',
    ],
    viewer: [
        'viewDashboard',
    ]
};

function hasPermission(role, permission) {
    return roles[role]?.includes(permission);
}

module.exports = { roles, hasPermission };