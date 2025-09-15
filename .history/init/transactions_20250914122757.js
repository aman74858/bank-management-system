// Example data for admin all-transactions page
const allTransactionsData = {
    user: {
        _id: "64f1a2b3c4d5e6f7g8h9i0j1",
        name: "Admin User",
        email: "admin@securebank.com",
        role: "admin"
    },
    
    stats: {
        totalDeposits: 1245,
        totalWithdrawals: 876,
        totalTransfers: 726,
        depositAmount: 8950000,
        withdrawalAmount: 4200000,
        transferAmount: 2600000,
        todayTransactions: 23,
        todayAmount: 1250000
    },
    
    transactions: [
        {
            _id: "64f1a2b3c4d5e6f7g8h9i0jk",
            transactionId: "TXN001234567896",
            type: "transfer",
            amount: 25000,
            accountId: {
                _id: "64f1a2b3c4d5e6f7g8h9i0jl",
                accountNumber: "1111222233",
                userId: {
                    name: "Alice Cooper"
                }
            },
            toAccountId: {
                _id: "64f1a2b3c4d5e6f7g8h9i0jm",
                accountNumber: "4444555566",
                userId: {
                    name: "Bob Wilson"
                }
            },
            description: "Business partnership payment",
            status: "completed",
            createdAt: "2024-01-15T13:25:00.000Z"
        },
        {
            _id: "64f1a2b3c4d5e6f7g8h9i0jn",
            transactionId: "TXN001234567897",
            type: "deposit",
            amount: 50000,
            accountId: {
                _id: "64f1a2b3c4d5e6f7g8h9i0jo",
                accountNumber: "7777888899",
                userId: {
                    name: "Carol Johnson"
                }
            },
            toAccountId: null,
            description: "Investment returns",
            status: "completed",
            createdAt: "2024-01-15T12:10:00.000Z"
        },
        {
            _id: "64f1a2b3c4d5e6f7g8h9i0jp",
            transactionId: "TXN001234567898",
            type: "withdrawal",
            amount: 8000,
            accountId: {
                _id: "64f1a2b3c4d5e6f7g8h9i0jq",
                accountNumber: "9999000011",
                userId: {
                    name: "Dave Miller"
                }
            },
            toAccountId: null,
            description: "Emergency cash",
            status: "pending",
            createdAt: "2024-01-15T11:45:00.000Z"
        },
        {
            _id: "64f1a2b3c4d5e6f7g8h9i0jr",
            transactionId: "TXN001234567899",
            type: "transfer",
            amount: 12500,
            accountId: {
                _id: "64f1a2b3c4d5e6f7g8h9i0js",
                accountNumber: "2222333344",
                userId: {
                    name: "Eva Brown"
                }
            },
            toAccountId: {
                _id: "64f1a2b3c4d5e6f7g8h9i0jt",
                accountNumber: "5555666677",
                userId: {
                    name: "Frank Davis"
                }
            },
            description: "Loan repayment",
            status: "completed",
            createdAt: "2024-01-15T10:15:00.000Z"
        }
    ],
    
    search: "",
    filter: {
        type: "all",
        status: "all",
        dateFrom: "",
        dateTo: ""
    },
    sort: "newest",
    currentPage: 1,
    totalPages: 15,
    totalTransactions: 2847
};
module.exports = allTransactionsData;

// The above data can be used in the admin all-transactions route to render the transactions view with dynamic data.