const STORAGE_KEY = "pro_fitness_users";
const SESSION_KEY = "pro_fitness_session";
const PLANS_KEY = "pro_fitness_plans";
const MESSAGES_KEY = "pro_fitness_messages";
const REVIEWS_KEY = "pro_fitness_reviews";

// Demo dashboard data is stored in localStorage so the full flow works without a database setup.
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

function readStore(key, fallback = []) {
  // localStorage keeps the demo fully usable without requiring MySQL on every laptop.
  const saved = JSON.parse(localStorage.getItem(key) || "null");
  if (Array.isArray(saved)) return saved;
  localStorage.setItem(key, JSON.stringify(fallback));
  return fallback;
}

function writeStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function plans() {
  const saved = readStore(PLANS_KEY, defaultPlans);
  if (!saved.length) writeStore(PLANS_KEY, defaultPlans);
  return readStore(PLANS_KEY, defaultPlans);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 30));
  return date.toISOString().slice(0, 10);
}

function formatRupees(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-IN")}`;
}

function planByCode(code) {
  return plans().find((plan) => plan.code === code) || plans()[0];
}

function planName(code) {
  return planByCode(code)?.name || code;
}

function planPrice(code) {
  return Number(planByCode(code)?.price || 0);
}

function normalizeUser(user) {
  if (user.role !== "user") return user;
  const plan = planByCode(user.plan);
  return {
    ...user,
    trainerId: user.trainerId || "trainer-1",
    expiry: user.expiry || addDays(plan?.durationDays || 30),
    routine: Array.isArray(user.routine) ? user.routine : defaultRoutine,
    diet: Array.isArray(user.diet) ? user.diet : defaultDiet,
    progress: Array.isArray(user.progress) ? user.progress : defaultProgress,
    payments: Array.isArray(user.payments) ? user.payments : []
  };
}

function getUsers() {
  return readStore(STORAGE_KEY, []).map(normalizeUser);
}

function saveUsers(users) {
  writeStore(STORAGE_KEY, users.map(normalizeUser));
}

function getCurrentUser() {
  const email = localStorage.getItem(SESSION_KEY);
  return getUsers().find((user) => user.email === email);
}

function saveCurrentUser(updatedUser) {
  saveUsers(getUsers().map((user) => user.id === updatedUser.id ? normalizeUser(updatedUser) : user));
}

function members() {
  return getUsers().filter((user) => user.role === "user");
}

function trainers() {
  return getUsers().filter((user) => user.role === "trainer");
}

function trainerName(trainerId) {
  return trainers().find((trainer) => trainer.id === trainerId)?.name || "Not assigned";
}

function tableMarkup(headers, rows) {
  // Tables are wrapped so narrow screens can scroll horizontally instead of breaking layout.
  return `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>${rows.length ? rows.join("") : `<tr><td colspan="${headers.length}">No records yet.</td></tr>`}</tbody>
      </table>
    </div>`;
}

function routineMarkup(items) {
  return items.map(([title, detail]) => `
    <div class="routine-item">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(detail)}</span>
    </div>`).join("");
}

function linesFromItems(items) {
  return items.map(([title, detail]) => `${title}: ${detail}`).join("\n");
}

function itemsFromLines(value) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const separator = line.indexOf(":");
    return separator === -1 ? ["Task", line] : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
  });
}

function setActiveTab(tab) {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
}

function renderNav(user) {
  // Each role gets its own navigation while sharing the same dashboard page.
  const tabsByRole = {
    admin: [["overview", "Overview"], ["members", "Members"], ["trainers", "Trainers"], ["payments", "Payments"], ["plans", "Plans"], ["messages", "Messages"]],
    trainer: [["overview", "Overview"], ["clients", "Clients"], ["workouts", "Workouts"], ["diet", "Diet"], ["progress", "Progress"]],
    user: [["overview", "Overview"], ["workouts", "Workouts"], ["diet", "Diet"], ["progress", "Progress"], ["payments", "Payments"], ["reviews", "Reviews"]]
  };

  const nav = document.querySelector("#dashboardNav");
  nav.innerHTML = (tabsByRole[user.role] || tabsByRole.user).map(([id, label], index) => (
    `<button class="${index === 0 ? "active" : ""}" data-tab="${id}" type="button">${label}</button>`
  )).join("");

  nav.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => renderTab(getCurrentUser(), button.dataset.tab));
  });
}

function renderTab(user, tab) {
  setActiveTab(tab);
  if (user.role === "admin") return renderAdminTab(tab);
  if (user.role === "trainer") return renderTrainerTab(user, tab);
  return renderUserTab(normalizeUser(user), tab);
}

function adminMetrics() {
  const allMembers = members();
  const activeMembers = allMembers.filter((member) => member.status === "Active" && new Date(member.expiry) >= new Date(today()));
  const totalRevenue = allMembers.reduce((sum, member) => sum + (member.payments || []).reduce((inner, payment) => (
    payment.status === "Paid" ? inner + Number(payment.amount || 0) : inner
  ), 0), 0);

  return { allMembers, activeMembers, totalRevenue };
}

function renderAdminChart() {
  const canvas = document.querySelector("#revenueChart");
  if (!window.Chart || !canvas) return;
  const totals = plans().map((plan) => members().reduce((sum, member) => {
    if (member.plan !== plan.code) return sum;
    return sum + (member.payments || []).reduce((inner, payment) => payment.status === "Paid" ? inner + Number(payment.amount || 0) : inner, 0);
  }, 0));

  new Chart(canvas, {
    type: "bar",
    data: {
      labels: plans().map((plan) => plan.name),
      datasets: [{ label: "Revenue", data: totals, backgroundColor: "#ffd21e", borderColor: "#e4ad00" }]
    },
    options: {
      plugins: { legend: { labels: { color: "#f7f7f2" } } },
      scales: {
        x: { ticks: { color: "#b9b5aa" }, grid: { color: "rgba(255,255,255,.08)" } },
        y: { ticks: { color: "#b9b5aa" }, grid: { color: "rgba(255,255,255,.08)" } }
      }
    }
  });
}

function renderAdminTab(tab) {
  const content = document.querySelector("#dashboardContent");
  const { allMembers, activeMembers, totalRevenue } = adminMetrics();
  const allTrainers = trainers();

  if (tab === "members") return renderAdminMembers(allMembers, allTrainers);
  if (tab === "trainers") return renderAdminTrainers(allMembers, allTrainers);
  if (tab === "payments") return renderAdminPayments(allMembers);
  if (tab === "plans") return renderAdminPlans();
  if (tab === "messages") return renderAdminMessages();

  content.innerHTML = `
    <section class="metric-grid">
      <article class="metric-card"><span>Total Members</span><strong>${allMembers.length}</strong></article>
      <article class="metric-card"><span>Active Members</span><strong>${activeMembers.length}</strong></article>
      <article class="metric-card"><span>Total Revenue</span><strong>${formatRupees(totalRevenue)}</strong></article>
    </section>
    <article class="data-card">
      <h3>Revenue by Plan</h3>
      <canvas id="revenueChart"></canvas>
    </article>`;
  renderAdminChart();
}

function renderAdminMembers(allMembers, allTrainers) {
  const content = document.querySelector("#dashboardContent");
  content.innerHTML = `
    <article class="data-card">
      <h3>Add / Edit Member</h3>
      <form id="memberForm" class="panel-form compact-form">
        <input id="memberId" type="hidden" />
        <input id="memberName" type="text" placeholder="Member name" required />
        <input id="memberEmail" type="email" placeholder="member@gmail.com" required />
        <input id="memberPassword" type="text" placeholder="Temporary password" required />
        <select id="memberPlan">${plans().map((plan) => `<option value="${plan.code}">${escapeHtml(plan.name)}</option>`).join("")}</select>
        <select id="memberTrainer"><option value="">No trainer</option>${allTrainers.map((trainer) => `<option value="${trainer.id}">${escapeHtml(trainer.name)}</option>`).join("")}</select>
        <input id="memberExpiry" type="date" required />
        <select id="memberStatus"><option>Active</option><option>Expired</option><option>Pending</option></select>
        <button class="primary-btn" type="submit">Save Member</button>
        <p id="memberStatusText" class="status-text"></p>
      </form>
    </article>
    <article class="data-card">
      <h3>Members</h3>
      ${tableMarkup(["Name", "Email", "Plan", "Trainer", "Expiry", "Status", "Actions"], allMembers.map((member) => `
        <tr>
          <td>${escapeHtml(member.name)}</td>
          <td>${escapeHtml(member.email)}</td>
          <td>${escapeHtml(planName(member.plan))}</td>
          <td>${escapeHtml(trainerName(member.trainerId))}</td>
          <td>${escapeHtml(member.expiry)}</td>
          <td>${escapeHtml(member.status)}</td>
          <td><button class="mini-btn" data-edit-member="${member.id}">Edit</button><button class="mini-btn danger" data-delete-member="${member.id}">Delete</button></td>
        </tr>`))}
    </article>`;

  document.querySelector("#memberExpiry").value = addDays(planByCode(document.querySelector("#memberPlan").value).durationDays);
  document.querySelector("#memberPlan").addEventListener("change", (event) => {
    document.querySelector("#memberExpiry").value = addDays(planByCode(event.target.value).durationDays);
  });
  document.querySelector("#memberForm").addEventListener("submit", saveMemberFromForm);
  document.querySelectorAll("[data-edit-member]").forEach((button) => button.addEventListener("click", () => fillMemberForm(button.dataset.editMember)));
  document.querySelectorAll("[data-delete-member]").forEach((button) => button.addEventListener("click", () => {
    saveUsers(getUsers().filter((user) => user.id !== button.dataset.deleteMember));
    renderAdminTab("members");
  }));
}

function fillMemberForm(memberId) {
  const member = members().find((item) => item.id === memberId);
  if (!member) return;
  document.querySelector("#memberId").value = member.id;
  document.querySelector("#memberName").value = member.name;
  document.querySelector("#memberEmail").value = member.email;
  document.querySelector("#memberPassword").value = member.password;
  document.querySelector("#memberPlan").value = member.plan;
  document.querySelector("#memberTrainer").value = member.trainerId || "";
  document.querySelector("#memberExpiry").value = member.expiry;
  document.querySelector("#memberStatus").value = member.status;
}

function saveMemberFromForm(event) {
  event.preventDefault();
  const id = document.querySelector("#memberId").value || `user-${Date.now()}`;
  const email = document.querySelector("#memberEmail").value.trim().toLowerCase();
  const existing = getUsers().find((user) => user.email === email && user.id !== id);
  const status = document.querySelector("#memberStatusText");
  if (!email.endsWith("@gmail.com")) {
    status.textContent = "Use @gmail.com for actual accounts.";
    status.classList.add("error");
    return;
  }
  if (existing) {
    status.textContent = "That email is already used.";
    status.classList.add("error");
    return;
  }

  const member = normalizeUser({
    id,
    name: document.querySelector("#memberName").value.trim(),
    email,
    password: document.querySelector("#memberPassword").value,
    role: "user",
    plan: document.querySelector("#memberPlan").value,
    trainerId: document.querySelector("#memberTrainer").value,
    expiry: document.querySelector("#memberExpiry").value,
    status: document.querySelector("#memberStatus").value,
    joined: today()
  });

  const users = getUsers();
  saveUsers(users.some((user) => user.id === id) ? users.map((user) => user.id === id ? { ...user, ...member } : user) : [...users, member]);
  renderAdminTab("members");
}

function renderAdminTrainers(allMembers, allTrainers) {
  const content = document.querySelector("#dashboardContent");
  content.innerHTML = `
    <article class="data-card">
      <h3>Add Trainer</h3>
      <form id="addTrainerForm" class="panel-form compact-form">
        <input id="trainerName" type="text" placeholder="Trainer full name" required />
        <input id="trainerEmail" type="email" placeholder="trainer@gmail.com" required />
        <input id="trainerPassword" type="password" placeholder="Temporary password" minlength="6" required />
        <button class="primary-btn" type="submit">Add Trainer</button>
        <p id="trainerCreateStatus" class="status-text"></p>
      </form>
    </article>
    <article class="data-card">
      <h3>Assign Trainer</h3>
      <form id="assignTrainerForm" class="panel-form compact-form">
        <select id="assignMember">${allMembers.map((member) => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("")}</select>
        <select id="assignTrainer">${allTrainers.map((trainer) => `<option value="${trainer.id}">${escapeHtml(trainer.name)}</option>`).join("")}</select>
        <button class="primary-btn" type="submit">Assign</button>
        <p id="assignTrainerStatus" class="status-text"></p>
      </form>
    </article>
    <article class="data-card">
      <h3>Trainers</h3>
      ${tableMarkup(["Trainer", "Email", "Assigned Members", "Status"], allTrainers.map((trainer) => `
        <tr><td>${escapeHtml(trainer.name)}</td><td>${escapeHtml(trainer.email)}</td><td>${allMembers.filter((member) => member.trainerId === trainer.id).length}</td><td>${escapeHtml(trainer.status)}</td></tr>`))}
    </article>`;

  document.querySelector("#addTrainerForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const status = document.querySelector("#trainerCreateStatus");
    const email = document.querySelector("#trainerEmail").value.trim().toLowerCase();
    if (!email.endsWith("@gmail.com")) {
      status.textContent = "Use @gmail.com for actual trainer accounts.";
      status.classList.add("error");
      return;
    }
    if (getUsers().some((user) => user.email === email)) {
      status.textContent = "This email already exists.";
      status.classList.add("error");
      return;
    }
    saveUsers([...getUsers(), { id: `trainer-${Date.now()}`, name: document.querySelector("#trainerName").value.trim(), email, password: document.querySelector("#trainerPassword").value, role: "trainer", plan: "Staff", status: "Active", joined: today() }]);
    renderAdminTab("trainers");
  });

  document.querySelector("#assignTrainerForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const memberId = document.querySelector("#assignMember").value;
    const trainerId = document.querySelector("#assignTrainer").value;
    saveUsers(getUsers().map((user) => user.id === memberId ? normalizeUser({ ...user, trainerId }) : user));
    document.querySelector("#assignTrainerStatus").textContent = "Trainer assigned. It now appears in both dashboards.";
  });
}

function renderAdminPayments(allMembers) {
  const content = document.querySelector("#dashboardContent");
  content.innerHTML = `
    <article class="data-card">
      <h3>Payments</h3>
      ${tableMarkup(["Member", "Plan", "Paid Total", "Pending", "Last Method", "Status"], allMembers.map((member) => {
        const paidPayments = member.payments?.filter((payment) => payment.status === "Paid") || [];
        const paidTotal = paidPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const pending = Math.max(planPrice(member.plan) - paidTotal, 0);
        const lastPayment = paidPayments.at(-1);
        return `<tr><td>${escapeHtml(member.name)}</td><td>${escapeHtml(planName(member.plan))}</td><td>${formatRupees(paidTotal)}</td><td>${formatRupees(pending)}</td><td>${escapeHtml(lastPayment?.method || "Pending")}</td><td>${pending ? "Pending" : "Paid"}</td></tr>`;
      }))}
    </article>`;
}

function renderAdminPlans() {
  const content = document.querySelector("#dashboardContent");
  content.innerHTML = `
    <article class="data-card">
      <h3>Create / Update Membership Plan</h3>
      <form id="planForm" class="panel-form compact-form">
        <input id="planId" type="hidden" />
        <input id="planName" type="text" placeholder="Plan name" required />
        <input id="planCode" type="text" placeholder="Plan code, e.g. Monthly" required />
        <input id="planPrice" type="number" min="1" placeholder="Price" required />
        <input id="planDuration" type="number" min="1" placeholder="Duration in days" required />
        <label class="check-row"><input id="planFeatured" type="checkbox" /> Featured on homepage</label>
        <button class="primary-btn" type="submit">Save Plan</button>
        <p class="status-text">Homepage and register page read from these plans automatically.</p>
      </form>
    </article>
    <article class="data-card">
      <h3>Current Plans</h3>
      ${tableMarkup(["Name", "Code", "Price", "Days", "Actions"], plans().map((plan) => `
        <tr><td>${escapeHtml(plan.name)}</td><td>${escapeHtml(plan.code)}</td><td>${formatRupees(plan.price)}</td><td>${escapeHtml(plan.durationDays)}</td><td><button class="mini-btn" data-edit-plan="${plan.id}">Edit</button><button class="mini-btn danger" data-delete-plan="${plan.id}">Delete</button></td></tr>`))}
    </article>`;
  document.querySelector("#planForm").addEventListener("submit", savePlanFromForm);
  document.querySelectorAll("[data-edit-plan]").forEach((button) => button.addEventListener("click", () => fillPlanForm(button.dataset.editPlan)));
  document.querySelectorAll("[data-delete-plan]").forEach((button) => button.addEventListener("click", () => {
    writeStore(PLANS_KEY, plans().filter((plan) => plan.id !== button.dataset.deletePlan));
    renderAdminTab("plans");
  }));
}

function fillPlanForm(planId) {
  const plan = plans().find((item) => item.id === planId);
  if (!plan) return;
  document.querySelector("#planId").value = plan.id;
  document.querySelector("#planName").value = plan.name;
  document.querySelector("#planCode").value = plan.code;
  document.querySelector("#planPrice").value = plan.price;
  document.querySelector("#planDuration").value = plan.durationDays;
  document.querySelector("#planFeatured").checked = Boolean(plan.featured);
}

function savePlanFromForm(event) {
  event.preventDefault();
  const id = document.querySelector("#planId").value || `plan-${Date.now()}`;
  const nextPlan = {
    id,
    name: document.querySelector("#planName").value.trim(),
    code: document.querySelector("#planCode").value.trim(),
    price: Number(document.querySelector("#planPrice").value),
    durationDays: Number(document.querySelector("#planDuration").value),
    featured: document.querySelector("#planFeatured").checked
  };
  const current = plans();
  writeStore(PLANS_KEY, current.some((plan) => plan.id === id) ? current.map((plan) => plan.id === id ? nextPlan : plan) : [...current, nextPlan]);
  renderAdminTab("plans");
}

function renderAdminMessages() {
  const content = document.querySelector("#dashboardContent");
  const messages = readStore(MESSAGES_KEY, []);
  content.innerHTML = `
    <article class="data-card">
      <h3>Contact Messages</h3>
      ${messages.length ? messages.slice().reverse().map((message) => `
        <div class="message-card">
          <div><strong>${escapeHtml(message.name)}</strong><span>${escapeHtml(message.email)} - ${escapeHtml(message.date)}</span></div>
          <p>${escapeHtml(message.message)}</p>
          <form class="reply-form" data-reply-form="${message.id}">
            <textarea rows="3" placeholder="Reply to this message">${escapeHtml(message.reply || "")}</textarea>
            <div class="message-actions">
              <button class="mini-btn" type="submit">Save Reply</button>
              <button class="mini-btn danger" data-delete-message="${message.id}" type="button">Delete</button>
            </div>
          </form>
        </div>`).join("") : "<p>No messages yet.</p>"}
    </article>`;
  document.querySelectorAll("[data-reply-form]").forEach((form) => form.addEventListener("submit", (event) => {
    event.preventDefault();
    const id = form.dataset.replyForm;
    writeStore(MESSAGES_KEY, readStore(MESSAGES_KEY, []).map((message) => message.id === id ? { ...message, reply: form.querySelector("textarea").value.trim(), status: "Replied" } : message));
    renderAdminTab("messages");
  }));
  document.querySelectorAll("[data-delete-message]").forEach((button) => button.addEventListener("click", () => {
    writeStore(MESSAGES_KEY, readStore(MESSAGES_KEY, []).filter((message) => message.id !== button.dataset.deleteMessage));
    renderAdminTab("messages");
  }));
}

function memberOptions(selectedId, memberList) {
  return memberList.map((member) => `<option value="${escapeHtml(member.id)}" ${member.id === selectedId ? "selected" : ""}>${escapeHtml(member.name)}</option>`).join("");
}

function renderTrainerTab(trainer, tab) {
  const assignedMembers = members().filter((member) => member.trainerId === trainer.id);
  const content = document.querySelector("#dashboardContent");

  if (!assignedMembers.length) {
    content.innerHTML = `<article class="data-card"><h3>No assigned clients</h3><p>Ask the admin to assign members to this trainer account.</p></article>`;
    return;
  }

  if (tab === "clients") {
    content.innerHTML = `<article class="data-card"><h3>Assigned Clients</h3>${tableMarkup(["Name", "Email", "Plan", "Expiry", "Latest Weight"], assignedMembers.map((member) => {
      const latest = member.progress.at(-1);
      return `<tr><td>${escapeHtml(member.name)}</td><td>${escapeHtml(member.email)}</td><td>${escapeHtml(planName(member.plan))}</td><td>${escapeHtml(member.expiry)}</td><td>${latest ? `${latest.weight} kg` : "No entry"}</td></tr>`;
    }))}</article>`;
    return;
  }

  if (tab === "workouts" || tab === "diet") return renderTrainerPlanEditor(tab, assignedMembers);
  if (tab === "progress") return renderTrainerProgressEditor(assignedMembers);

  content.innerHTML = `
    <article class="data-card">
      <h3>Assigned Client Overview</h3>
      ${tableMarkup(["Client", "Plan", "Expiry", "Current Weight", "Latest Note"], assignedMembers.map((member) => {
        const latest = member.progress.at(-1);
        return `
          <tr>
            <td>${escapeHtml(member.name)}</td>
            <td>${escapeHtml(planName(member.plan))}</td>
            <td>${escapeHtml(member.expiry)}</td>
            <td>${latest ? `${escapeHtml(latest.weight)} kg` : "No entry"}</td>
            <td>${escapeHtml(latest?.note || "No note")}</td>
          </tr>`;
      }))}
    </article>`;
}

function renderTrainerPlanEditor(type, memberList) {
  const content = document.querySelector("#dashboardContent");
  const selectedId = document.querySelector("#memberSelect")?.value || memberList[0].id;
  const selectedMember = memberList.find((member) => member.id === selectedId) || memberList[0];
  const field = type === "workouts" ? "routine" : "diet";
  const title = type === "workouts" ? "Workout Plan" : "Diet Plan";

  content.innerHTML = `
    <article class="data-card">
      <h3>Edit ${title}</h3>
      <form id="trainerPlanForm" class="panel-form compact-form">
        <select id="memberSelect">${memberOptions(selectedMember.id, memberList)}</select>
        <textarea id="planText" rows="9">${escapeHtml(linesFromItems(selectedMember[field]))}</textarea>
        <button class="primary-btn" type="submit">Save ${title}</button>
        <p id="trainerStatus" class="status-text"></p>
      </form>
    </article>
    <article class="data-card"><h3>Current Preview</h3><div class="routine-list">${routineMarkup(selectedMember[field])}</div></article>`;
  document.querySelector("#memberSelect").addEventListener("change", () => renderTrainerPlanEditor(type, memberList));
  document.querySelector("#trainerPlanForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const memberId = document.querySelector("#memberSelect").value;
    saveUsers(getUsers().map((user) => user.id === memberId ? normalizeUser({ ...user, [field]: itemsFromLines(document.querySelector("#planText").value) }) : user));
    document.querySelector("#trainerStatus").textContent = `${title} saved for ${selectedMember.name}.`;
  });
}

function renderTrainerProgressEditor(memberList) {
  const content = document.querySelector("#dashboardContent");
  const selectedId = document.querySelector("#memberSelect")?.value || memberList[0].id;
  const selectedMember = memberList.find((member) => member.id === selectedId) || memberList[0];
  const latest = selectedMember.progress.at(-1);

  content.innerHTML = `
    <article class="data-card">
      <h3>Update Client Progress</h3>
      <form id="trainerProgressForm" class="panel-form compact-form">
        <select id="memberSelect">${memberOptions(selectedMember.id, memberList)}</select>
        <input id="weightInput" type="number" min="20" step="0.1" placeholder="Weight in kg" value="${escapeHtml(latest?.weight || "")}" required />
        <input id="noteInput" type="text" placeholder="Short progress note" required />
        <button class="primary-btn" type="submit">Save Progress</button>
        <p id="trainerStatus" class="status-text"></p>
      </form>
    </article>
    <article class="data-card"><h3>${escapeHtml(selectedMember.name)} Progress</h3>${progressSummary(selectedMember)}${tableMarkup(["Date", "Weight", "Note"], selectedMember.progress.map((entry) => `<tr><td>${escapeHtml(entry.date)}</td><td>${escapeHtml(entry.weight)} kg</td><td>${escapeHtml(entry.note)}</td></tr>`))}</article>`;
  document.querySelector("#memberSelect").addEventListener("change", () => renderTrainerProgressEditor(memberList));
  document.querySelector("#trainerProgressForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const memberId = document.querySelector("#memberSelect").value;
    saveUsers(getUsers().map((user) => user.id === memberId ? { ...normalizeUser(user), progress: [...normalizeUser(user).progress, { date: today(), weight: Number(document.querySelector("#weightInput").value), note: document.querySelector("#noteInput").value.trim() }] } : user));
    document.querySelector("#trainerStatus").textContent = "Progress saved. The member can see it now.";
  });
}

function progressSummary(user) {
  const entries = user.progress || [];
  const first = entries[0];
  const latest = entries.at(-1);
  const change = first && latest ? Number((latest.weight - first.weight).toFixed(1)) : 0;
  const direction = change < 0 ? "Down" : change > 0 ? "Up" : "Same";
  return `
    <div class="progress-summary">
      <article><span>Start</span><strong>${first ? `${first.weight} kg` : "No data"}</strong></article>
      <article><span>Current</span><strong>${latest ? `${latest.weight} kg` : "No data"}</strong></article>
      <article><span>Change</span><strong>${direction} ${Math.abs(change)} kg</strong></article>
    </div>`;
}

function renderUserTab(user, tab) {
  const content = document.querySelector("#dashboardContent");
  if (tab === "workouts") return content.innerHTML = `<article class="data-card"><h3>Your Workout Plan</h3><div class="routine-list">${routineMarkup(user.routine)}</div></article>`;
  if (tab === "diet") return content.innerHTML = `<article class="data-card"><h3>Your Diet Plan</h3><div class="routine-list">${routineMarkup(user.diet)}</div></article>`;
  if (tab === "progress") return renderUserProgress(user);
  if (tab === "payments") return renderUserPayments(user);
  if (tab === "reviews") return renderUserReviews(user);

  content.innerHTML = `
    <section class="metric-grid">
      <article class="metric-card"><span>Membership</span><strong>${escapeHtml(planName(user.plan))}</strong></article>
      <article class="metric-card"><span>Expiry Date</span><strong>${escapeHtml(user.expiry)}</strong></article>
      <article class="metric-card"><span>Trainer</span><strong>${escapeHtml(trainerName(user.trainerId))}</strong></article>
    </section>
    <article class="data-card"><h3>Today</h3><div class="routine-list">${routineMarkup([["Workout", user.routine[0]?.[1] || "Check your workout tab"], ["Food", user.diet[0]?.[1] || "Check your diet tab"], ["Next step", "Log your weight regularly and keep payment history updated"]])}</div></article>`;
}

function renderUserProgress(user) {
  const content = document.querySelector("#dashboardContent");
  content.innerHTML = `
    <article class="data-card">
      <h3>Add Weight Entry</h3>
      ${progressSummary(user)}
      <form id="userProgressForm" class="panel-form compact-form">
        <input id="weightInput" type="number" min="20" step="0.1" placeholder="Weight in kg" required />
        <input id="noteInput" type="text" placeholder="Optional note" />
        <button class="primary-btn" type="submit">Save Weight</button>
      </form>
    </article>
    <article class="data-card"><h3>Weight Trend</h3><canvas id="progressChart"></canvas></article>
    <article class="data-card"><h3>History</h3>${tableMarkup(["Date", "Weight", "Note"], user.progress.map((entry) => `<tr><td>${escapeHtml(entry.date)}</td><td>${escapeHtml(entry.weight)} kg</td><td>${escapeHtml(entry.note)}</td></tr>`))}</article>`;
  renderProgressChart(user);
  document.querySelector("#userProgressForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const updatedUser = { ...user, progress: [...user.progress, { date: today(), weight: Number(document.querySelector("#weightInput").value), note: document.querySelector("#noteInput").value.trim() || "User entry" }] };
    saveCurrentUser(updatedUser);
    renderUserProgress(updatedUser);
  });
}

function renderProgressChart(user) {
  const chart = document.querySelector("#progressChart");
  if (!window.Chart || !chart) return;
  new Chart(chart, {
    type: "line",
    data: {
      labels: user.progress.map((entry) => entry.date),
      datasets: [{ label: "Weight kg", data: user.progress.map((entry) => entry.weight), borderColor: "#ffd21e", backgroundColor: "rgba(255,210,30,.15)", fill: true, tension: 0.35 }]
    },
    options: {
      plugins: { legend: { labels: { color: "#f7f7f2" } } },
      scales: {
        x: { ticks: { color: "#b9b5aa" }, grid: { color: "rgba(255,255,255,.08)" } },
        y: { ticks: { color: "#b9b5aa" }, grid: { color: "rgba(255,255,255,.08)" } }
      }
    }
  });
}

function renderUserPayments(user) {
  const content = document.querySelector("#dashboardContent");
  content.innerHTML = `
    <article class="data-card payment-panel">
      <h3>Membership Payment</h3>
      <div class="progress-summary">
        <article><span>Plan</span><strong>${escapeHtml(planName(user.plan))}</strong></article>
        <article><span>Amount</span><strong>${formatRupees(planPrice(user.plan))}</strong></article>
        <article><span>Expiry</span><strong>${escapeHtml(user.expiry)}</strong></article>
      </div>
      <button class="primary-btn" id="payBtn" type="button">Record Demo Payment</button>
      <p id="paymentStatus" class="status-text"></p>
    </article>
    <article class="data-card"><h3>Payment History</h3>${tableMarkup(["Date", "Amount", "Method", "Status", "Reference"], (user.payments || []).map((payment) => `<tr><td>${escapeHtml(payment.date)}</td><td>${formatRupees(payment.amount)}</td><td>${escapeHtml(payment.method)}</td><td>${escapeHtml(payment.status)}</td><td>${escapeHtml(payment.reference)}</td></tr>`))}</article>`;
  document.querySelector("#payBtn").addEventListener("click", () => {
    const updatedUser = { ...user, payments: [...(user.payments || []), { date: today(), amount: planPrice(user.plan), method: "RuPay/UPI Demo", status: "Paid", reference: `DEMO-${Date.now()}` }] };
    saveCurrentUser(updatedUser);
    renderUserPayments(updatedUser);
  });
}

function renderUserReviews(user) {
  const content = document.querySelector("#dashboardContent");
  const userReviews = readStore(REVIEWS_KEY, []).filter((review) => review.userId === user.id);
  content.innerHTML = `
    <article class="data-card">
      <h3>Submit Review</h3>
      <form id="reviewForm" class="panel-form compact-form">
        <select id="rating"><option value="5">5 stars</option><option value="4">4 stars</option><option value="3">3 stars</option><option value="2">2 stars</option><option value="1">1 star</option></select>
        <textarea id="feedback" rows="4" placeholder="Share your feedback" required></textarea>
        <button class="primary-btn" type="submit">Publish Review</button>
        <p class="status-text">Published reviews appear on the homepage.</p>
      </form>
    </article>
    <article class="data-card"><h3>Your Reviews</h3>${tableMarkup(["Date", "Rating", "Feedback"], userReviews.map((review) => `<tr><td>${escapeHtml(review.date)}</td><td>${"★".repeat(review.rating)}</td><td>${escapeHtml(review.feedback)}</td></tr>`))}</article>`;
  document.querySelector("#reviewForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const reviews = readStore(REVIEWS_KEY, []);
    reviews.push({ id: `review-${Date.now()}`, userId: user.id, name: user.name, rating: Number(document.querySelector("#rating").value), feedback: document.querySelector("#feedback").value.trim(), date: today() });
    writeStore(REVIEWS_KEY, reviews);
    renderUserReviews(user);
  });
}

function init() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  document.querySelector("#dashboardWel").textContent = user.role === "admin" ? "Admin dashboard" : user.role === "trainer" ? "Trainer dashboard" : "Member dashboard";
  document.querySelector("#welcomeTitle").textContent = `Welcome, ${user.name}`;
  renderNav(user);
  renderTab(user, "overview");

  document.querySelector("#logoutBtn").addEventListener("click", () => {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = "index.html";
  });

  const sidebar = document.querySelector("#sidebar");
  const dashboardMenu = document.querySelector("#dashboardMenu");
  const isMobileDashboard = () => window.matchMedia("(max-width: 900px)").matches;

  // A single function controls the mobile sidebar so button clicks, nav clicks,
  // outside clicks, and window resizing do not fight each other.
  const setSidebarOpen = (isOpen) => {
    const shouldOpen = Boolean(isOpen && isMobileDashboard());
    sidebar.classList.toggle("open", shouldOpen);
    document.body.classList.toggle("sidebar-open", shouldOpen);
    dashboardMenu.setAttribute("aria-expanded", String(shouldOpen));
  };

  dashboardMenu.addEventListener("click", (event) => {
    event.stopPropagation();
    setSidebarOpen(!sidebar.classList.contains("open"));
  });

  document.querySelector("#dashboardNav").addEventListener("click", () => {
    if (isMobileDashboard()) setSidebarOpen(false);
  });

  document.addEventListener("click", (event) => {
    if (!sidebar.classList.contains("open")) return;
    if (sidebar.contains(event.target) || dashboardMenu.contains(event.target)) return;
    setSidebarOpen(false);
  });

  window.addEventListener("resize", () => {
    if (!isMobileDashboard()) setSidebarOpen(false);
  });
}

document.addEventListener("DOMContentLoaded", init);
