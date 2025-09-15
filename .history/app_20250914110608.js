const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customer');
const adminRoutes = require('./routes/admin');


const app = express();

// Database connection
mongoose.connect('mongodb://localhost:27017/bankdb', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ Connected to MongoDB');
    initializeData();
}).catch(err => console.error('❌ MongoDB connection error:', err));


// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());


app.use(session({
    secret: 'bank-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: 'mongodb://localhost:27017/bankdb'
    }),
    cookie: { 
        secure: false, 
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Make user available in all templates
app.use((req, res, next) => {
    res.locals.user = req.session.user;
    next();
});

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.use('/auth', authRoutes);
app.use('/customer', customerRoutes);
app.use('/admin', adminRoutes);

// Error handling middleware
app.use((req, res, next) => {
    res.status(404).render('error', { 
        message: 'Page not found',
        error: { status: 404 }
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { 
        message: 'Something went wrong!',
        error: { status: 500 }
    });
});

// Initialize sample data
async function initializeData() {
    const User = require('./models/User');
    const Account = require('./models/Account');
    const Transaction = require('./models/Transaction');
    const bcrypt = require('bcryptjs');

    try {
        // Check if data already exists
        const existingUsers = await User.countDocuments();
        if (existingUsers > 0) {
            console.log('📊 Sample data already exists');
            return;
        }

        console.log('🔄 Initializing sample data...');

        // Create sample admin
        const adminPassword = await bcrypt.hash('admin123', 12);
        const admin = new User({
            name: 'Bank Administrator',
            email: 'admin@securebank.com',
            password: adminPassword,
            role: 'admin'
        });
        await admin.save();

        // Create sample customers
        const customer1Password = await bcrypt.hash('john123', 12);
        const customer1 = new User({
            name: 'John Doe',
            email: 'john@email.com',
            password: customer1Password,
            role: 'customer'
        });
        await customer1.save();

        const customer2Password = await bcrypt.hash('jane123', 12);
        const customer2 = new User({
            name: 'Jane Smith',
            email: 'jane@email.com',
            password: customer2Password,
            role: 'customer'
        });
        await customer2.save();

        const customer3Password = await bcrypt.hash('mike123', 12);
        const customer3 = new User({
            name: 'Mike Johnson',
            email: 'mike@email.com',
            password: customer3Password,
            role: 'customer'
        });
        await customer3.save();

        // Create accounts
        const account1 = new Account({
            userId: customer1._id,
            accountNumber: '1001234567',
            balance: 75000,
            status: 'active'
        });
        await account1.save();

        const account2 = new Account({
            userId: customer2._id,
            accountNumber: '1001234568',
            balance: 125000,
            status: 'active'
        });
        await account2.save();

        const account3 = new Account({
            userId: customer3._id,
            accountNumber: '1001234569',
            balance: 45000,
            status: 'pending'
        });
        await account3.save();

        // Update users with account references
        customer1.accountId = account1._id;
        customer2.accountId = account2._id;
        customer3.accountId = account3._id;
        await customer1.save();
        await customer2.save();
        await customer3.save();

        // Create sample transactions
        const transactions = [
            {
                type: 'deposit',
                amount: 25000,
                accountId: account1._id,
                description: 'Salary credit',
                status: 'completed'
            },
            {
                type: 'deposit',
                amount: 50000,
                accountId: account2._id,
                description: 'Business income',
                status: 'completed'
            },
            {
                type: 'withdrawal',
                amount: 5000,
                accountId: account1._id,
                description: 'ATM withdrawal',
                status: 'completed'
            },
            {
                type: 'withdrawal',
                amount: 8000,
                accountId: account2._id,
                description: 'Cash withdrawal',
                status: 'completed'
            },
            {
                type: 'transfer',
                amount: 10000,
                accountId: account1._id,
                toAccountId: account2._id,
                description: 'Money transfer to Jane Smith',
                status: 'completed'
            },
            {
                type: 'deposit',
                amount: 15000,
                accountId: account3._id,
                description: 'Initial deposit',
                status: 'completed'
            }
        ];

        await Transaction.insertMany(transactions);

        console.log('✅ Sample data initialized successfully');
        console.log('👤 Demo Accounts:');
        console.log('   Admin: admin@securebank.com / admin123');
        console.log('   Customer 1: john@email.com / john123');
        console.log('   Customer 2: jane@email.com / jane123');
        console.log('   Customer 3: mike@email.com / mike123');

    } catch (error) {
        console.error('❌ Error initializing data:', error);
    }
}


app.listen(8080, () => {
  console.log("Server is running on port 8080");
});