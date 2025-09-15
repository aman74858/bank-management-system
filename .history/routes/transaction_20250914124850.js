const express = require('express');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const PDFDocument = require('pdfkit');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const ejs = require('ejs');
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
    if (user.role === 'customer') {
      // For customers, only show their transactions
      const account = await Account.findOne({ user: user._id });
      query = {
        $or: [
          { sender: account._id },
          { receiver: account._id }
        ]
      };
    }
    
    const transactions = await Transaction.find(query)
      .populate('sender receiver', 'accountNumber')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);
    
    const totalTransactions = await Transaction.countDocuments(query);
    const totalPages = Math.ceil(totalTransactions / limit);

    res.render('transaction/history.ejs', {
      transactions,
      currentPage: page,
      totalPages,
      user: req.session.user
    });
  } catch (error) {
    res.render('transaction/history.ejs', {
      error: 'Error loading transaction history',
      user: req.session.user
    });
  }
});

// Download statement as PDF
router.get('/statement/pdf', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;
    const account = await Account.findOne({ user: user._id });
    
    const transactions = await Transaction.find({
      $or: [
        { sender: account._id },
        { receiver: account._id }
      ]
    }).populate('sender receiver', 'accountNumber').sort({ timestamp: -1 });
    
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
    doc.text(`Statement Period: ${new Date().toLocaleDateString()}`);
    doc.moveDown();
    
    // Table header
    doc.text('Date', 50, 200);
    doc.text('Description', 150, 200);
    doc.text('Amount', 400, 200);
    doc.text('Balance', 480, 200);
    
    let y = 220;
    let runningBalance = account.balance;
    
    transactions.forEach(transaction => {
      if (y > 700) {
        doc.addPage();
        y = 100;
      }
      
      const date = transaction.timestamp.toLocaleDateString();
      let description = '';
      
      if (transaction.type === 'deposit') {
        description = 'Deposit';
        runningBalance -= transaction.amount; // Subtract because we're going backwards
      } else if (transaction.type === 'withdrawal') {
        description = 'Withdrawal';
        runningBalance += transaction.amount;
      } else if (transaction.type === 'transfer') {
        if (transaction.sender && transaction.sender._id.equals(account._id)) {
          description = `Transfer to ${transaction.receiver.accountNumber}`;
          runningBalance += transaction.amount;
        } else {
          description = `Transfer from ${transaction.sender.accountNumber}`;
          runningBalance -= transaction.amount;
        }
      }
      
      doc.text(date, 50, y);
      doc.text(description, 150, y);
      doc.text(transaction.amount.toFixed(2), 400, y);
      doc.text(runningBalance.toFixed(2), 480, y);
      
      y += 20;
    });
    
    doc.end();
  } catch (error) {
    res.status(500).send('Error generating PDF statement');
  }
});

// Download statement as CSV
router.get('/statement/csv', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;
    const account = await Account.findOne({ user: user._id });
    
    const transactions = await Transaction.find({
      $or: [
        { sender: account._id },
        { receiver: account._id }
      ]
    }).populate('sender receiver', 'accountNumber').sort({ timestamp: -1 });
    
    const csvWriter = createCsvWriter({
      path: 'temp.csv',
      header: [
        { id: 'date', title: 'Date' },
        { id: 'description', title: 'Description' },
        { id: 'amount', title: 'Amount' },
        { id: 'type', title: 'Type' }
      ]
    });
    
    const records = transactions.map(transaction => {
      let description = '';
      
      if (transaction.type === 'deposit') {
        description = 'Deposit';
      } else if (transaction.type === 'withdrawal') {
        description = 'Withdrawal';
      } else if (transaction.type === 'transfer') {
        if (transaction.sender && transaction.sender._id.equals(account._id)) {
          description = `Transfer to ${transaction.receiver.accountNumber}`;
        } else {
          description = `Transfer from ${transaction.sender.accountNumber}`;
        }
      }
      
      return {
        date: transaction.timestamp.toLocaleDateString(),
        description: description,
        amount: transaction.amount,
        type: transaction.type
      };
    });
    
    await csvWriter.writeRecords(records);
    
    const filename = `statement-${account.accountNumber}-${Date.now()}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/csv');
    
    res.download('temp.csv');
  } catch (error) {
    res.status(500).send('Error generating CSV statement');
  }
});

module.exports = router;