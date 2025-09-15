const express = require('express');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const PDFDocument = require('pdfkit');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Middleware to check authentication
const isAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

// Get transaction history
router.get('/history', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    
    let query = {};
    let account = null;
    
    if (user.role === 'customer') {
      // For customers, only show their transactions
      account = await Account.findOne({ userId: user._id });
      if (account) {
        query = {
          $or: [
            { accountId: account._id },
            { toAccountId: account._id }
          ]
        };
      }
    }
    
    const transactions = await Transaction.find(query)
      .populate('accountId', 'accountNumber')
      .populate('toAccountId', 'accountNumber')
      .sort({ createdAt: -1 }) // Changed from timestamp to createdAt
      .skip(skip)
      .limit(limit);
    
    const totalTransactions = await Transaction.countDocuments(query);
    const totalPages = Math.ceil(totalTransactions / limit);

    res.render('transaction/history', {
      transactions,
      currentPage: page,
      totalPages,
      totalTransactions,
      account,
      user: req.session.user
    });
  } catch (error) {
    console.error('Transaction history error:', error);
    res.render('transaction/history', {
      error: 'Error loading transaction history',
      transactions: [],
      currentPage: 1,
      totalPages: 0,
      totalTransactions: 0,
      user: req.session.user
    });
  }
});

// Download statement as PDF
router.get('/statement/pdf', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;
    const account = await Account.findOne({ userId: user._id });
    
    if (!account) {
      return res.status(404).send('Account not found');
    }
    
    const transactions = await Transaction.find({
      $or: [
        { accountId: account._id },
        { toAccountId: account._id }
      ]
    })
    .populate('accountId', 'accountNumber')
    .populate('toAccountId', 'accountNumber')
    .sort({ createdAt: -1 });
    
    const doc = new PDFDocument();
    const filename = `statement-${account.accountNumber}-${Date.now()}.pdf`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');
    
    doc.pipe(res);
    
    // Add content to PDF
    doc.fontSize(20).text('Bank Statement', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Account Number: ${account.accountNumber}`);
    doc.text(`Account Holder: ${user.name}`);
    doc.text(`Generated On: ${new Date().toLocaleDateString()}`);
    doc.text(`Current Balance: ₹${account.balance.toLocaleString()}`);
    doc.moveDown();
    
    // Table header
    const startY = 200;
    doc.font('Helvetica-Bold');
    doc.text('Date', 50, startY);
    doc.text('Description', 150, startY);
    doc.text('Type', 350, startY);
    doc.text('Amount', 420, startY);
    doc.text('Balance', 480, startY);
    
    // Draw line under header
    doc.moveTo(50, startY + 15).lineTo(550, startY + 15).stroke();
    
    doc.font('Helvetica');
    let y = startY + 25;
    
    transactions.forEach(transaction => {
      if (y > 700) {
        doc.addPage();
        y = 100;
      }
      
      const date = new Date(transaction.createdAt).toLocaleDateString();
      let description = transaction.description || '';
      let amount = transaction.amount;
      let amountPrefix = '';
      
      if (transaction.type === 'deposit') {
        description = description || 'Cash Deposit';
        amountPrefix = '+₹';
      } else if (transaction.type === 'withdrawal') {
        description = description || 'Cash Withdrawal';
        amountPrefix = '-₹';
      } else if (transaction.type === 'transfer') {
        if (transaction.accountId && transaction.accountId._id.equals(account._id)) {
          description = description || `Transfer to ${transaction.toAccountId?.accountNumber || 'Unknown'}`;
          amountPrefix = '-₹';
        } else {
          description = description || `Transfer from ${transaction.accountId?.accountNumber || 'Unknown'}`;
          amountPrefix = '+₹';
        }
      }
      
      doc.text(date, 50, y);
      doc.text(description.substring(0, 25), 150, y);
      doc.text(transaction.type.toUpperCase(), 350, y);
      doc.text(amountPrefix + amount.toLocaleString(), 420, y);
      doc.text('₹' + (transaction.balanceAfter || 0).toLocaleString(), 480, y);
      
      y += 20;
    });
    
    doc.end();
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).send('Error generating PDF statement');
  }
});

// Download statement as CSV
router.get('/statement/csv', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;
    const account = await Account.findOne({ userId: user._id });
    
    if (!account) {
      return res.status(404).send('Account not found');
    }
    
    const transactions = await Transaction.find({
      $or: [
        { accountId: account._id },
        { toAccountId: account._id }
      ]
    })
    .populate('accountId', 'accountNumber')
    .populate('toAccountId', 'accountNumber')
    .sort({ createdAt: -1 });
    
    const filename = `statement-${account.accountNumber}-${Date.now()}.csv`;
    const tempPath = path.join(__dirname, '..', 'temp', filename);
    
    // Ensure temp directory exists
    const tempDir = path.dirname(tempPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const csvWriter = createCsvWriter({
      path: tempPath,
      header: [
        { id: 'date', title: 'Date' },
        { id: 'description', title: 'Description' },
        { id: 'type', title: 'Type' },
        { id: 'amount', title: 'Amount' },
        { id: 'balance', title: 'Balance After' }
      ]
    });
    
    const records = transactions.map(transaction => {
      let description = transaction.description || '';
      
      if (transaction.type === 'deposit') {
        description = description || 'Cash Deposit';
      } else if (transaction.type === 'withdrawal') {
        description = description || 'Cash Withdrawal';
      } else if (transaction.type === 'transfer') {
        if (transaction.accountId && transaction.accountId._id.equals(account._id)) {
          description = description || `Transfer to ${transaction.toAccountId?.accountNumber || 'Unknown'}`;
        } else {
          description = description || `Transfer from ${transaction.accountId?.accountNumber || 'Unknown'}`;
        }
      }
      
      return {
        date: new Date(transaction.createdAt).toLocaleDateString(),
        description: description,
        type: transaction.type.toUpperCase(),
        amount: transaction.amount,
        balance: transaction.balanceAfter || 0
      };
    });
    
    await csvWriter.writeRecords(records);
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/csv');
    
    // Stream the file and delete it after sending
    const stream = fs.createReadStream(tempPath);
    stream.pipe(res);
    
    stream.on('end', () => {
      // Clean up the temporary file
      fs.unlink(tempPath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    });
    
  } catch (error) {
    console.error('CSV generation error:', error);
    res.status(500).send('Error generating CSV statement');
  }
});

// Get transaction details by ID
router.get('/details/:id', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;
    const transactionId = req.params.id;
    
    let query = { _id: transactionId };
    
    if (user.role === 'customer') {
      const account = await Account.findOne({ userId: user._id });
      if (account) {
        query.$or = [
          { accountId: account._id },
          { toAccountId: account._id }
        ];
      }
    }
    
    const transaction = await Transaction.findOne(query)
      .populate('accountId', 'accountNumber')
      .populate('toAccountId', 'accountNumber');
    
    if (!transaction) {
      return res.status(404).render('error', {
        message: 'Transaction not found',
        user: req.session.user
      });
    }
    
    res.render('transaction/details', {
      transaction,
      user: req.session.user
    });
    
  } catch (error) {
    console.error('Transaction details error:', error);
    res.status(500).render('error', {
      message: 'Error loading transaction details',
      user: req.session.user
    });
  }
});

module.exports = router;