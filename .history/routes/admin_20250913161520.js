const express = require('express');
const User = require('../models/User');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const ejs = require('ejs');
const router = express.Router();

// Middleware to check if user is authenticated and is an admin
router.use((req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/login');
  }
  next();
});

// Admin Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const totalCustomers = await User.countDocuments({ role: 'customer' });
    const totalAccounts = await Account.countDocuments();
    const pendingAccounts = await Account.countDocuments({ status: 'pending' });
    const totalTransactions = await Transaction.countDocuments();

    res.render('admin/dashboard.ejs', {
      totalCustomers,
      totalAccounts,
      pendingAccounts,
      totalTransactions
    });
  } catch (error) {
    res.render('admin/dashboard.ejs', { error: 'Error loading dashboard' });
  }
});

// Manage Accounts
router.get('/accounts', async (req, res) => {
  try {
    const statusFilter = req.query.status || 'all';
    let query = {};
    
    if (statusFilter !== 'all') {
      query.status = statusFilter;
    }
    
    const accounts = await Account.find(query)
      .populate('user')
      .sort({ createdAt: -1 });

    res.render('admin/accounts.ejs', { accounts, statusFilter });
  } catch (error) {
    res.render('admin/accounts.ejs', { error: 'Error loading accounts' });
  }
});

// Update Account Status
router.post('/accounts/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const account = await Account.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    res.json({ success: true, status: account.status });
  } catch (error) {
    res.status(500).json({ error: 'Error updating account status' });
  }
});

// View Transactions
router.get('/transactions', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    
    const transactions = await Transaction.find()
      .populate('sender receiver')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);
    
    const totalTransactions = await Transaction.countDocuments();
    const totalPages = Math.ceil(totalTransactions / limit);
    
    res.render('admin/transactions.ejs', {
      transactions,
      currentPage: page,
      totalPages
    });
  } catch (error) {
    res.render('admin/transactions.ejs', { error: 'Error loading transactions' });
  }
});

// Delete Account
router.post('/accounts/:id/delete', async (req, res) => {
  try {
    const { id } = req.params;
    
    const account = await Account.findById(id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Check if account has balance
    if (account.balance > 0) {
      return res.status(400).json({ error: 'Cannot delete account with balance' });
    }
    
    // Delete user and account
    await User.findOneAndDelete({ account: id });
    await Account.findByIdAndDelete(id);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting account' });
  }
});

module.exports = router;