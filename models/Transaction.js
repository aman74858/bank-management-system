const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['deposit', 'withdrawal', 'transfer'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: [1, 'Amount must be greater than 0']
    },
    accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account',
        required: true
    },
    toAccountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account',
        default: null
    },
    description: {
        type: String,
        default: '',
        maxlength: [200, 'Description cannot exceed 200 characters']
    },
    status: {
        type: String,
        enum: ['completed', 'pending', 'failed'],
        default: 'completed'
    },
    transactionId: {
        type: String,
        unique: true,
        default: function() {
            return 'TXN' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
        }
    },
    balanceAfter: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Indexes for better performance
transactionSchema.index({ accountId: 1, createdAt: -1 });
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ type: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
