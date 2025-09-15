const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const router = express.Router();
const ejs = require('ejs');

// Middleware to check if user is authenticated and is a customer
router.use((req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'customer') {
    return res.redirect('/login');
  }
  next();
});

// Customer Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id).populate('account');
    const transactions = await Transaction.find({
      $or: [
        { sender: user.account._id },
        { receiver: user.account._id }
      ]
    }).sort({ timestamp: -1 }).limit(5).populate('sender receiver');
    
    res.render('customer/dashboard.ejs', { user, transactions });
  } catch (error) {
    res.render('customer/dashboard.ejs', { error: 'Error loading dashboard' });
  }
});

// Account Details
router.get('/account', async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id).populate('account');
    res.render('customer/account.ejs', { user });
  } catch (error) {
    res.render('customer/account.ejs', { error: 'Error loading account details' });
  }
});

// Deposit Money
router.get('/deposit', (req, res) => {
  res.render('customer/deposit.ejs');
});

router.post('/deposit', [
  body('amount').isFloat({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('customer/deposit.ejs', {
        error: 'Please enter a valid amount'
      });
    }

    const user = await User.findById(req.session.user._id).populate('account');
    const amount = parseFloat(req.body.amount);

    // Update account balance
    user.account.balance += amount;
    await user.account.save();

    // Create transaction record
    const transaction = new Transaction({
      type: 'deposit',
      amount,
      receiver: user.account._id,
      description: `Deposit to account ${user.account.accountNumber}`
    });
    await transaction.save();

    res.render('customer/deposit.ejs', {
      success: `Successfully deposited $${amount.toFixed(2)}`
    });
  } catch (error) {
    res.render('customer/deposit.ejs', {
      error: 'Error processing deposit'
    });
  }
});

// Withdraw Money
router.get('/withdraw', (req, res) => {
  res.render('customer/withdraw.ejs');
});

router.post('/withdraw', [
  body('amount').isFloat({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('customer/withdraw.ejs', {
        error: 'Please enter a valid amount'
      });
    }

    const user = await User.findById(req.session.user._id).populate('account');
    const amount = parseFloat(req.body.amount);

    if (user.account.balance < amount) {
      return res.render('customer/withdraw.ejs', {
        error: 'Insufficient funds'
      });
    }

    // Update account balance
    user.account.balance -= amount;
    await user.account.save();

    // Create transaction record
    const transaction = new Transaction({
      type: 'withdrawal',
      amount,
      sender: user.account._id,
      description: `Withdrawal from account ${user.account.accountNumber}`
    });
    await transaction.save();

    res.render('customer/withdraw.ejs', {
      success: `Successfully withdrew $${amount.toFixed(2)}`
    });
  } catch (error) {
    res.render('customer/withdraw.ejs', {
      error: 'Error processing withdrawal'
    });
  }
});

// Transfer Money
router.get('/transfer', (req, res) => {
  res.render('customer/transfer.ejs');
});

router.post('/transfer', [
  body('amount').isFloat({ min: 1 }),
  body('accountNumber').isLength({ min: 10, max: 10 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('customer/transfer.ejs', {
        error: 'Please provide valid transfer details'
      });
    }

    const user = await User.findById(req.session.user._id).populate('account');
    const amount = parseFloat(req.body.amount);
    const { accountNumber } = req.body;

    if (user.account.accountNumber === accountNumber) {
      return res.render('customer/transfer.ejs', {
        error: 'Cannot transfer to your own account'
      });
    }

    if (user.account.balance < amount) {
      return res.render('customer/transfer.ejs', {
        error: 'Insufficient funds'
      });
    }

    // Find recipient account
    const recipientAccount = await Account.findOne({ accountNumber });
    if (!recipientAccount || recipientAccount.status !== 'active') {
      return res.render('customer/transfer.ejs', {
        error: 'Recipient account not found or inactive'
      });
    }

    // Update balances
    user.account.balance -= amount;
    recipientAccount.balance += amount;

    await user.account.save();
    await recipientAccount.save();

    // Create transaction record
    const transaction = new Transaction({
      type: 'transfer',
      amount,
      sender: user.account._id,
      receiver: recipientAccount._id,
      description: `Transfer from ${user.account.accountNumber} to ${accountNumber}`
    });
    await transaction.save();

    res.render('customer/transfer.ejs', {
      success: `Successfully transferred $${amount.toFixed(2)} to account ${accountNumber}`
    });
  } catch (error) {
    res.render('customer/transfer.ejs', {
      error: 'Error processing transfer'
    });
  }
});

// Transaction History
router.get('/transactions', async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id).populate('account');
    const transactions = await Transaction.find({
      $or: [
        { sender: user.account._id },
        { receiver: user.account._id }
      ]
    }).sort({ timestamp: -1 }).populate('sender receiver');

    res.render('customer/transactions.ejs', { transactions });
  } catch (error) {
    res.render('customer/transactions.ejs', { error: 'Error loading transactions' });
  }
});

// Download Statement (simplified version)
router.get('/statement', async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id).populate('account');
    const transactions = await Transaction.find({
      $or: [
        { sender: user.account._id },
        { receiver: user.account._id }
      ]
    }).sort({ timestamp: -1 }).populate('sender receiver');
    
    // For PDF generation, you would use a library like pdfkit
    // For CSV generation, you would use a library like csv-writer
    // This is a simplified version that just shows the data
    
    if (req.query.format === 'pdf') {
      // Generate PDF logic would go here
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=statement-${Date.now()}.pdf`);
      // In a real implementation, you would generate the PDF here
      res.send('PDF generation would happen here');
    } else if (req.query.format === 'csv') {
      // Generate CSV logic would go here
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=statement-${Date.now()}.csv`);
      // In a real implementation, you would generate the CSV here
      res.send('Date,Type,Amount,Description\n' +
        transactions.map(t => 
          `${t.timestamp.toISOString().split('T')[0]},${t.type},${t.amount},${t.description}`
        ).join('\n'));
    } else {
      res.render('customer/statement.ejs', { transactions });
    }
  } catch (error) {
    res.render('customer/statement.ejs', { error: 'Error generating statement' });
  }
});

module.exports = router;