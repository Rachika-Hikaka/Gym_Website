// STORAGE SETUP
const STORAGE_KEY = "pro_fitness_users";
const SESSION_KEY = "pro_fitness_session";
const PLANS_KEY = "pro_fitness_plans";

const defaultRoutine = [
  ["Monday", "Push day: bench press, shoulder press, triceps"],
  ["Wednesday", "Leg day: squats, lunges, calf raises"],
  ["Friday", "Pull day: deadlift, rows, lat pulldown"]
];

const defaultDiet = [
  ["Breakfast", "Oats, eggs, banana"],
  ["Lunch", "Rice, chicken or paneer, salad"],
  ["Snack", "Curd, fruit, or nuts"],
  ["Dinner", "Roti, dal, vegetables, lean protein"],
  ["Hydration", "2.5-3 liters water daily"]
];

// SAMPLE PROGRESS DATA
const defaultProgress = [
  { date: "2026-04-01", weight: 82, note: "Starting weight" },
  { date: "2026-04-15", weight: 80.7, note: "Better stamina" },
  { date: "2026-04-30", weight: 79.9, note: "Consistent training" }
];

const defaultPlans = [
  { id: "monthly", name: "Monthly Plan", code: "Monthly", price: 700, durationDays: 30, featured: false },
  { id: "3-months", name: "3 Months Plan", code: "3Months", price: 2500, durationDays: 90, featured: true },
  { id: "6-months", name: "6 Months Plan", code: "6Months", price: 4000, durationDays: 180, featured: false },
  { id: "yearly", name: "Yearly Plan", code: "1Year", price: 7000, durationDays: 365, featured: false }
];

const defaultUsers = [
  { id: "admin-1", name: "Gym Admin", email: "admin@gmail.com", password: "admin123", role: "admin", plan: "Admin", status: "Active", joined: "2026-04-01" },
  { id: "trainer-1", name: "Head Trainer", email: "trainer@gmail.com", password: "trainer123", role: "trainer", plan: "Staff", status: "Active", joined: "2026-04-05" },
  {
    id: "user-1",
    name: "Demo Member",
    email: "user@gmail.com",
    password: "user123",
    role: "user",
    plan: "Monthly",
    status: "Active",
    joined: "2026-04-12",
    expiry: "2026-05-12",
    trainerId: "trainer-1",
    routine: defaultRoutine,
    diet: defaultDiet,
    progress: defaultProgress,
    payments: [{ date: "2026-04-12", amount: 700, method: "Cash", status: "Paid", reference: "DEMO-PAID" }]
  }
];

function plans() {
  const saved = JSON.parse(localStorage.getItem(PLANS_KEY) || "null");
  if (Array.isArray(saved) && saved.length) return saved;
  localStorage.setItem(PLANS_KEY, JSON.stringify(defaultPlans));
  return defaultPlans;
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 30));
  return date.toISOString().slice(0, 10);
}

function normalizeUser(user) {
  if (user.email?.endsWith("@gym.com")) {
    user.email = user.email.replace("@gym.com", "@gmail.com");
  }

  if (user.role !== "user") return user;
  const plan = plans().find((item) => item.code === user.plan) || plans()[0];

  return {
    ...user,
    trainerId: user.trainerId || "trainer-1",
    expiry: user.expiry || addDays(plan.durationDays),
    routine: Array.isArray(user.routine) ? user.routine : defaultRoutine,
    diet: Array.isArray(user.diet) ? user.diet : defaultDiet,
    progress: Array.isArray(user.progress) ? user.progress : defaultProgress,
    payments: Array.isArray(user.payments) ? user.payments : []
  };
}


function getUsers() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]").map(normalizeUser);
  const merged = [...saved];

  defaultUsers.forEach((demoUser) => {
    if (!merged.some((user) => user.email === demoUser.email)) merged.push(demoUser);
  });

  const normalized = merged.map(normalizeUser);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users.map(normalizeUser)));
}

// GENERATE UNIQUE USER ID
function createId() {
  return `user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

// SHOW MESSAGE STATUS
function setStatus(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("error", isError);
}


function renderPlanOptions() {
  const planSelect = document.querySelector("#plan");
  if (!planSelect) return;

  // CREATE DROPDOWN OPTIONS
  planSelect.innerHTML = `<option value="" disabled selected>Plan</option>` + plans().map((plan) => (
    `<option value="${plan.code}">${plan.name} - Rs. ${Number(plan.price).toLocaleString("en-IN")}</option>`
  )).join("");

  // AUTO-SELECT PLAN FROM URL
  const planFromUrl = new URLSearchParams(window.location.search).get("plan");
  if (planFromUrl) planSelect.value = planFromUrl;
}

// REGISTER PAGE LOGIC
function initRegisterPage() {
  const form = document.querySelector("#registerForm");
  if (!form) return;

  renderPlanOptions();

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    // GET FORM VALUES
    const users = getUsers();
    const name = document.querySelector("#name").value.trim();
    const email = document.querySelector("#email").value.trim().toLowerCase();
    const password = document.querySelector("#password").value;
    const planCode = document.querySelector("#plan").value;
    const plan = plans().find((item) => item.code === planCode);
    const status = document.querySelector("#registerStatus");

    if (!plan) return setStatus(status, "Please choose a membership plan.", true);
    if (!email.endsWith("@gmail.com")) return setStatus(status, "Use a Gmail address for real accounts.", true);
    if (users.some((user) => user.email === email)) return setStatus(status, "This email is already registered.", true);

    const user = normalizeUser({
      id: createId(),
      name,
      email,
      password,
      plan: plan.code,
      role: "user",
      status: "Active",
      joined: new Date().toISOString().slice(0, 10),
      expiry: addDays(plan.durationDays),
      trainerId: "trainer-1"
    });

    users.push(user);    
    saveUsers(users);
    localStorage.setItem(SESSION_KEY, user.email);   
    window.location.href = "dashboard.html";         
  });
}

// LOGIN PAGE LOGIC
function initLoginPage() {
  const form = document.querySelector("#loginForm");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const email = document.querySelector("#email").value.trim().toLowerCase();
    const password = document.querySelector("#password").value;
    const status = document.querySelector("#loginStatus");
    
    // FIND MATCHING USER
    const user = getUsers().find((item) => item.email === email && item.password === password);

    // INVALID LOGIN
    if (!user) return setStatus(status, "Invalid email or password.", true);

    localStorage.setItem(SESSION_KEY, user.email);   
    window.location.href = "dashboard.html";         
  });
}

// PASSWORD SHOW/HIDE TOGGLE
function initPasswordToggles() {
  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    const input = document.querySelector(`#${button.dataset.passwordToggle}`);
    const icon = button.querySelector("img");
    if (!input) return;

    button.addEventListener("click", () => {
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";    
      button.classList.toggle("is-visible", isHidden);  
      if (icon) {
        icon.src = isHidden ? "Hide_Eye.png" : "Eye.png";
      }
      button.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");   // ACCESSIBILITY LABEL
    });
  });
}

// INITIALIZATION RUNS WHEN PAGE LOADS. 
plans();                 
getUsers();              
initPasswordToggles();    
initRegisterPage();      
initLoginPage();
