const express = require('express');
const User = require('../models/User');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const router = express.Router();

// Middleware to check if user is authenticated and is a customer
router.use((req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  
  // Allow both customer and admin to access customer routes
  if (req.session.user.role !== 'customer' && req.session.user.role !== 'admin') {
    return res.redirect('/auth/login');
  }
  
  next();
});

// Customer Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    // Get user with populated account
    const user = await User.findById(req.session.user._id)
      .populate('account')
      .lean();

    if (!user) {
      return res.redirect('/auth/login');
    }

    if (!user.account) {
      return res.render('customer/dashboard', {
        error: 'No account found. Please contact support.',
        user: req.session.user,
        transactions: [],
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalTransfers: 0,
        monthlyAverage: 0
      });
    }

    // Get recent transactions (last 5)
    const transactions = await Transaction.find({
      $or: [
        { sender: user.account._id },
        { receiver: user.account._id }
      ]
    })
    .populate('sender receiver', 'accountNumber name')
    .sort({ timestamp: -1 })
    .limit(5)
    .lean();

    // Calculate statistics
    const allTransactions = await Transaction.find({
      $or: [
        { sender: user.account._id },
        { receiver: user.account._id }
      ]
    }).lean();

    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let totalTransfers = 0;

    allTransactions.forEach(transaction => {
      if (transaction.type === 'deposit') {
        totalDeposits += transaction.amount;
      } else if (transaction.type === 'withdrawal') {
        totalWithdrawals += transaction.amount;
      } else if (transaction.type === 'transfer') {
        totalTransfers += transaction.amount;
      }
    });

    // Calculate monthly average (basic calculation)
    const accountAge = Math.max(1, Math.ceil((Date.now() - user.createdAt) / (1000 * 60 * 60 * 24 * 30)));
    const monthlyAverage = (totalDeposits + totalWithdrawals + totalTransfers) / accountAge;

    res.render('customer/dashboard', {
      user: {
        ...user,
        account: user.account
      },
      transactions,
      totalDeposits,
      totalWithdrawals,
      totalTransfers,
      monthlyAverage,
      error: null,
      success: req.query.success || null
    });

  } catch (error) {
    console.error('Customer dashboard error:', error);
    res.render('customer/dashboard', {
      error: 'Error loading dashboard. Please try again.',
      user: req.session.user,
      transactions: [],
      totalDeposits: 0,
      totalWithdrawals: 0,
      totalTransfers: 0,
      monthlyAverage: 0
    });
  }
});

// Deposit Page
router.get('/deposit', async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id)
      .populate('account')
      .lean();

    if (!user || !user.account) {
      return res.redirect('/customer/dashboard?error=Account not found');
    }

    res.render('customer/deposit', {
      user,
      error: null,
      success: null
    });
  } catch (error) {
    console.error('Deposit page error:', error);
    res.redirect('/customer/dashboard?error=Error loading deposit page');
  }
});

// Process Deposit
router.post('/deposit', async (req, res) => {
  try {
    const { amount, description } = req.body;
    
    // Validation
    if (!amount || amount <= 0) {
      return res.render('customer/deposit', {
        user: req.session.user,
        error: 'Please enter a valid amount',
        success: null
      });
    }

    const depositAmount = parseFloat(amount);
    if (depositAmount < 1 || depositAmount > 10000) {
      return res.render('customer/deposit', {
        user: req.session.user,
        error: 'Deposit amount must be between $1 and $10,000',
        success: null
      });
    }

    // Get user account
    const user = await User.findById(req.session.user._id).populate('account');
    if (!user || !user.account) {
      return res.render('customer/deposit', {
        user: req.session.user,
        error: 'Account not found',
        success: null
      });
    }

    // Update account balance
    await Account.findByIdAndUpdate(user.account._id, {
      $inc: { balance: depositAmount }
    });

    // Create transaction record
    await Transaction.create({
      type: 'deposit',
      amount: depositAmount,
      description: description || 'Cash deposit',
      sender: user.account._id,
      receiver: user.account._id,
      status: 'completed',
      timestamp: new Date()
    });

    res.redirect('/customer/dashboard?success=Deposit successful');

  } catch (error) {
    console.error('Deposit error:', error);
    res.render('customer/deposit', {
      user: req.session.user,
      error: 'Error processing deposit. Please try again.',
      success: null
    });
  }
});

// Withdraw Page
router.get('/withdraw', async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id)
      .populate('account')
      .lean();

    if (!user || !user.account) {
      return res.redirect('/customer/dashboard?error=Account not found');
    }

    res.render('customer/withdraw', {
      user,
      error: null,
      success: null
    });
  } catch (error) {
    console.error('Withdraw page error:', error);
    res.redirect('/customer/dashboard?error=Error loading withdraw page');
  }
});

// Process Withdrawal
router.post('/withdraw', async (req, res) => {
  try {
    const { amount, description } = req.body;
    
    // Validation
    if (!amount || amount <= 0) {
      const user = await User.findById(req.session.user._id).populate('account').lean();
      return res.render('customer/withdraw', {
        user,
        error: 'Please enter a valid amount',
        success: null
      });
    }

    const withdrawAmount = parseFloat(amount);
    
    // Get user account
    const user = await User.findById(req.session.user._id).populate('account');
    if (!user || !user.account) {
      return res.render('customer/withdraw', {
        user: req.session.user,
        error: 'Account not found',
        success: null
      });
    }

    // Check sufficient balance
    if (user.account.balance < withdrawAmount) {
      return res.render('customer/withdraw', {
        user: user.toObject(),
        error: 'Insufficient balance',
        success: null
      });
    }

    // Check minimum balance (keep $10 minimum)
    if (user.account.balance - withdrawAmount < 10) {
      return res.render('customer/withdraw', {
        user: user.toObject(),
        error: 'Minimum balance of $10 must be maintained',
        success: null
      });
    }

    // Update account balance
    await Account.findByIdAndUpdate(user.account._id, {
      $inc: { balance: -withdrawAmount }
    });

    // Create transaction record
    await Transaction.create({
      type: 'withdrawal',
      amount: withdrawAmount,
      description: description || 'Cash withdrawal',
      sender: user.account._id,
      receiver: user.account._id,
      status: 'completed',
      timestamp: new Date()
    });

    res.redirect('/customer/dashboard?success=Withdrawal successful');

  } catch (error) {
    console.error('Withdrawal error:', error);
    const user = await User.findById(req.session.user._id).populate('account').lean();
    res.render('customer/withdraw', {
      user,
      error: 'Error processing withdrawal. Please try again.',
      success: null
    });
  }
});

// Transfer Page
router.get('/transfer', async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id)
      .populate('account')
      .lean();

    if (!user || !user.account) {
      return res.redirect('/customer/dashboard?error=Account not found');
    }

    res.render('customer/transfer', {
      user,
      error: null,
      success: null
    });
  } catch (error) {
    console.error('Transfer page error:', error);
    res.redirect('/customer/dashboard?error=Error loading transfer page');
  }
});

// Process Transfer
router.post('/transfer', async (req, res) => {
  try {
    const { recipientAccount, amount, description } = req.body;
    
    // Get sender user
    const sender = await User.findById(req.session.user._id).populate('account');
    if (!sender || !sender.account) {
      return res.render('customer/transfer', {
        user: req.session.user,
        error: 'Sender account not found',
        success: null
      });
    }

    // Validation
    if (!recipientAccount || !amount || amount <= 0) {
      return res.render('customer/transfer', {
        user: sender.toObject(),
        error: 'Please fill all required fields with valid values',
        success: null
      });
    }

    const transferAmount = parseFloat(amount);
    
    // Check if trying to transfer to own account
    if (recipientAccount === sender.account.accountNumber) {
      return res.render('customer/transfer', {
        user: sender.toObject(),
        error: 'Cannot transfer to your own account',
        success: null
      });
    }

    // Find recipient account
    const recipientAccountDoc = await Account.findOne({ accountNumber: recipientAccount });
    if (!recipientAccountDoc) {
      return res.render('customer/transfer', {
        user: sender.toObject(),
        error: 'Recipient account not found',
        success: null
      });
    }

    // Check if recipient account is active
    if (recipientAccountDoc.status !== 'active') {
      return res.render('customer/transfer', {
        user: sender.toObject(),
        error: 'Recipient account is not active',
        success: null
      });
    }

    // Check sufficient balance
    if (sender.account.balance < transferAmount) {
      return res.render('customer/transfer', {
        user: sender.toObject(),
        error: 'Insufficient balance',
        success: null
      });
    }

    // Check minimum balance after transfer
    if (sender.account.balance - transferAmount < 10) {
      return res.render('customer/transfer', {
        user: sender.toObject(),
        error: 'Minimum balance of $10 must be maintained',
        success: null
      });
    }

    // Process transfer
    await Account.findByIdAndUpdate(sender.account._id, {
      $inc: { balance: -transferAmount }
    });

    await Account.findByIdAndUpdate(recipientAccountDoc._id, {
      $inc: { balance: transferAmount }
    });

    // Create transaction record
    await Transaction.create({
      type: 'transfer',
      amount: transferAmount,
      description: description || 'Money transfer',
      sender: sender.account._id,
      receiver: recipientAccountDoc._id,
      status: 'completed',
      timestamp: new Date()
    });

    res.redirect('/customer/dashboard?success=Transfer successful');

  } catch (error) {
    console.error('Transfer error:', error);
    const user = await User.findById(req.session.user._id).populate('account').lean();
    res.render('customer/transfer', {
      user,
      error: 'Error processing transfer. Please try again.',
      success: null
    });
  }
});

// Account Profile
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id)
      .populate('account')
      .lean();

    if (!user) {
      return res.redirect('/auth/login');
    }

    res.render('customer/profile', {
      user,
      error: null,
      success: null
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.redirect('/customer/dashboard?error=Error loading profile');
  }
});

// Update Profile
router.post('/profile', async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;
    
    const user = await User.findById(req.session.user._id).populate('account');
    if (!user) {
      return res.redirect('/auth/login');
    }

    // Check if email is already taken by another user
    if (email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
      if (existingUser) {
        return res.render('customer/profile', {
          user: user.toObject(),
          error: 'Email is already taken by another user',
          success: null
        });
      }
    }

    // Update user
    await User.findByIdAndUpdate(req.session.user._id, {
      name: name || user.name,
      email: email || user.email,
      phone: phone || user.phone,
      address: address || user.address,
      updatedAt: new Date()
    });

    // Update session
    const updatedUser = await User.findById(req.session.user._id).lean();
    req.session.user = updatedUser;

    res.render('customer/profile', {
      user: updatedUser,
      error: null,
      success: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Profile update error:', error);
    const user = await User.findById(req.session.user._id).populate('account').lean();
    res.render('customer/profile', {
      user,
      error: 'Error updating profile. Please try again.',
      success: null
    });
  }
});

module.exports = router;