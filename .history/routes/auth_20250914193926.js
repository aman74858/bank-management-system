const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Account = require('../models/Account');
const { redirectIfAuthenticated } = require('../admin/auth');
const router = express.Router();

// Generate unique account number
function generateAccountNumber() {
    return '100' + Date.now().toString().slice(-7);
}

// Login page
router.get('/login', redirectIfAuthenticated, (req, res) => {
    const message = req.query.message;
    res.render('auth/login', { error: null, message });
});

// Signup page
router.get('/signup', redirectIfAuthenticated, (req, res) => {
    res.render('auth/signup.ejs', { error: null, message: null });
});

// Login POST
router.post('/login', redirectIfAuthenticated, [
    body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
    body('password').isLength({ min: 1 }).withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('auth/login', { 
                error: 'Please enter valid credentials',
                message: null 
            });
        }

        const { email, password } = req.body;
        const user = await User.findOne({ email, isActive: true }).populate('accountId');

        if (!user) {
            return res.render('auth/login.ejs', { 
                error: 'Invalid email or password',
                message: null 
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.render('auth/login.ejs', { 
                error: 'Invalid email or password',
                message: null 
            });
        }

        // Store user session
        req.session.user = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            accountId: user.accountId
        };

        // Redirect to intended page or dashboard
        const redirectTo = req.session.redirectTo || 
            (user.role === 'admin' ? '/admin/dashboard' : '/customer/dashboard');
        
        delete req.session.redirectTo;
        res.redirect(redirectTo);

    } catch (error) {
        console.error('Login error:', error);
        res.render('auth/login', { 
            error: 'An error occurred. Please try again.',
            message: null 
        });
    }
});

// Signup POST
router.post('/signup', redirectIfAuthenticated, [
    body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('confirmPassword').custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error('Passwords do not match');
        }
        return true;
    })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('auth/signup.ejs', { 
                error: errors.array()[0].msg,
                message: null 
            });
        }

        const { name, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('auth/signup.ejs', { 
                error: 'Email already registered. Please use a different email.',
                message: null 
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = new User({
            name,
            email,
            password: hashedPassword,
            role: 'customer'
        });
        await user.save();

        // Create account for customer
        const accountNumber = generateAccountNumber();
        const account = new Account({
            userId: user._id,
            accountNumber,
            balance: 1000, // Welcome bonus
            status: 'active'
        });
        await account.save();

        // Update user with account reference
        user.accountId = account._id;
        await user.save();

        res.render('auth/login.ejs', {
            error: null,
            message: 'Account created successfully! You received ₹1000 welcome bonus. Please login.'
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.render('auth/signup.ejs', { 
            error: 'An error occurred. Please try again.',
            message: null 
        });
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destruction error:', err);
        }
        res.redirect('/');
    });
});

module.exports = router;
