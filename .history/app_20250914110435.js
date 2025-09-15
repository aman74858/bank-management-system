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



// Home Route
app.get('/', (req, res) => {
  res.render('index', { user: req.session.user });
  res.send('Welcome to the Banking Application');
});


app.listen(8080, () => {
  console.log("Server is running on port 8080");
});