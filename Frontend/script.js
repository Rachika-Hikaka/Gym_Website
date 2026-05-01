const menuToggle = document.querySelector("#menuToggle");
const Nav = document.querySelector("#Nav");
const contactForm = document.querySelector("#contactForm");
const contactStatus = document.querySelector("#contactStatus");
const plansGrid = document.querySelector("#plansGrid");
const reviewsGrid = document.querySelector("#reviewsGrid");

const PLANS_KEY = "pro_fitness_plans";
const MESSAGES_KEY = "pro_fitness_messages";
const REVIEWS_KEY = "pro_fitness_reviews";

// Homepage defaults are used until the admin changes plans or users submit reviews.
const defaultPlans = [
  { id: "monthly", name: "Monthly Plan", code: "Monthly", price: 700, durationDays: 30, featured: false },
  { id: "3-months", name: "3 Months Plan", code: "3Months", price: 2500, durationDays: 90, featured: true },
  { id: "6-months", name: "6 Months Plan", code: "6Months", price: 4000, durationDays: 180, featured: false },
  { id: "yearly", name: "Yearly Plan", code: "1Year", price: 7000, durationDays: 365, featured: false }
];

const defaultReviews = [
  { id: "review-1", name: "Demo Member", rating: 5, feedback: "Trainer support and progress tracking made the gym feel personal.", date: "2026-04-28" },
  { id: "review-2", name: "Ritika S", rating: 4, feedback: "Clean setup, strong workouts, and the diet plans are easy to follow.", date: "2026-04-29" }
];

function readStore(key, fallback) {
  const saved = JSON.parse(localStorage.getItem(key) || "null");
  if (Array.isArray(saved) && saved.length) return saved;
  localStorage.setItem(key, JSON.stringify(fallback));
  return fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatRupees(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-IN")}`;
}

function renderPlans() {
  if (!plansGrid) return;

  const plans = readStore(PLANS_KEY, defaultPlans);
  plansGrid.innerHTML = plans.map((plan) => `
    <article class="price-card ${plan.featured ? "featured-plan" : ""}">
      <div>
        <p class="mini-label">${plan.featured ? "Most picked" : `${plan.durationDays} days`}</p>
        <h3>${escapeHtml(plan.name)}</h3>
      </div>
      <p class="price">${formatRupees(plan.price)}</p>
      <a class="primary-btn" href="register.html?plan=${encodeURIComponent(plan.code)}">Select</a>
    </article>
  `).join("");
}

function stars(rating) {
  return "★".repeat(Number(rating || 0)) + "☆".repeat(5 - Number(rating || 0));
}

function renderReviews() {
  if (!reviewsGrid) return;

  const reviews = readStore(REVIEWS_KEY, defaultReviews);
  reviewsGrid.innerHTML = reviews.slice(-6).reverse().map((review) => `
    <article class="review-card">
      <div class="review-stars" aria-label="${escapeHtml(review.rating)} star review">${stars(review.rating)}</div>
      <p>"${escapeHtml(review.feedback)}"</p>
      <strong>${escapeHtml(review.name)}</strong>
    </article>
  `).join("");
}

if (menuToggle && Nav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = Nav.classList.toggle("active");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

document.querySelectorAll(".nav a").forEach((link) => {
  link.addEventListener("click", () => {
    Nav?.classList.remove("active");
    menuToggle?.setAttribute("aria-expanded", "false");
  });
});

if (contactForm && contactStatus) {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const [nameInput, emailInput] = contactForm.querySelectorAll("input");
    const messageInput = contactForm.querySelector("textarea");
    const message = {
      id: `msg-${Date.now()}`,
      name: nameInput.value.trim(),
      email: emailInput.value.trim().toLowerCase(),
      message: messageInput.value.trim(),
      reply: "",
      status: "Unread",
      date: new Date().toISOString().slice(0, 10)
    };

    // Save locally first so the admin dashboard receives messages even in demo/offline mode.
    localStorage.setItem(MESSAGES_KEY, JSON.stringify([...readStore(MESSAGES_KEY, []), message]));

    try {
      if (window.location.protocol.startsWith("http")) {
        await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(message)
        });
      }
    } catch (error) {
      console.warn("Contact API unavailable, saved in browser dashboard.", error);
    }

    contactStatus.textContent = "Message sent to the admin dashboard.";
    contactForm.reset();
  });
}

renderPlans();
renderReviews();
