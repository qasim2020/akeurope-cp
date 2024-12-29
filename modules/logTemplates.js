const logTemplates = ({ type, entity, actor, project, changes }) => {

    if (!type || !entity || !actor) {
        throw new Error('Missing required parameters: type, entity, and actor are mandatory.');
    }

    const commons = (entityType, entityId) => ({
        entityType,
        entityId,
        actorType: 'user',
        actorId: actor._id,
    });

    const templates = {
        login: {
            ...commons('user', entity._id),
            action: 'Logged in',
            url: `/user/${entity._id}`,
            isNotification: true,
            color: 'grey'
        },
        logout: {
            ...commons('user', entity._id),
            action: 'Logged out',
            url: `/user/${entity._id}`,
            isNotification: true,
            color: 'grey'
        },
        passwordChanged: {
            ...commons('user', entity._id),
            action: 'Password changed',
            url: `/user/${entity._id}`,
            isNotification: true,
            color: 'grey',
        },
        sentEmailForgotPassword: {
            ...commons('user', entity._id),
            action: 'Sent forgot password email',
            url: `/user/${entity._id}`,
            isNotification: true,
            isRead: false,
            color: 'grey'
        },
        customerCreated: {
            ...commons('customer', entity._id),
            url: `/customer/${entity._id}`,
            action: 'New customer created',
            color: 'blue',
            isNotification: true,
        },
        customerUpdated: changes ? {
            ...commons('customer', entity._id),
            url: `/customer/${entity._id}`,
            action: 'Customer updated',
            changes,
            color: 'blue',
            isNotification: true,
        } : null,
        sentEmailCustomerInvite: {
            ...commons('customer', entity._id),
            url: `/customer/${entity._id}`,
            action: 'Sent email invite',
            color: 'blue',
            isNotification: true
        },
        projectCreated: {
            ...commons('project', entity._id),
            url: `/project/${entity.slug}`,
            action: 'Project created',
            color: 'blue',
            isNotification: true,
        },
        projectUpdated: changes ? {
            ...commons('project', entity._id),
            url: `/project/${entity.slug}`,
            action: 'Project updated',
            changes,
            color: 'blue',
            isNotification: true,
        } : null,
        entryCreated: project ? {
            ...commons('entry', entity._id),
            url: `/entry/${entity._id}/project/${project.slug}`,
            action: 'Entry created',
            color: 'blue',
            isNotification: true,
        } : null,
        entryUpdated: project && changes ? {
            ...commons('entry', entity._id),
            url: `/entry/${entity._id}/project/${project.slug}`,
            action: 'Entry updated',
            changes,
            color: 'blue',
            isNotification: true, 
        } : null,
        entryDeleted: project ? {
            ...commons('entry', entity._id),
            url: `/entry/${entity._id}/project/${project.slug}`,
            action: 'Entry deleted',
            color: 'red',
            isNotification: true,  
        } : null,
        entryUpdatedBulkUpload: project && changes ? {
            ...commons('entry', entity._id),
            url: `/entry/${entity._id}/project/${project.slug}`,
            action: 'Entry updated in bulk upload',
            changes,
            isNotification: false,
        } : null,
        entryCreatedBulkUpload: project ? {
            ...commons('entry', entity._id),
            url: `/entry/${entity._id}/project/${project.slug}`,
            projectId: project._id,
            action: 'Entry created in bulk upload',
            isNotification: false,
        } : null,
        bulkUploadCompleted: {
            ...commons('project', entity._id),
            url: `/project/${entity.slug}`,
            action: 'Bulk upload completed',
            changes,
            color: 'blue',
            isNotification: true
        },
        userCreated: {
            ...commons('user', entity._id),
            url: `/user/${entity._id}`,
            action: 'Administrator created',
            color: 'blue',
            isNotification: true
        },
        userUpdated: {
            ...commons('user', entity._id),
            url: `/user/${entity._id}`,
            action: 'User updated',
            changes,
            color: 'blue',
            isNotification: true,
        },
        userDeleted: {
            ...commons('user', entity._id),
            url: `/user/${entity._id}`,
            action: 'User deleted',
            color: 'red',
            isNotification: true
        },
        userAcceptedInvite: {
            ...commons('user', entity._id),
            url: `/user/${entity._id}`,
            action: 'Administrator accepted invite',
            color: 'blue',
            isNotification: true
        },
        sentEmailUserInvite: {
            ...commons('user', entity._id),
            url: `/user/${entity._id}`,
            action: 'Sent email invite',
            color: 'blue',
            isNotification: true
        }
    }

    if (templates[type] == null) {
        throw new Error(`Incomplete parameters for template type: ${type}`);
    }

    if (!templates[type]) {
        throw new Error(`Unknown log template type: ${type}`);
    }

    return templates[type];

}

module.exports = { logTemplates };