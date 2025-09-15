const mongoose = require('mongoose');
const accountData = require('./account.js');
const Listing = require('../models/Account');


const MONGO_URI = "mongodb://localhost:27017/bankdb";
main()
 .then(() => {
    console.log("Database connection successful");
 })
 .catch((error) => {
       console.error("Database connection error:", error);
 });

async function main() {
    await mongoose.connect(MONGO_URI);
}

const initDB = async () => {
    await Listing.deleteMany({});
    await Listing.insertMany(intiData.data);
    console.log("Database initialized with sample data");
};

initDB();