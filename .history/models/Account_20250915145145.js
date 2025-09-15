// Fix 1: Update the Account model to ensure proper references
// In your Account model (models/Account.js), ensure you have:
const AccountSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    accountNumber: {
        type: String,
        required: true,
        unique: true
    },
    accountType: {
        type: String,
        default: 'savings'
    },
    balance: {
        type: Number,
        default: 0,
        min: 0
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'pending', 'suspended'],
        default: 'active'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Fix 2: Update auth.js signup to properly link account
// In routes/auth.js, update the signup POST handler:
router.post('/signup', redirectIfAuthenticated, [
    // ... validation rules ...
], async (req, res) => {
    try {
        // ... existing validation code ...

        // Create user first WITHOUT accountId
        const user = new User({
            name,
            email,
            password: hashedPassword,
            role: 'customer',
            isActive: true  // Add this field
        });
        await user.save();

        // Create account with proper userId reference
        const accountNumber = generateAccountNumber();
        const account = new Account({
            userId: user._id,  // Use userId, not user
            accountNumber,
            balance: 1000,
            status: 'active',
            accountType: 'savings'
        });
        await account.save();

        // Update user with account reference
        user.accountId = account._id;
        await user.save();

        res.render('auth/login', {
            error: null,
            message: 'Account created successfully! You received ₹1000 welcome bonus. Please login.'
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.render('auth/signup', { 
            error: 'An error occurred. Please try again.',
            message: null 
        });
    }
});

// Fix 3: Update customer dashboard route to handle both userId and account lookup
// In routes/customer.js, update the dashboard route:
router.get('/dashboard', async (req, res) => {
    try {
        let account;
        
        // First try to get account from session
        if (req.session.user.accountId) {
            account = await Account.findById(req.session.user.accountId);
        }
        
        // If not found, try to find by userId
        if (!account) {
            const userId = req.session.user.id || req.session.user._id;
            account = await Account.findOne({ userId: userId });
            
            // Update session with found account
            if (account) {
                req.session.user.accountId = account._id;
                await req.session.save();
            }
        }
        
        // If still no account, create one
        if (!account) {
            const accountNumber = '100' + Date.now().toString().slice(-7);
            account = new Account({
                userId: req.session.user.id || req.session.user._id,
                accountNumber,
                balance: 1000, // Welcome bonus
                status: 'active',
                accountType: 'savings'
            });
            await account.save();
            
            // Update user record
            await User.findByIdAndUpdate(
                req.session.user.id || req.session.user._id,
                { accountId: account._id }
            );
            
            // Update session
            req.session.user.accountId = account._id;
            await req.session.save();
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

        const transactionCount = await Transaction.countDocuments({
            $or: [
                { accountId: account._id },
                { toAccountId: account._id }
            ]
        });

        res.render('customer/dashboard', {
            account,
            recentTransactions,
            stats: {
                totalDeposits: totalDeposits[0]?.total || 0,
                totalWithdrawals: totalWithdrawals[0]?.total || 0,
                transactionCount: transactionCount
            },
            user: req.session.user
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).render('error', { 
            message: 'Error loading dashboard: ' + error.message,
            error: { status: 500 }
        });
    }
});

// Fix 4: Update the login handler to properly set session
// In routes/auth.js, update login POST:
router.post('/login', redirectIfAuthenticated, [
    // ... validation ...
], async (req, res) => {
    try {
        // ... existing validation code ...

        const { email, password } = req.body;
        
        // Find user and populate account
        const user = await User.findOne({ email }).populate('accountId');

        if (!user) {
            return res.render('auth/login', { 
                error: 'Invalid email or password',
                message: null 
            });
        }

        // Check if user is active
        if (user.isActive === false) {
            return res.render('auth/login', { 
                error: 'Account is deactivated. Please contact support.',
                message: null 
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.render('auth/login', { 
                error: 'Invalid email or password',
                message: null 
            });
        }

        // For customers, ensure they have an account
        if (user.role === 'customer' && !user.accountId) {
            // Create account if missing
            const accountNumber = '100' + Date.now().toString().slice(-7);
            const account = new Account({
                userId: user._id,
                accountNumber,
                balance: 1000,
                status: 'active',
                accountType: 'savings'
            });
            await account.save();
            
            user.accountId = account._id;
            await user.save();
        }

        // Store complete user session
        req.session.user = {
            id: user._id.toString(),
            _id: user._id.toString(), // Store both formats
            name: user.name,
            email: user.email,
            role: user.role,
            accountId: user.accountId ? user.accountId._id || user.accountId : null
        };

        // Save session explicitly
        await req.session.save();

        // Redirect based on role
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

// Fix 5: Add a debug route to check session and account status
// Add this to customer.js for debugging:
router.get('/debug-account', async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
        const user = await User.findById(userId).populate('accountId');
        const accountByUser = await Account.findOne({ userId: userId });
        const accountById = req.session.user.accountId ? 
            await Account.findById(req.session.user.accountId) : null;
        
        res.json({
            session: req.session.user,
            userRecord: user ? {
                id: user._id,
                name: user.name,
                email: user.email,
                accountId: user.accountId
            } : null,
            accountByUserId: accountByUser,
            accountBySessionId: accountById
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});