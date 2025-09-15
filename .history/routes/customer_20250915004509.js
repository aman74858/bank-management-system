const express = require('express');
const { isAuthenticated, isCustomer } = require('../admin/auth');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const router = express.Router();
const { authenticateCustomer } = require('../middleware/auth');

// Apply middleware globally - choose one approach
router.use(isAuthenticated, isCustomer);

// Helper function to format currency
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
};

// Customer Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const account = await Account.findById(req.session.user.accountId);
        
        if (!account) {
            return res.status(404).render('error', { 
                message: 'Account not found',
                error: { status: 404 }
            });
        }

        // Get recent transactions
        const recentTransactions = await Transaction.find({
            $or: [
                { accountId: account._id },
                { toAccountId: account._id }
            ]
        })
        .populate('accountId', 'accountNumber')
        .populate('toAccountId', 'accountNumber')
        .sort({ createdAt: -1 })
        .limit(5);

        // Get transaction stats
        const totalDeposits = await Transaction.aggregate([
            { $match: { accountId: account._id, type: 'deposit', status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const totalWithdrawals = await Transaction.aggregate([
            { $match: { accountId: account._id, type: 'withdrawal', status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        res.render('customer/dashboard', {
            account,
            recentTransactions,
            stats: {
                totalDeposits: totalDeposits[0]?.total || 0,
                totalWithdrawals: totalWithdrawals[0]?.total || 0,
                transactionCount: recentTransactions.length
            },
            formatCurrency,
            user: req.session.user // Add user to template data
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).render('error', { 
            message: 'Error loading dashboard',
            error: { status: 500 }
        });
    }
});

// Deposit money
router.post('/deposit', async (req, res) => {
    try {
        const { amount, description } = req.body;
        const depositAmount = parseFloat(amount);

        if (!depositAmount || depositAmount <= 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Please enter a valid amount greater than 0' 
            });
        }

        if (depositAmount > 100000) {
            return res.status(400).json({ 
                success: false, 
                error: 'Maximum deposit limit is ₹1,00,000 per transaction' 
            });
        }

        const account = await Account.findById(req.session.user.accountId);
        
        // Update balance
        account.balance += depositAmount;
        await account.save();

        // Create transaction record
        const transaction = new Transaction({
            type: 'deposit',
            amount: depositAmount,
            accountId: account._id,
            description: description || 'Cash deposit',
            balanceAfter: account.balance,
            status: 'completed'
        });
        await transaction.save();

        res.json({ 
            success: true, 
            newBalance: account.balance,
            transactionId: transaction.transactionId,
            message: 'Deposit successful!'
        });

    } catch (error) {
        console.error('Deposit error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Transaction failed. Please try again.' 
        });
    }
});

// Withdraw money
router.post('/withdraw', async (req, res) => {
    try {
        const { amount, description } = req.body;
        const withdrawAmount = parseFloat(amount);

        if (!withdrawAmount || withdrawAmount <= 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Please enter a valid amount greater than 0' 
            });
        }

        const account = await Account.findById(req.session.user.accountId);

        // Check minimum balance (₹1000)
        const minBalance = 1000;
        if (account.balance - withdrawAmount < minBalance) {
            return res.status(400).json({ 
                success: false, 
                error: `Insufficient balance. Minimum balance of ₹${minBalance.toLocaleString()} must be maintained.` 
            });
        }

        if (withdrawAmount > 50000) {
            return res.status(400).json({ 
                success: false, 
                error: 'Maximum withdrawal limit is ₹50,000 per transaction' 
            });
        }

        // Update balance
        account.balance -= withdrawAmount;
        await account.save();

        // Create transaction record
        const transaction = new Transaction({
            type: 'withdrawal',
            amount: withdrawAmount,
            accountId: account._id,
            description: description || 'Cash withdrawal',
            balanceAfter: account.balance,
            status: 'completed'
        });
        await transaction.save();

        res.json({ 
            success: true, 
            newBalance: account.balance,
            transactionId: transaction.transactionId,
            message: 'Withdrawal successful!'
        });

    } catch (error) {
        console.error('Withdraw error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Transaction failed. Please try again.' 
        });
    }
});

// Transfer Page - Simplified middleware usage
router.get('/transfer', async (req, res) => {
    try {
        // Use session user instead of req.user for consistency
        const userId = req.session.user.id || req.session.user._id;
        console.log('User ID:', userId); // Debug log
        
        const account = await Account.findOne({ userId: userId }).populate('userId');
        
        console.log('Found account:', account); // Debug log
        
        if (!account) {
            // Create account if it doesn't exist
            const newAccountNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
            const newAccount = new Account({
                accountNumber: newAccountNumber,
                accountType: 'savings',
                balance: 1000, // Minimum balance
                userId: userId,
                status: 'active'
            });
            
            await newAccount.save();
            
            // Populate the userId field
            const populatedAccount = await Account.findById(newAccount._id).populate('userId');
            
            return res.render('customer/transfer', {
                user: req.session.user,
                account: populatedAccount,
                error: null,
                success: 'New account created successfully!'
            });
        }

        res.render('customer/transfer', {
            user: req.session.user,
            account: account,
            error: null,
            success: null
        });
    } catch (error) {
        console.error('Transfer page error:', error);
        res.status(500).render('error', { 
            error: 'Internal server error: ' + error.message,
            user: req.session.user 
        });
    }
});

// Transfer money
router.post('/transfer', async (req, res) => {
    try {
        const { accountNumber, amount, description } = req.body;
        const transferAmount = parseFloat(amount);

        const senderAccount = await Account.findById(req.session.user.accountId);

        if (!accountNumber || !transferAmount) {
            return res.render('customer/transfer', {
                account: senderAccount,
                user: req.session.user,
                error: 'Please fill all required fields',
                success: null
            });
        }

        if (transferAmount <= 0) {
            return res.render('customer/transfer', {
                account: senderAccount,
                user: req.session.user,
                error: 'Please enter a valid amount greater than 0',
                success: null
            });
        }

        const receiverAccount = await Account.findOne({ 
            accountNumber: accountNumber.trim(),
            status: 'active' 
        }).populate('userId', 'name');

        if (!receiverAccount) {
            return res.render('customer/transfer', {
                account: senderAccount,
                user: req.session.user,
                error: 'Receiver account not found or inactive',
                success: null
            });
        }

        if (senderAccount.accountNumber === receiverAccount.accountNumber) {
            return res.render('customer/transfer', {
                account: senderAccount,
                user: req.session.user,
                error: 'Cannot transfer to the same account',
                success: null
            });
        }

        // Check minimum balance (₹1000) after transfer
        const minBalance = 1000;
        if (senderAccount.balance - transferAmount < minBalance) {
            return res.render('customer/transfer', { // Fixed path
                account: senderAccount,
                user: req.session.user,
                error: `Insufficient balance. Minimum balance of ₹${minBalance.toLocaleString()} must be maintained.`,
                success: null
            });
        }

        if (transferAmount > 100000) {
            return res.render('customer/transfer', {
                account: senderAccount,
                user: req.session.user,
                error: 'Maximum transfer limit is ₹1,00,000 per transaction',
                success: null
            });
        }

        // Perform transfer
        senderAccount.balance -= transferAmount;
        receiverAccount.balance += transferAmount;

        await senderAccount.save();
        await receiverAccount.save();

        // Create transaction records
        const senderTransaction = new Transaction({
            type: 'transfer',
            amount: transferAmount,
            accountId: senderAccount._id,
            toAccountId: receiverAccount._id,
            description: description || `Transfer to ${receiverAccount.userId.name} (${accountNumber})`,
            balanceAfter: senderAccount.balance,
            status: 'completed'
        });

        const receiverTransaction = new Transaction({
            type: 'transfer',
            amount: transferAmount,
            accountId: receiverAccount._id,
            toAccountId: senderAccount._id,
            description: description || `Transfer from ${req.session.user.name} (${senderAccount.accountNumber})`,
            balanceAfter: receiverAccount.balance,
            status: 'completed'
        });

        await senderTransaction.save();
        await receiverTransaction.save();

        res.render('customer/transfer.ejs', {
            account: senderAccount,
            user: req.session.user,
            error: null,
            success: `Successfully transferred ₹${transferAmount.toLocaleString()} to ${receiverAccount.userId.name}. Transaction ID: ${senderTransaction.transactionId}`
        });

    } catch (error) {
        console.error('Transfer error:', error);
        const account = await Account.findById(req.session.user.accountId);
        res.render('customer/transfer', {
            account,
            user: req.session.user,
            error: 'Transfer failed. Please try again.',
            success: null
        });
    }
});

// Transaction history
router.get('/transactions', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const account = await Account.findById(req.session.user.accountId);
        
        const transactions = await Transaction.find({
            $or: [
                { accountId: account._id },
                { toAccountId: account._id }
            ]
        })
        .populate('accountId', 'accountNumber')
        .populate('toAccountId', 'accountNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

        const totalTransactions = await Transaction.countDocuments({
            $or: [
                { accountId: account._id },
                { toAccountId: account._id }
            ]
        });

        const totalPages = Math.ceil(totalTransactions / limit);

        res.render('customer/all', {
            account,
            transactions,
            currentPage: page,
            totalPages,
            totalTransactions,
            formatCurrency,
            user: req.session.user // Add user data
        });

    } catch (error) {
        console.error('Transactions error:', error);
        res.status(500).render('error', { 
            message: 'Error loading transactions',
            error: { status: 500 }
        });
    }
});

module.exports = router;