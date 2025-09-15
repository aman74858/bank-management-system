const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const { authenticateCustomer } = require('../middleware/auth');

// Customer Dashboard
router.get('/dashboard', authenticateCustomer, async (req, res) => {
    try {
        const account = await Account.findOne({ userId: req.user._id }).populate('userId');
        
        if (!account) {
            return res.status(404).render('error', { 
                error: 'Account not found',
                user: req.user 
            });
        }

        // Get recent transactions
        const recentTransactions = await Transaction.find({
            $or: [
                { accountId: account._id },
                { toAccountId: account._id }
            ]
        })
        .populate({
            path: 'accountId',
            select: 'accountNumber'
        })
        .populate({
            path: 'toAccountId',
            select: 'accountNumber'
        })
        .sort({ createdAt: -1 })
        .limit(10);

        // Calculate statistics
        const depositTransactions = await Transaction.find({ 
            accountId: account._id, 
            type: 'deposit' 
        });
        const withdrawalTransactions = await Transaction.find({ 
            accountId: account._id, 
            type: 'withdrawal' 
        });

        const totalDeposits = depositTransactions.reduce((sum, t) => sum + t.amount, 0);
        const totalWithdrawals = withdrawalTransactions.reduce((sum, t) => sum + t.amount, 0);
        const transactionCount = await Transaction.countDocuments({
            $or: [
                { accountId: account._id },
                { toAccountId: account._id }
            ]
        });

        const stats = {
            totalDeposits,
            totalWithdrawals,
            transactionCount
        };

        res.render('customer/dashboard', {
            user: req.user,
            account,
            stats,
            recentTransactions
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { 
            error: 'Internal server error',
            user: req.user 
        });
    }
});

// Transfer Page
router.get('/transfer', authenticateCustomer, async (req, res) => {
    try {
        const account = await Account.findOne({ userId: req.user._id });
        
        res.render('customer/transfer', {
            user: req.user,
            account,
            error: null,
            success: null
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { 
            error: 'Internal server error',
            user: req.user 
        });
    }
});

// Transactions Page
router.get('/transactions', authenticateCustomer, async (req, res) => {
    try {
        const account = await Account.findOne({ userId: req.user._id });
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        const transactions = await Transaction.find({
            $or: [
                { accountId: account._id },
                { toAccountId: account._id }
            ]
        })
        .populate('accountId toAccountId')
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

        res.render('customer/transactions', {
            user: req.user,
            account,
            transactions,
            currentPage: page,
            totalPages
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { 
            error: 'Internal server error',
            user: req.user 
        });
    }
});

// Verify Account
router.post('/verify-account', authenticateCustomer, async (req, res) => {
    try {
        const { accountNumber } = req.body;
        
        const account = await Account.findOne({ 
            accountNumber,
            status: 'active'
        }).populate('userId', 'name');
        
        if (!account) {
            return res.json({ success: false, error: 'Account not found' });
        }

        // Don't allow self-transfer
        const senderAccount = await Account.findOne({ userId: req.user._id });
        if (account._id.toString() === senderAccount._id.toString()) {
            return res.json({ success: false, error: 'Cannot transfer to your own account' });
        }

        res.json({ success: true, account });
    } catch (error) {
        console.error(error);
        res.json({ success: false, error: 'Verification failed' });
    }
});

// Transfer Money
router.post('/transfer', authenticateCustomer, async (req, res) => {
    try {
        const { accountNumber, amount, description } = req.body;
        const transferAmount = parseFloat(amount);

        if (!accountNumber || !amount || transferAmount <= 0) {
            return res.json({ 
                success: false, 
                error: 'Please provide valid account number and amount' 
            });
        }

        const senderAccount = await Account.findOne({ userId: req.user._id });
        const receiverAccount = await Account.findOne({ 
            accountNumber,
            status: 'active'
        });

        if (!receiverAccount) {
            return res.json({ 
                success: false, 
                error: 'Receiver account not found' 
            });
        }

        if (receiverAccount._id.toString() === senderAccount._id.toString()) {
            return res.json({ 
                success: false, 
                error: 'Cannot transfer to your own account' 
            });
        }

        if (senderAccount.balance - transferAmount < 1000) {
            return res.json({ 
                success: false, 
                error: 'Insufficient funds. Minimum balance of ₹1,000 must be maintained' 
            });
        }

        if (transferAmount > 100000) {
            return res.json({ 
                success: false, 
                error: 'Transfer amount cannot exceed ₹1,00,000' 
            });
        }

        // Create transaction ID
        const transactionId = 'TXN' + Date.now() + Math.floor(Math.random() * 1000);

        // Deduct from sender
        senderAccount.balance -= transferAmount;
        await senderAccount.save();

        // Add to receiver
        receiverAccount.balance += transferAmount;
        await receiverAccount.save();

        // Create transaction record for sender
        const senderTransaction = new Transaction({
            transactionId,
            type: 'transfer',
            amount: transferAmount,
            accountId: senderAccount._id,
            toAccountId: receiverAccount._id,
            description: description || 'Money transfer',
            status: 'completed',
            balanceAfter: senderAccount.balance
        });
        await senderTransaction.save();

        // Create transaction record for receiver
        const receiverTransaction = new Transaction({
            transactionId: transactionId + '_IN',
            type: 'transfer',
            amount: transferAmount,
            accountId: receiverAccount._id,
            fromAccountId: senderAccount._id,
            description: (description || 'Money received') + ` - From: ${senderAccount.accountNumber}`,
            status: 'completed',
            balanceAfter: receiverAccount.balance
        });
        await receiverTransaction.save();

        res.json({ 
            success: true, 
            message: `Transfer successful! ₹${transferAmount.toLocaleString()} sent to account ${accountNumber}`,
            newBalance: senderAccount.balance
        });

    } catch (error) {
        console.error(error);
        res.json({ 
            success: false, 
            error: 'Transfer failed. Please try again.' 
        });
    }
});

// Deposit Money
router.post('/deposit', authenticateCustomer, async (req, res) => {
    try {
        const { amount, description } = req.body;
        const depositAmount = parseFloat(amount);

        if (!amount || depositAmount <= 0 || depositAmount > 100000) {
            return res.json({ success: false, error: 'Invalid amount' });
        }

        const account = await Account.findOne({ userId: req.user._id });
        
        // Create transaction ID
        const transactionId = 'TXN' + Date.now() + Math.floor(Math.random() * 1000);

        // Update balance
        account.balance += depositAmount;
        await account.save();

        // Create transaction record
        const transaction = new Transaction({
            transactionId,
            type: 'deposit',
            amount: depositAmount,
            accountId: account._id,
            description: description || 'Cash deposit',
            status: 'completed',
            balanceAfter: account.balance
        });

        await transaction.save();

        res.json({ 
            success: true, 
            message: `₹${depositAmount.toLocaleString()} deposited successfully!`,
            newBalance: account.balance
        });

    } catch (error) {
        console.error(error);
        res.json({ success: false, error: 'Deposit failed' });
    }
});

// Withdraw Money
router.post('/withdraw', authenticateCustomer, async (req, res) => {
    try {
        const { amount, description } = req.body;
        const withdrawAmount = parseFloat(amount);

        if (!amount || withdrawAmount <= 0) {
            return res.json({ success: false, error: 'Invalid amount' });
        }

        const account = await Account.findOne({ userId: req.user._id });

        if (account.balance - withdrawAmount < 1000) {
            return res.json({ 
                success: false, 
                error: 'Insufficient funds. Minimum balance of ₹1,000 must be maintained' 
            });
        }

        if (withdrawAmount > 50000) {
            return res.json({ 
                success: false, 
                error: 'Withdrawal amount cannot exceed ₹50,000 per transaction' 
            });
        }

        // Create transaction ID
        const transactionId = 'TXN' + Date.now() + Math.floor(Math.random() * 1000);

        // Update balance
        account.balance -= withdrawAmount;
        await account.save();

        // Create transaction record
        const transaction = new Transaction({
            transactionId,
            type: 'withdrawal',
            amount: withdrawAmount,
            accountId: account._id,
            description: description || 'Cash withdrawal',
            status: 'completed',
            balanceAfter: account.balance
        });

        await transaction.save();

        res.json({ 
            success: true, 
            message: `₹${withdrawAmount.toLocaleString()} withdrawn successfully!`,
            newBalance: account.balance
        });

    } catch (error) {
        console.error(error);
        res.json({ success: false, error: 'Withdrawal failed' });
    }
});

// Download Statement
router.get('/statement', authenticateCustomer, async (req, res) => {
    try {
        const format = req.query.format || 'pdf';
        const account = await Account.findOne({ userId: req.user._id });
        
        const transactions = await Transaction.find({
            $or: [
                { accountId: account._id },
                { toAccountId: account._id }
            ]
        })
        .populate('accountId toAccountId')
        .sort({ createdAt: -1 });

        if (format === 'csv') {
            let csv = 'Date,Transaction ID,Type,Description,Amount,Balance,Status\n';
            
            transactions.forEach(transaction => {
                const isCredit = transaction.type === 'deposit' || 
                    (transaction.type === 'transfer' && transaction.toAccountId && 
                     transaction.toAccountId._id.toString() === account._id.toString());
                
                const amount = isCredit ? `+${transaction.amount}` : `-${transaction.amount}`;
                csv += `"${transaction.createdAt.toLocaleDateString()}","${transaction.transactionId}","${transaction.type}","${transaction.description}","${amount}","${transaction.balanceAfter || account.balance}","${transaction.status}"\n`;
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="statement-${account.accountNumber}.csv"`);
            return res.send(csv);
        } else if (format === 'excel') {
            // For Excel, we'll just redirect to CSV for now
            return res.redirect('/customer/statement?format=csv');
        } else {
            // For PDF, we'll just redirect to CSV for now
            return res.redirect('/customer/statement?format=csv');
        }

    } catch (error) {
        console.error('Statement generation error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Statement generation failed' 
        });
    }
});

module.exports = router;
