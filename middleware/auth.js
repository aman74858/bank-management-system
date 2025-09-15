// middleware/auth.js
const authenticateUser = (req, res, next) => {
    if (req.session && req.session.user) {
        req.user = req.session.user;
        return next();
    } else {
        return res.redirect('/auth/login');
    }
};

const authenticateCustomer = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'customer') {
        req.user = req.session.user;
        return next();
    } else {
        return res.redirect('/auth/login');
    }
};

const authenticateAdmin = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        req.user = req.session.user;
        return next();
    } else {
        return res.redirect('/auth/login');
    }
};

module.exports = {
    authenticateUser,
    authenticateCustomer,
    authenticateAdmin
};
