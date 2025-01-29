const { roles, hasPermission } = require('../modules/roles');

const authenticate = (req, res, next) => {
    if (req.session.user) {
        req.customer = req.session.user;
        return next();
    }
    return res.status(404).render('error', { heading: 'Unauthorized', error: 'User is not logged in.' });
};

const authorize = (permission) => {
    return (req, res, next) => {
        const customerRole = req.customer?.role;

        if (!customerRole || !hasPermission(customerRole, permission)) {
            return res.status(401).render('error', { heading: 'Unauthorized', error: `${customerRole} can't ${permission}` });
        }

        req.userPermissions = roles[customerRole] || [];
        next();
    };
};

const isBoarded = (req, res) => {
    if (req.session.user.isBoarded) {
        return next();
    }

    if (req.session.user.isBoardingAtStep) {
        res.redirect(req.session.user.isBoardingAtStep);
    }

    res.redirect('/onboarding/stepOne');
};

module.exports = { authenticate, authorize, isBoarded };
