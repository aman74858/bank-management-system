const express = require('express');
const User = require('../models/User');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const router = express.Router();

// Middleware to check if user is authenticated and is an admin
router.use((req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/auth/login'); // Fixed route path
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
    
    // Get recent transactions for dashboard
    const recentTransactions = await Transaction.find()
      .populate('sender receiver', 'name email') // Only populate needed fields
      .sort({ timestamp: -1 })
      .limit(5);

    res.render('admin/dashboard', { // Removed .ejs extension (not needed)
      totalCustomers,
      totalAccounts,
      pendingAccounts,
      totalTransactions,
      recentTransactions,
      user: req.session.user // Pass user data to template
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.render('admin/dashboard', { 
      error: 'Error loading dashboard',
      user: req.session.user,
      totalCustomers: 0,
      totalAccounts: 0,
      pendingAccounts: 0,
      totalTransactions: 0,
      recentTransactions: []
    });
  }
});

// Manage Accounts
router.get('/accounts', async (req, res) => {
  try {
    const statusFilter = req.query.status || 'all';
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    
    let query = {};
    
    if (statusFilter !== 'all') {
      query.status = statusFilter;
    }
    
    const accounts = await Account.find(query)
      .populate('user', 'name email phone') // Only populate needed user fields
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalAccounts = await Account.countDocuments(query);
    const totalPages = Math.ceil(totalAccounts / limit);

    res.render('admin/accounts', { 
      accounts, 
      statusFilter,
      currentPage: page,
      totalPages,
      user: req.session.user
    });
  } catch (error) {
    console.error('Accounts error:', error);
    res.render('admin/accounts', { 
      error: 'Error loading accounts',
      accounts: [],
      statusFilter: 'all',
      currentPage: 1,
      totalPages: 0,
      user: req.session.user
    });
  }
});

// Update Account Status
router.post('/accounts/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Validate status
    const validStatuses = ['active', 'inactive', 'pending', 'suspended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const account = await Account.findByIdAndUpdate(
      id,
      { 
        status,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    res.json({ success: true, status: account.status });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Error updating account status' });
  }
});

// View All Transactions
router.get('/transactions', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const type = req.query.type || 'all';
    const status = req.query.status || 'all';
    
    let query = {};
    
    if (type !== 'all') {
      query.type = type;
    }
    
    if (status !== 'all') {
      query.status = status;
    }
    
    const transactions = await Transaction.find(query)
      .populate('sender', 'accountNumber name email')
      .populate('receiver', 'accountNumber name email')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);
    
    const totalTransactions = await Transaction.countDocuments(query);
    const totalPages = Math.ceil(totalTransactions / limit);
    
    res.render('admin/transactions', {
      transactions,
      currentPage: page,
      totalPages,
      typeFilter: type,
      statusFilter: status,
      user: req.session.user
    });
  } catch (error) {
    console.error('Transactions error:', error);
    res.render('admin/transactions', { 
      error: 'Error loading transactions',
      transactions: [],
      currentPage: 1,
      totalPages: 0,
      typeFilter: 'all',
      statusFilter: 'all',
      user: req.session.user
    });
  }
});

// Get All Users
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const role = req.query.role || 'all';
    
    let query = {};
    
    if (role !== 'all') {
      query.role = role;
    }
    
    const users = await User.find(query)
      .populate('account')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit);
    
    res.render('admin/users', {
      users,
      currentPage: page,
      totalPages,
      roleFilter: role,
      user: req.session.user
    });
  } catch (error) {
    console.error('Users error:', error);
    res.render('admin/users', {
      error: 'Error loading users',
      users: [],
      currentPage: 1,
      totalPages: 0,
      roleFilter: 'all',
      user: req.session.user
    });
  }
});

// Delete Account (Improved with better validation)
router.post('/accounts/:id/delete', async (req, res) => {
  try {
    const { id } = req.params;
    
    const account = await Account.findById(id).populate('user');
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Check if account has balance
    if (account.balance > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete account with remaining balance',
        balance: account.balance
      });
    }
    
    // Check for pending transactions
    const pendingTransactions = await Transaction.countDocuments({
      $or: [
        { sender: id },
        { receiver: id }
      ],
      status: 'pending'
    });
    
    if (pendingTransactions > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete account with pending transactions' 
      });
    }
    
    // Delete related data
    await Transaction.deleteMany({
      $or: [
        { sender: id },
        { receiver: id }
      ]
    });
    
    // Delete user and account
    if (account.user) {
      await User.findByIdAndDelete(account.user._id);
    }
    await Account.findByIdAndDelete(id);
    
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Error deleting account' });
  }
});

// Block/Unblock User
router.post('/users/:id/block', async (req, res) => {
  try {
    const { id } = req.params;
    const { blocked } = req.body;
    
    const user = await User.findByIdAndUpdate(
      id,
      { 
        blocked: blocked === 'true',
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      success: true, 
      blocked: user.blocked,
      message: user.blocked ? 'User blocked successfully' : 'User unblocked successfully'
    });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Error updating user status' });
  }
});

// Get specific transaction details
router.get('/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const transaction = await Transaction.findById(id)
      .populate('sender', 'accountNumber name email phone')
      .populate('receiver', 'accountNumber name email phone');
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json({ success: true, transaction });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ error: 'Error fetching transaction details' });
  }
});

// Admin logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Error logging out' });
    }
    res.clearCookie('connect.sid'); // Clear session cookie
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

module.exports = router;