const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');

const app = express();


// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/bankDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log(err));


// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Add this line after the other route imports
app.use('/api/transactions', require('./routes/transaction'));

// Session Configuration
app.use(session({
  secret: 'bankManagementSecret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: 'mongodb://localhost:27017/bankDB' }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));

// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/', require('./routes/auth'));
app.use('/customer', require('./routes/customer'));
app.use('/admin', require('./routes/admin'));
app.use('/transaction', require('./routes/transaction'));


// Home Route
app.get('/', (req, res) => {
  res.render('index', { user: req.session.user });
});


app.listen(8080, () => {
  console.log("Server is running on port 8080");
});