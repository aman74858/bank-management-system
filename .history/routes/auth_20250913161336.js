const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Account = require('../models/Account');
const router = express.Router();
const ejs = require('ejs');
 
// Generate random account number
function generateAccountNumber() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

// Login Route
router.get('/login', (req, res) => {
  const message = req.query.message;
  res.render('auth/login.ejs', { message });
});


router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('auth/login.ejs', {
        error: 'Please provide valid credentials'
      });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email }).populate('account');
    
    if (!user || !(await user.correctPassword(password, user.password))) {
      return res.render('auth/login.ejs', {
        error: 'Invalid email or password'
      });
    }


    if (user.account && user.account.status === 'blocked') {
      return res.render('auth/login.ejs', {
        error: 'Your account has been blocked. Please contact admin.'
      });
    }

    req.session.user = user;
    req.session.save();

    if (user.role === 'admin') {
      res.redirect('/admin/dashboard.ejs');
    } else {
      res.redirect('/customer/dashboard.ejs');
    }
  } catch (error) {
    res.render('auth/login.ejs', {
      error: 'An error occurred during login'
    });
  }
});

// Signup Route
router.get('/signup', (req, res) => {
  res.render('auth/signup.ejs');
});

router.post('/signup', [
  body('name').trim().isLength({ min: 2 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
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
      return res.status(400).render('auth/signup.ejs', {
        error: errors.array()[0].msg
      });
    }

    const { name, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('auth/signup.ejs', {
        error: 'User with this email already exists'
      });
    }

    // Create user and account
    const user = new User({ name, email, password, role: 'customer' });
    await user.save();

    const account = new Account({
      accountNumber: generateAccountNumber(),
      user: user._id,
      status: 'pending' // Needs admin approval
    });
    await account.save();

    user.account = account._id;
    await user.save();

    res.redirect('/login?message=Account created successfully. Please wait for admin approval.');
  } catch (error) {
    res.render('auth/signup.ejs', {
      error: 'An error occurred during registration'
    });
  }
});

// Logout Route
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;