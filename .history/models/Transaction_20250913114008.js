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
    min: 0
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account'
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account'
  },
  description: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);