const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        req.session.redirectTo = req.originalUrl;
        res.redirect('/auth/login?message=Please login to access this page');
    }
};

const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).render('error', { 
            message: 'Access denied. Admin privileges required.',
            error: { status: 403 }
        });
    }
};

const isCustomer = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'customer') {
        next();
    } else {
        res.status(403).render('error', { 
            message: 'Access denied. Customer account required.',
            error: { status: 403 }
        });
    }
};

const redirectIfAuthenticated = (req, res, next) => {
    if (req.session.user) {
        if (req.session.user.role === 'admin') {
            return res.redirect('/admin/dashboard');
        } else {
            return res.redirect('/customer/dashboard');
        }
    }
    next();
};

module.exports = { 
    isAuthenticated, 
    isAdmin, 
    isCustomer, 
    redirectIfAuthenticated 
};
