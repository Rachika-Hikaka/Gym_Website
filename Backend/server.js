const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const frontendPath = path.join(__dirname, "..", "Frontend");

app.use(cors());
app.use(express.json());
app.use(express.static(frontendPath));

// Keeps async route errors in one place instead of repeating try/catch in every API route.
function asyncHandler(handler) {
  return function routeHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.get("/", function (req, res) {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.get("/api/health", function (req, res) {
  res.json({ status: "ok", service: "Pro Fitness Gym" });
});

app.get("/api/plans", asyncHandler(async function (req, res) {
  // Homepage and registration screens can read plans from the database in production.
  const [rows] = await db.query(
    "SELECT id, name, code, price, duration_days AS durationDays, featured FROM membership_plans ORDER BY duration_days"
  );

  res.json(rows);
}));

app.get("/api/reviews", asyncHandler(async function (req, res) {
  const [rows] = await db.query(
    `SELECT reviews.id, users.name, reviews.rating, reviews.feedback, DATE(reviews.created_at) AS date
     FROM reviews
     JOIN users ON users.id = reviews.user_id
     ORDER BY reviews.created_at DESC
     LIMIT 12`
  );

  res.json(rows);
}));

app.post("/api/register", asyncHandler(async function (req, res) {
  const { name, email, password, plan } = req.body;

  if (!name || !email || !password || !plan) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await db.query(
    "INSERT INTO users (name, email, password, plan) VALUES (?, ?, ?, ?)",
    [name.trim(), email.trim().toLowerCase(), hashedPassword, plan]
  );

  res.status(201).json({ message: "Registration successful" });
}));

app.post("/api/login", asyncHandler(async function (req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const [rows] = await db.query(
    "SELECT id, name, email, password, role, plan, created_at FROM users WHERE email = ? LIMIT 1",
    [email.trim().toLowerCase()]
  );

  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  res.json({
    message: "Login successful",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      plan: user.plan,
      status: "Active",
      joined: user.created_at
    }
  });
}));

app.post("/api/contact", asyncHandler(async function (req, res) {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ message: "Name, email, and message are required" });
  }

  await db.query(
    "INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)",
    [name.trim(), email.trim().toLowerCase(), message.trim()]
  );

  res.status(201).json({ message: "Message received" });
}));

app.get("/api/admin/contacts", asyncHandler(async function (req, res) {
  const [rows] = await db.query(
    "SELECT id, name, email, message, reply, status, DATE(created_at) AS date FROM contacts ORDER BY created_at DESC"
  );

  res.json(rows);
}));

app.patch("/api/admin/contacts/:id/reply", asyncHandler(async function (req, res) {
  const { reply } = req.body;

  // Replies stay attached to the original homepage contact message.
  await db.query(
    "UPDATE contacts SET reply = ?, status = 'Replied' WHERE id = ?",
    [String(reply || "").trim(), req.params.id]
  );

  res.json({ message: "Reply saved" });
}));

app.delete("/api/admin/contacts/:id", asyncHandler(async function (req, res) {
  // Admin can remove old contact messages after they are handled.
  await db.query("DELETE FROM contacts WHERE id = ?", [req.params.id]);
  res.json({ message: "Message deleted" });
}));

app.use(function (err, req, res, next) {
  if (err && err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ message: "This email is already registered" });
  }

  console.error(err);
  res.status(500).json({ message: "Server error. Please check the backend console." });
});

app.listen(PORT, function () {
  console.log("Server running on http://localhost:" + PORT);
});
