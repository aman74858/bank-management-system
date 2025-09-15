// Example data for admin dashboard
const adminDashboardData = {
    user: {
        _id: "64f1a2b3c4d5e6f7g8h9i0j1",
        name: "Admin User",
        email: "admin@securebank.com",
        role: "admin"
    },
    
    stats: {
        totalCustomers: 156,
        newCustomersThisMonth: 12,
        totalBalance: 15750000, // ₹157.5L
        totalTransactions: 2847,
        transactionsToday: 23,
        pendingAccounts: 5,
        activeAccounts: 142,
        blockedAccounts: 9,
        totalDeposits: 1245,
        totalWithdrawals: 876,
        totalTransfers: 726,
        depositAmount: 8950000, // ₹89.5L
        withdrawalAmount: 4200000, // ₹42L
        transferAmount: 2600000, // ₹26L
        todayAmount: 1250000 // ₹12.5L
    },
    
    recentTransactions: [
        {
            _id: "64f1a2b3c4d5e6f7g8h9i0j2",
            transactionId: "TXN001234567890",
            type: "transfer",
            amount: 15000,
            accountId: {
                _id: "64f1a2b3c4d5e6f7g8h9i0j3",
                accountNumber: "1234567890",
                userId: {
                    name: "John Smith"
                }
            },
            toAccountId: {
                _id: "64f1a2b3c4d5e6f7g8h9i0j4",
                accountNumber: "0987654321",
                userId: {
                    name: "Jane Doe"
                }
            },
            description: "Monthly rent payment",
            status: "completed",
            createdAt: "2024-01-15T10:30:00.000Z"
        },
        {
            _id: "64f1a2b3c4d5e6f7g8h9i0j5",
            transactionId: "TXN001234567891",
            type: "deposit",
            amount: 25000,
            accountId: {
                _id: "64f1a2b3c4d5e6f7g8h9i0j6",
                accountNumber: "2468135790",
                userId: {
                    name: "Mike Johnson"
                }
            },
            toAccountId: null,
            description: "Salary credit",
            status: "completed",
            createdAt: "2024-01-15T09:15:00.000Z"
        },
        {
            _id: "64f1a2b3c4d5e6f7g8h9i0j7",
            transactionId: "TXN001234567892",
            type: "withdrawal",
            amount: 5000,
            accountId: {
                _id: "64f1a2b3c4d5e6f7g8h9i0j8",
                accountNumber: "1357924680",
                userId: {
                    name: "Sarah Wilson"
                }
            },
            toAccountId: null,
            description: "ATM withdrawal",
            status: "completed",
            createdAt: "2024-01-15T08:45:00.000Z"
        }
    ],
    
    pendingAccounts: [
        {
            _id: "64f1a2b3c4d5e6f7g8h9i0j9",
            accountNumber: "9876543210",
            accountType: "savings",
            status: "pending",
            balance: 1000,
            userId: {
                _id: "64f1a2b3c4d5e6f7g8h9i0ja",
                name: "David Brown",
                email: "david@example.com"
            },
            createdAt: "2024-01-14T15:20:00.000Z"
        },
        {
            _id: "64f1a2b3c4d5e6f7g8h9i0jb",
            accountNumber: "5432167890",
            accountType: "current",
            status: "pending",
            balance: 5000,
            userId: {
                _id: "64f1a2b3c4d5e6f7g8h9i0jc",
                name: "Emily Davis",
                email: "emily@example.com"
            },
            createdAt: "2024-01-14T12:10:00.000Z"
        }
    ]
};
