const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    accountNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    balance: {
        type: Number,
        default: 0,
        min: [0, 'Balance cannot be negative']
    },
    status: {
        type: String,
        enum: ['active', 'blocked', 'pending', 'closed'],
        default: 'pending'
    },
    accountType: {
        type: String,
        enum: ['savings', 'current', 'fixed'],
        default: 'savings'
    }
}, {
    timestamps: true
});

// Indexes for better performance
accountSchema.index({ accountNumber: 1 });
accountSchema.index({ userId: 1 });

module.exports = mongoose.model('Account', accountSchema);
