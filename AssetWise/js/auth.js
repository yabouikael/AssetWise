(function () {
  "use strict";
  const SESSION_KEY = "assetwise_session_v1";
  const $ = (selector, root) => (root || document).querySelector(selector);

  function session() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error("Unable to read the AssetWise session.", error);
      return null;
    }
  }
  function redirect(role) {
    location.replace(role === "admin" ? "dashboard.html" : "customer.html");
  }
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    location.replace("login.html");
  }
  function setError(field, message) {
    const target = $(`[data-error="${field}"]`);
    if (target) target.textContent = message || "";
  }
  function clearErrors(form) {
    form.querySelectorAll("[data-error]").forEach(el => { el.textContent = ""; });
    const notice = $("#auth-message");
    if (notice) notice.textContent = "";
  }
  async function initialize() {
    await AWStore.initialize();
    const page = document.body.dataset.page;
    const current = session();
    if (page === "dashboard" || page === "customer") {
      const neededRole = page === "dashboard" ? "admin" : "customer";
      if (!current) { location.replace("login.html"); return; }
      const user = AWStore.find("users", current.id);
      if (!user || user.role !== neededRole) { logout(); return; }
      window.AWCurrentUser = user;
      document.dispatchEvent(new CustomEvent("assetwise:ready", { detail: { user } }));
    } else if ((page === "login" || page === "register") && current) {
      const user = AWStore.find("users", current.id);
      if (user) { redirect(user.role); return; }
    }
    document.querySelectorAll("[data-logout]").forEach(button => button.addEventListener("click", logout));
    document.querySelectorAll("[data-theme-toggle]").forEach(button => button.addEventListener("click", toggleTheme));
    applyTheme();
    if (page === "login") bindLogin();
    if (page === "register") bindRegister();
  }
  function applyTheme() {
    const saved = localStorage.getItem("assetwise_theme") || "light";
    document.documentElement.dataset.theme = saved;
    document.querySelectorAll("[data-theme-toggle]").forEach(b => {
      b.setAttribute("aria-label", saved === "dark" ? "Switch to light mode" : "Switch to dark mode");
      b.textContent = saved === "dark" ? "☀" : "☾";
    });
  }
  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("assetwise_theme", next);
    applyTheme();
  }
  function bindLogin() {
    const form = $("#login-form");
    const show = $("#show-password");
    if (show) show.addEventListener("change", () => { $("#password").type = show.checked ? "text" : "password"; });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      clearErrors(form);
      const email = $("#email").value.trim().toLowerCase();
      const password = $("#password").value;
      if (!email) { setError("email", "Email is required."); return; }
      if (!password) { setError("password", "Password is required."); return; }
      const user = AWStore.collection("users").find(item => item.email.toLowerCase() === email);
      if (!user || user.passwordHash !== await AWStore.digest(password)) {
        $("#auth-message").textContent = "The email or password you entered is incorrect.";
        return;
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, role: user.role }));
      redirect(user.role);
    });
  }
  function bindRegister() {
    const form = $("#register-form");
    form.addEventListener("submit", async event => {
      event.preventDefault();
      clearErrors(form);
      const name = $("#name").value.trim();
      const email = $("#email").value.trim().toLowerCase();
      const phone = $("#phone").value.trim();
      const password = $("#password").value;
      const confirm = $("#confirm-password").value;
      let valid = true;
      if (!name) { setError("name", "Full name is required."); valid = false; }
      if (!email) { setError("email", "Email is required."); valid = false; }
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("email", "Enter a valid email address."); valid = false; }
      else if (AWStore.collection("users").some(user => user.email.toLowerCase() === email)) { setError("email", "An account with this email already exists."); valid = false; }
      if (!phone) { setError("phone", "Phone number is required."); valid = false; }
      if (!password) { setError("password", "Password is required."); valid = false; }
      else if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) { setError("password", "Use at least 8 characters with a letter and a number."); valid = false; }
      if (!confirm) { setError("confirm-password", "Please confirm your password."); valid = false; }
      else if (password !== confirm) { setError("confirm-password", "Passwords do not match."); valid = false; }
      if (!valid) return;
      const id = AWStore.nextId("user", "USR");
      const user = { id, name, email, phone, role: "customer", passwordHash: await AWStore.digest(password), createdAt: new Date().toISOString() };
      AWStore.insert("users", user);
      AWStore.insert("customers", { id, userId: id, name, email, phone, createdAt: user.createdAt });
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, role: "customer" }));
      redirect("customer");
    });
  }
  document.addEventListener("DOMContentLoaded", () => {
    initialize().catch(error => {
      console.error("AssetWise initialization failed.", error);
      const message = $("#auth-message") || document.querySelector("[data-init-error]");
      if (message) message.textContent = error.message;
      else window.alert(error.message);
    });
  });
  window.AWAuth = { session, logout, toggleTheme };
})();
