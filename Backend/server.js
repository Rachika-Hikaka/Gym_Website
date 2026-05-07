const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const db = require("./db");
const firebase = require("./firebase");

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
  const validPassword = user && (
    (await bcrypt.compare(password, user.password).catch(() => false)) ||
    user.password === password
  );

  if (!user || !validPassword) {
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

app.get("/api/admin/overview", asyncHandler(async function (req, res) {
  const [[membersResult]] = await db.query("SELECT COUNT(*) AS totalMembers FROM users WHERE role = 'user'");
  const [[activeResult]] = await db.query("SELECT COUNT(*) AS activeMembers FROM users WHERE role = 'user' AND status = 'Active'");
  const [[revenueResult]] = await db.query("SELECT COALESCE(SUM(amount), 0) AS totalRevenue FROM payments WHERE status = 'Paid'");
  const [revenueByPlan] = await db.query(
    `SELECT users.plan, COALESCE(SUM(payments.amount), 0) AS revenue
     FROM users
     LEFT JOIN payments ON payments.user_id = users.id AND payments.status = 'Paid'
     WHERE users.role = 'user'
     GROUP BY users.plan`
  );

  res.json({
    totalMembers: membersResult.totalMembers,
    activeMembers: activeResult.activeMembers,
    totalRevenue: revenueResult.totalRevenue,
    revenueByPlan
  });
}));

app.get("/api/admin/members", asyncHandler(async function (req, res) {
  const [rows] = await db.query(
    `SELECT members.id, members.name, members.email, members.plan, members.expiry_date AS expiry,
            members.status, trainers.id AS trainerId, trainers.name AS trainerName
     FROM users AS members
     LEFT JOIN users AS trainers ON trainers.id = members.trainer_id
     WHERE members.role = 'user'
     ORDER BY members.created_at DESC`
  );

  res.json(rows);
}));

app.post("/api/admin/members", asyncHandler(async function (req, res) {
  const { name, email, password, plan, trainerId, expiry, status } = req.body;
  const hashedPassword = await bcrypt.hash(password || "user123", 10);

  await db.query(
    `INSERT INTO users (name, email, password, role, plan, trainer_id, expiry_date, status)
     VALUES (?, ?, ?, 'user', ?, ?, ?, ?)`,
    [name, email.trim().toLowerCase(), hashedPassword, plan, trainerId || null, expiry || null, status || "Active"]
  );

  res.status(201).json({ message: "Member added" });
}));

app.put("/api/admin/members/:id", asyncHandler(async function (req, res) {
  const { name, email, password, plan, trainerId, expiry, status } = req.body;
  const params = [name, email.trim().toLowerCase(), plan, trainerId || null, expiry || null, status || "Active"];
  let passwordSql = "";

  if (password) {
    passwordSql = ", password = ?";
    params.push(await bcrypt.hash(password, 10));
  }

  params.push(req.params.id);
  await db.query(
    `UPDATE users SET name = ?, email = ?, plan = ?, trainer_id = ?, expiry_date = ?, status = ?${passwordSql}
     WHERE id = ? AND role = 'user'`,
    params
  );

  res.json({ message: "Member updated" });
}));

app.delete("/api/admin/members/:id", asyncHandler(async function (req, res) {
  await db.query("DELETE FROM users WHERE id = ? AND role = 'user'", [req.params.id]);
  res.json({ message: "Member deleted" });
}));

app.get("/api/admin/trainers", asyncHandler(async function (req, res) {
  const [rows] = await db.query(
    `SELECT trainers.id, trainers.name, trainers.email, trainers.status, COUNT(members.id) AS assignedMembers
     FROM users AS trainers
     LEFT JOIN users AS members ON members.trainer_id = trainers.id AND members.role = 'user'
     WHERE trainers.role = 'trainer'
     GROUP BY trainers.id
     ORDER BY trainers.name`
  );

  res.json(rows);
}));

app.post("/api/admin/trainers", asyncHandler(async function (req, res) {
  const { name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password || "trainer123", 10);

  await db.query(
    "INSERT INTO users (name, email, password, role, plan, status) VALUES (?, ?, ?, 'trainer', 'Staff', 'Active')",
    [name, email.trim().toLowerCase(), hashedPassword]
  );

  res.status(201).json({ message: "Trainer added" });
}));

app.patch("/api/admin/members/:id/trainer", asyncHandler(async function (req, res) {
  await db.query("UPDATE users SET trainer_id = ? WHERE id = ? AND role = 'user'", [req.body.trainerId || null, req.params.id]);
  res.json({ message: "Trainer assigned" });
}));

app.post("/api/admin/plans", asyncHandler(async function (req, res) {
  const { name, code, price, durationDays, featured } = req.body;
  await db.query(
    "INSERT INTO membership_plans (name, code, price, duration_days, featured) VALUES (?, ?, ?, ?, ?)",
    [name, code, price, durationDays, Boolean(featured)]
  );
  res.status(201).json({ message: "Plan added" });
}));

app.put("/api/admin/plans/:id", asyncHandler(async function (req, res) {
  const { name, code, price, durationDays, featured } = req.body;
  await db.query(
    "UPDATE membership_plans SET name = ?, code = ?, price = ?, duration_days = ?, featured = ? WHERE id = ?",
    [name, code, price, durationDays, Boolean(featured), req.params.id]
  );
  res.json({ message: "Plan updated" });
}));

app.delete("/api/admin/plans/:id", asyncHandler(async function (req, res) {
  await db.query("DELETE FROM membership_plans WHERE id = ?", [req.params.id]);
  res.json({ message: "Plan deleted" });
}));

app.get("/api/admin/payments", asyncHandler(async function (req, res) {
  const [rows] = await db.query(
    `SELECT payments.id, users.name AS memberName, users.plan, payments.amount, payments.method,
            payments.reference, payments.status, DATE(payments.created_at) AS date
     FROM payments
     JOIN users ON users.id = payments.user_id
     ORDER BY payments.created_at DESC`
  );

  res.json(rows);
}));

app.post("/api/payments", asyncHandler(async function (req, res) {
  const { userId, amount, method, reference } = req.body;
  await db.query(
    "INSERT INTO payments (user_id, amount, method, reference, status) VALUES (?, ?, ?, ?, 'Paid')",
    [userId, amount, method || "Demo", reference || "DEMO-" + Date.now()]
  );
  res.status(201).json({ message: "Payment recorded" });
}));

app.post("/api/reviews", asyncHandler(async function (req, res) {
  const { userId, rating, feedback } = req.body;
  await db.query("INSERT INTO reviews (user_id, rating, feedback) VALUES (?, ?, ?)", [userId, rating, feedback]);
  await firebase.saveFirebaseDocument("reviews", { userId, rating, feedback });
  res.status(201).json({ message: "Review published" });
}));

app.delete("/api/admin/reviews/:id", asyncHandler(async function (req, res) {
  await db.query("DELETE FROM reviews WHERE id = ?", [req.params.id]);
  res.json({ message: "Review deleted" });
}));

app.get("/api/trainer/:trainerId/members", asyncHandler(async function (req, res) {
  const [rows] = await db.query(
    "SELECT id, name, email, plan, expiry_date AS expiry, status FROM users WHERE role = 'user' AND trainer_id = ?",
    [req.params.trainerId]
  );

  res.json(rows);
}));

app.post("/api/trainer/:trainerId/members/:memberId/workouts", asyncHandler(async function (req, res) {
  await db.query("DELETE FROM member_routines WHERE user_id = ? AND trainer_id = ?", [req.params.memberId, req.params.trainerId]);
  for (const item of req.body.items || []) {
    await db.query(
      "INSERT INTO member_routines (user_id, trainer_id, title, details) VALUES (?, ?, ?, ?)",
      [req.params.memberId, req.params.trainerId, item.title, item.details]
    );
  }
  res.json({ message: "Workout plan saved" });
}));

app.post("/api/trainer/:trainerId/members/:memberId/diet", asyncHandler(async function (req, res) {
  await db.query("DELETE FROM member_diets WHERE user_id = ? AND trainer_id = ?", [req.params.memberId, req.params.trainerId]);
  for (const item of req.body.items || []) {
    await db.query(
      "INSERT INTO member_diets (user_id, trainer_id, meal, details) VALUES (?, ?, ?, ?)",
      [req.params.memberId, req.params.trainerId, item.meal, item.details]
    );
  }
  res.json({ message: "Diet plan saved" });
}));

app.post("/api/trainer/:trainerId/members/:memberId/progress", asyncHandler(async function (req, res) {
  await db.query(
    "INSERT INTO progress_entries (user_id, trainer_id, weight, note) VALUES (?, ?, ?, ?)",
    [req.params.memberId, req.params.trainerId, req.body.weight, req.body.note || ""]
  );
  res.status(201).json({ message: "Progress saved" });
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
  await firebase.saveFirebaseDocument("contacts", { name, email, message, status: "Unread" });

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
