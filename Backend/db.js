const mysql = require("mysql2/promise");
require("dotenv").config();

// Shared MySQL connection pool used by all Express API routes.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;