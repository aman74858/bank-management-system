// Customer Dashboard
router.get('/dashboard', authenticateCustomer, async (req, res) => {
    try {
        let account = await Account.findOne({ userId: req.user._id }).populate('userId');
        
        if (!account) {
            // Auto-create account
            const accountNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
            account = new Account({
                accountNumber,
                accountType: 'savings',
                balance: 1000,
                userId: req.user._id,
                status: 'active'
            });
            await account.save();
            account = await Account.findById(account._id).populate('userId');
        }

        // Rest of your dashboard code...
        const recentTransactions = await Transaction.find({
            $or: [
                { accountId: account._id },
                { toAccountId: account._id }
            ]
        })
        .populate('accountId toAccountId')
        .sort({ createdAt: -1 })
        .limit(10);

        // ... rest of your code
        
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).render('error', { 
            error: 'Internal server error',
            user: req.user 
        });
    }
});
