// Example data for admin accounts page
const adminAccountsData = {
    user: {
        _id: "64f1a2b3c4d5e6f7g8h9i0j1",
        name: "Admin User",
        email: "admin@securebank.com",
        role: "admin"
    },
    
    stats: {
        active: 142,
        pending: 5,
        blocked: 9,
        totalBalance: 15750000
    },
    
    accounts: [
        {
            _id: "64f1a2b3c4d5e6f7g8h9i0ju",
            accountNumber: "1234567890",
            accountType: "savings",
            balance: 75000,
            status: "active",
            userId: {
                _id: "64f1a2b3c4d5e6f7g8h9i0jv",
                name: "John Smith",
                email: "john@example.com"
            },
            createdAt: "2023-10-15T10:00:00.000Z",
            lastTransaction: "2024-01-15T14:30:00.000Z"
        },
        {
            _id: "64f1a2b3c4d5e6f7g8h9i0jw",
            accountNumber: "0987654321",
            accountType: "current",
            balance: 125000,
            status: "active",
            userId: {
                _id: "64f1a2b3c4d5e6f7g8h9i0jx",
                name: "Jane Doe",
                email: "jane@example.com"
            },
            createdAt: "2023-11-20T14:30:00.000Z",
            lastTransaction: "2024-01-14T16:45:00.000Z"
        },
        {
            _id: "64f1a2b3c4d5e6f7g8h9i0jy",
            accountNumber: "9876543210",
            accountType: "savings",
            balance: 1000,
            status: "pending",
            userId: {
                _id: "64f1a2b3c4d5e6f7g8h9i0jz",
                name: "David Brown",
                email: "david@example.com"
            },
            createdAt: "2024-01-14T15:20:00.000Z",
            lastTransaction: null
        }
    ],
    
    search: "",
    filter: {
        status: "all",
        accountType: "all"
    },
    sort: "newest",
    currentPage: 1,
    totalPages: 8,
    totalAccounts: 156
};
module.exports = adminAccountsData;
// The above data can be used in the admin accounts route to render the accounts view with dynamic data.