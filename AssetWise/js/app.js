(function () {
  "use strict";
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const fmtDate = value => value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
  const fmtTime = value => value ? new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
  const money = value => `$${Number(value || 0).toFixed(2)}`;
  const idLabel = (list, id, key = "id") => {
    const record = AWStore.find(list, id);
    return record ? record.name || record.device || record[key] : "Unknown";
  };
  const statusClass = status => {
    if (["Completed", "Released", "In Stock", "Reviewed", "Quoted", "Scheduled"].includes(status)) return "good";
    if (["Waiting for Parts", "Pending", "Ready for Pickup", "Diagnosing"].includes(status)) return "warn";
    if (["Retired", "Declined", "Cancelled"].includes(status)) return "bad";
    return "info";
  };
  const badge = value => `<span class="badge ${statusClass(value)}">${esc(value)}</span>`;
  const toast = (message, type = "success") => {
    const region = $("#toast-region");
    if (!region) return;
    const node = document.createElement("div");
    node.className = `toast ${type}`;
    node.textContent = message;
    region.append(node);
    setTimeout(() => node.remove(), 3600);
  };
  const openModal = (title, body, wide = false) => {
    const backdrop = $("#modal-backdrop");
    if (!backdrop) return;
    $("#modal").classList.toggle("modal-wide", wide);
    $("#modal").innerHTML = `<div class="modal-header"><h2 id="modal-title">${esc(title)}</h2><button class="icon-btn modal-close" type="button" data-action="close-modal" aria-label="Close dialog">×</button></div>${body}`;
    backdrop.classList.add("open");
    backdrop.setAttribute("aria-hidden", "false");
    const first = $("#modal input, #modal select, #modal button");
    if (first) first.focus();
  };
  const closeModal = () => {
    const backdrop = $("#modal-backdrop");
    if (backdrop) { backdrop.classList.remove("open"); backdrop.setAttribute("aria-hidden", "true"); }
  };
  function init() {
    const page = document.body.dataset.page;
    if (page === "dashboard") initAdmin();
    if (page === "customer") initCustomer();
    $$(".modal-backdrop").forEach(backdrop => {
      backdrop.addEventListener("click", event => { if (event.target === backdrop) closeModal(); });
    });
    document.addEventListener("keydown", event => { if (event.key === "Escape") closeModal(); });
    document.addEventListener("click", handleAction);
    document.addEventListener("submit", handleSubmit);
    document.addEventListener("change", handleChange);
  }
  function ownerDevices(userId) { return AWStore.collection("assets").filter(asset => asset.ownerId === userId); }
  function customerOf(id) { return AWStore.collection("users").find(user => user.id === id) || { name: "Walk-in customer", email: "", phone: "" }; }
  function setHash(section) {
    history.replaceState(null, "", `#${section}`);
    $$(".nav-item").forEach(link => link.classList.toggle("active", link.dataset.section === section));
  }
  function initAdmin() {
    const user = window.AWCurrentUser;
    if (!user) return;
    $("#admin-name").textContent = user.name;
    $("#admin-avatar").textContent = user.name.slice(0, 1).toUpperCase();
    const shop = AWStore.data().settings.shopName;
    $("#shop-name-brand").textContent = shop;
    const section = location.hash.slice(1) || "overview";
    renderAdmin(section);
    $$(".nav-item[data-section]").forEach(link => link.addEventListener("click", event => {
      event.preventDefault(); setHash(link.dataset.section); renderAdmin(link.dataset.section); $("#sidebar").classList.remove("open");
    }));
    $("#mobile-menu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
    window.addEventListener("hashchange", () => renderAdmin(location.hash.slice(1) || "overview"));
  }
  function renderAdmin(section) {
    const valid = ["overview", "inventory", "repairs", "consultations", "schedule", "customers", "settings"];
    if (!valid.includes(section)) section = "overview";
    currentAdminSection = section;
    setHash(section);
    const pendingCount = AWStore.collection("consultations").filter(item => item.status === "Pending").length;
    const countBadge = $("#pending-consultation-count");
    if (countBadge) {
      countBadge.textContent = pendingCount ? String(pendingCount) : "";
      countBadge.dataset.count = String(pendingCount);
      countBadge.setAttribute("aria-label", `${pendingCount} pending consultation${pendingCount === 1 ? "" : "s"}`);
    }
    const root = $("#admin-content");
    if (section === "overview") root.innerHTML = renderOverview();
    if (section === "inventory") root.innerHTML = renderInventory();
    if (section === "repairs") root.innerHTML = renderRepairs();
    if (section === "consultations") root.innerHTML = renderConsultations();
    if (section === "schedule") root.innerHTML = renderSchedule();
    if (section === "customers") root.innerHTML = renderCustomers();
    if (section === "settings") root.innerHTML = renderSettings();
  }
  function renderOverview() {
    const assets = AWStore.collection("assets"), repairs = AWStore.collection("repairs");
    const consultations = AWStore.collection("consultations"), appointments = AWStore.collection("appointments");
    const today = new Date().toDateString(), month = new Date();
    const todayAppts = appointments.filter(a => new Date(a.dateTime).toDateString() === today && a.status !== "Cancelled").length;
    const completedMonth = repairs.filter(r => r.status === "Completed" && new Date(r.createdAt).getMonth() === month.getMonth() && new Date(r.createdAt).getFullYear() === month.getFullYear()).length;
    const low = assets.filter(a => a.category === "Part/Component" && a.quantity <= (a.reorderLevel || AWStore.data().settings.lowStockThreshold)).length;
    const statData = [
      ["Total assets", assets.length, "▤"], ["Items in repair", assets.filter(a => a.status === "In Repair").length, "⌁"],
      ["Pending consultations", consultations.filter(c => c.status === "Pending").length, "✉"],
      ["Today's appointments", todayAppts, "◷"], ["Low-stock parts", low, "⚠"], ["Completed this month", completedMonth, "✓"]
    ];
    const repairStates = ["Received", "Diagnosing", "Waiting for Parts", "In Progress", "Completed", "Released"];
    const categoryCounts = AWStore.CATEGORIES.map(category => [category, assets.filter(a => a.category === category).length]).filter(row => row[1]);
    const maxRepairs = Math.max(1, ...repairStates.map(s => repairs.filter(r => r.status === s).length));
    const maxCategory = Math.max(1, ...categoryCounts.map(r => r[1]));
    const activity = AWStore.collection("activities").slice(0, 5);
    const upcoming = appointments.filter(a => a.status === "Scheduled" && new Date(a.dateTime) >= new Date()).sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime)).slice(0, 4);
    return `<div class="section-heading"><div><h1>Overview</h1><p>Here’s what’s happening at ${esc(AWStore.data().settings.shopName)}.</p></div><button class="btn" data-action="go-schedule">＋ New appointment</button></div>
      <div class="stats-grid">${statData.map(s => `<article class="card stat"><div class="stat-label">${s[0]}<span class="stat-icon">${s[2]}</span></div><div class="stat-value">${s[1]}</div><span class="small muted">Updated just now</span></article>`).join("")}</div>
      <div class="dashboard-grid"><section class="card card-pad"><div class="section-heading"><div><h2>Repairs by status</h2><p>Current repair workload</p></div></div><div class="chart-list">${repairStates.map(s => { const n = repairs.filter(r => r.status === s).length; return `<div class="chart-row"><span>${esc(s)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(n / maxRepairs * 100)}%"></div></div><strong>${n}</strong></div>`; }).join("")}</div><h3 style="margin:26px 0 13px">Assets by category</h3><div class="chart-list">${categoryCounts.length ? categoryCounts.map(([c, n]) => `<div class="chart-row"><span>${esc(c)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(n / maxCategory * 100)}%"></div></div><strong>${n}</strong></div>`).join("") : `<div class="empty">No assets added yet.</div>`}</div></section>
      <div class="card card-pad"><h2>Upcoming appointments</h2><p class="muted small">Your next scheduled visits</p>${upcoming.length ? upcoming.map(a => appointmentRow(a)).join("") : `<div class="empty">No upcoming appointments.</div>`}</div></div>
      <div class="card card-pad" style="margin-top:16px"><h2>Recent activity</h2>${activity.length ? `<ul class="activity-list">${activity.map(a => `<li class="activity-item"><span class="activity-dot"></span><div>${esc(a.text)}<time>${fmtDate(a.at)} · ${fmtTime(a.at)}</time></div></li>`).join("")}</ul>` : `<div class="empty">Activity will appear here as your team works.</div>`}</div>`;
  }
  function appointmentRow(a) {
    const customer = customerOf(a.customerId);
    return `<div class="appointment"><div class="date-block"><strong>${new Date(a.dateTime).getDate()}</strong><span>${new Date(a.dateTime).toLocaleDateString([], { month: "short" })}</span></div><div><strong>${esc(customer.name)}</strong><div class="small muted">${esc(a.type)} · ${fmtTime(a.dateTime)}</div></div>${badge(a.status)}</div>`;
  }
  const pageState = { inventoryPage: 1, inventorySort: "name", inventoryDir: 1, calendarDate: new Date(), calendarMode: "month" };
  const pageSize = 8;
  let currentAdminSection = "overview";
  let currentCustomerSection = "devices";
  let syncTimer;
  const pendingIncomingConsultationIds = new Set();
  function renderInventory() {
    const query = ($("#inventory-search") || {}).value || "";
    const category = ($("#inventory-category") || {}).value || "";
    const status = ($("#inventory-status") || {}).value || "";
    let assets = AWStore.collection("assets").filter(a => (!query || [a.id, a.name, a.brand, a.model, a.serial, idLabel("users", a.ownerId)].join(" ").toLowerCase().includes(query.toLowerCase())) && (!category || a.category === category) && (!status || a.status === status));
    assets.sort((a, b) => String(a[pageState.inventorySort] || "").localeCompare(String(b[pageState.inventorySort] || ""), undefined, { numeric: true }) * pageState.inventoryDir);
    const pages = Math.max(1, Math.ceil(assets.length / pageSize));
    pageState.inventoryPage = Math.min(pageState.inventoryPage, pages);
    const visible = assets.slice((pageState.inventoryPage - 1) * pageSize, pageState.inventoryPage * pageSize);
    return `<div class="section-heading"><div><h1>Asset inventory</h1><p>Devices, shop equipment, and parts in one place.</p></div><div class="toolbar"><button class="btn" data-action="export-csv">↓ Export CSV</button><button class="btn" data-action="import-csv">↑ Import CSV</button><button class="btn btn-primary" data-action="add-asset">＋ Add asset</button><input type="file" id="csv-file" accept=".csv,text/csv" class="hidden"></div></div>
      <div class="card"><div class="toolbar" style="padding:14px"><input class="control" id="inventory-search" type="search" placeholder="Search assets…" value="${esc(query)}" aria-label="Search assets"><select id="inventory-category" class="control" aria-label="Filter by category"><option value="">All categories</option>${AWStore.CATEGORIES.map(c => `<option ${c === category ? "selected" : ""}>${esc(c)}</option>`).join("")}</select><select id="inventory-status" class="control" aria-label="Filter by status"><option value="">All statuses</option>${AWStore.STATUSES.map(s => `<option ${s === status ? "selected" : ""}>${esc(s)}</option>`).join("")}</select><span class="muted small">${assets.length} asset${assets.length === 1 ? "" : "s"}</span></div>
      <div class="table-wrap"><table><thead><tr>${[["id","Asset ID"],["name","Asset"],["category","Category"],["brand","Brand / model"],["serial","Serial"],["ownerId","Owner"],["status","Status"],["quantity","Qty"]].map(([k, label]) => `<th><button class="btn btn-quiet btn-sm" data-action="sort-inventory" data-sort="${k}">${label}${pageState.inventorySort === k ? (pageState.inventoryDir > 0 ? " ↑" : " ↓") : ""}</button></th>`).join("")}<th>Actions</th></tr></thead><tbody>${visible.map(assetRow).join("")}</tbody></table>${visible.length ? "" : `<div class="empty"><span class="empty-icon">▤</span>No matching assets found.</div>`}</div>
      <div class="pagination"><span>Page ${pageState.inventoryPage} of ${pages}</span><div class="toolbar"><button class="btn btn-sm" data-action="inventory-page" data-page="-1" ${pageState.inventoryPage <= 1 ? "disabled" : ""}>Previous</button><button class="btn btn-sm" data-action="inventory-page" data-page="1" ${pageState.inventoryPage >= pages ? "disabled" : ""}>Next</button></div></div></div>`;
  }
  function assetRow(a) {
    const low = a.category === "Part/Component" && a.quantity <= (a.reorderLevel || AWStore.data().settings.lowStockThreshold);
    return `<tr class="${low ? "table-low" : ""}"><td><strong>${esc(a.id)}</strong></td><td><strong>${esc(a.name)}</strong><div class="small muted">${esc(a.condition)}</div></td><td>${esc(a.category)}</td><td>${esc([a.brand, a.model].filter(Boolean).join(" · ") || "—")}</td><td>${esc(a.serial || "—")}</td><td>${esc(a.ownerId ? idLabel("users", a.ownerId) : "Shop inventory")}</td><td>${badge(a.status)}</td><td>${a.category === "Part/Component" ? `${a.quantity}${low ? " ⚠" : ""}` : "—"}</td><td><div class="table-actions"><button class="btn btn-sm" data-action="edit-asset" data-id="${esc(a.id)}">Edit</button><button class="btn btn-sm btn-danger" data-action="delete-asset" data-id="${esc(a.id)}">Delete</button></div></td></tr>`;
  }
  function renderRepairs() {
    const repairs = AWStore.collection("repairs").slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return `<div class="section-heading"><div><h1>Repairs</h1><p>Track diagnosis, work, and customer hand-off.</p></div><button class="btn btn-primary" data-action="add-repair">＋ Create repair ticket</button></div>
    <div class="card"><div class="table-wrap"><table><thead><tr><th>Ticket</th><th>Device / customer</th><th>Reported issue</th><th>Priority</th><th>Status</th><th>Total</th><th>Received</th><th>Actions</th></tr></thead><tbody>${repairs.map(r => { const a = AWStore.find("assets", r.assetId); return `<tr><td><strong>${esc(r.id)}</strong></td><td>${esc(a ? a.name : "Removed device")}<div class="small muted">${esc(customerOf(r.customerId).name)}</div></td><td>${esc(r.issue)}</td><td>${badge(r.priority)}</td><td>${badge(r.status)}</td><td>${money(r.totalCost)}</td><td>${fmtDate(r.createdAt)}</td><td><button class="btn btn-sm" data-action="repair-detail" data-id="${esc(r.id)}">View / update</button></td></tr>`; }).join("")}</tbody></table>${repairs.length ? "" : `<div class="empty">No repair tickets yet.</div>`}</div></div>`;
  }
  function renderConsultations() {
    const list = AWStore.collection("consultations").slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return `<div class="section-heading"><div><h1>Consultations</h1><p>Review customer requests and turn good-fit quotes into repair tickets.</p></div></div><div class="card"><div class="table-wrap"><table><thead><tr><th>Request</th><th>Customer</th><th>Device</th><th>Problem</th><th>Preferred date</th><th>Status</th><th>Estimate</th><th>Actions</th></tr></thead><tbody>${list.map(c => `<tr><td><strong>${esc(c.id)}</strong></td><td>${esc(customerOf(c.customerId).name)}</td><td>${esc(c.device)}</td><td>${esc(c.problem)}</td><td>${fmtDate(c.preferredDate)}</td><td>${badge(c.status)}</td><td>${c.estimatedCost === "" ? "—" : money(c.estimatedCost)}</td><td><button class="btn btn-sm" data-action="consultation-detail" data-id="${esc(c.id)}">Review</button></td></tr>`).join("")}</tbody></table>${list.length ? "" : `<div class="empty">No consultation requests yet.</div>`}</div></div>`;
  }
  function renderSchedule() {
    const date = pageState.calendarDate;
    const settings = AWStore.data().settings;
    const appointments = AWStore.collection("appointments").slice();
    const prev = new Date(date.getFullYear(), date.getMonth() - (pageState.calendarMode === "month" ? 1 : 0), date.getDate() - (pageState.calendarMode === "week" ? 7 : 0));
    const next = new Date(date.getFullYear(), date.getMonth() + (pageState.calendarMode === "month" ? 1 : 0), date.getDate() + (pageState.calendarMode === "week" ? 7 : 0));
    let start, count;
    if (pageState.calendarMode === "month") {
      start = new Date(date.getFullYear(), date.getMonth(), 1);
      start.setDate(start.getDate() - start.getDay());
      count = 42;
    } else {
      start = new Date(date); start.setDate(date.getDate() - date.getDay()); start.setHours(0, 0, 0, 0); count = 7;
    }
    const days = Array.from({ length: count }, (_, i) => {
      const day = new Date(start); day.setDate(start.getDate() + i);
      const today = new Date().toDateString() === day.toDateString();
      const events = appointments.filter(a => new Date(a.dateTime).toDateString() === day.toDateString()).sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
      return `<div class="cal-day ${pageState.calendarMode === "month" && day.getMonth() !== date.getMonth() ? "outside" : ""} ${today ? "today" : ""}"><div class="cal-num">${day.getDate()}</div>${events.slice(0, 3).map(a => `<button class="cal-event ${a.type === "consultation" ? "consultation" : a.type === "pickup" ? "pickup" : ""} ${a.status === "Cancelled" ? "cancelled" : ""}" title="${esc(a.notes)} · ${fmtTime(a.dateTime)}" data-action="appointment-detail" data-id="${esc(a.id)}">${fmtTime(a.dateTime)} ${esc(a.type)}</button>`).join("")}${events.length > 3 ? `<span class="small muted">+${events.length - 3} more</span>` : ""}</div>`;
    }).join("");
    return `<div class="section-heading"><div><h1>Scheduling</h1><p>Appointments, drop-offs, consultations, and pickups.</p></div><button class="btn btn-primary" data-action="add-appointment">＋ New appointment</button></div>
      <div class="card card-pad"><div class="calendar-toolbar"><div class="toolbar"><button class="btn btn-sm" data-action="calendar-move" data-dir="-1" aria-label="Previous period">←</button><button class="btn btn-sm" data-action="calendar-today">Today</button><button class="btn btn-sm" data-action="calendar-move" data-dir="1" aria-label="Next period">→</button><strong>${date.toLocaleDateString([], { month: "long", year: "numeric" })}</strong></div><div class="toolbar"><button class="btn btn-sm ${pageState.calendarMode === "month" ? "btn-primary" : ""}" data-action="calendar-mode" data-mode="month">Month</button><button class="btn btn-sm ${pageState.calendarMode === "week" ? "btn-primary" : ""}" data-action="calendar-mode" data-mode="week">Week</button></div></div>
      <div class="legend"><span><i></i>Drop-off</span><span><i class="l-consult"></i>Consultation</span><span><i class="l-pickup"></i>Pickup</span></div><div class="calendar-grid">${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => `<div class="cal-head">${d}</div>`).join("")}${days}</div>
      <p class="notice" style="margin:16px 0 0">Business hours: ${settings.openHour}:00–${settings.closeHour}:00 · ${settings.slotMinutes}-minute slots · Sundays closed.</p></div>`;
  }
  function renderCustomers() {
    const query = ($("#customer-search") || {}).value || "";
    const customers = AWStore.collection("customers").filter(c => !query || `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(query.toLowerCase()));
    return `<div class="section-heading"><div><h1>Customers</h1><p>Registered customers, devices, and repair history.</p></div><input id="customer-search" class="control" type="search" placeholder="Search customers…" value="${esc(query)}" aria-label="Search customers"></div>
      <div class="card"><div class="table-wrap"><table><thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Devices</th><th>Repair tickets</th><th>Joined</th><th>Details</th></tr></thead><tbody>${customers.map(c => `<tr><td><strong>${esc(c.name)}</strong></td><td>${esc(c.email)}</td><td>${esc(c.phone)}</td><td>${ownerDevices(c.userId || c.id).length}</td><td>${AWStore.collection("repairs").filter(r => r.customerId === (c.userId || c.id)).length}</td><td>${fmtDate(c.createdAt)}</td><td><button class="btn btn-sm" data-action="customer-detail" data-id="${esc(c.id)}">View details</button></td></tr>`).join("")}</tbody></table>${customers.length ? "" : `<div class="empty">No customers match your search.</div>`}</div></div>`;
  }
  function renderSettings() {
    const s = AWStore.data().settings;
    return `<div class="section-heading"><div><h1>Settings</h1><p>Configure the shop details used across your workspace.</p></div></div><div class="card card-pad"><form id="settings-form" class="form-grid">
      <div class="field span-2"><label for="shop-name">Shop name</label><input id="shop-name" name="shopName" required value="${esc(s.shopName)}"></div>
      <div class="field"><label for="open-hour">Opening hour (24-hour)</label><input id="open-hour" name="openHour" type="number" min="0" max="23" value="${s.openHour}" required></div><div class="field"><label for="close-hour">Closing hour (24-hour)</label><input id="close-hour" name="closeHour" type="number" min="1" max="24" value="${s.closeHour}" required></div>
      <div class="field"><label for="slot-minutes">Appointment duration (minutes)</label><select id="slot-minutes" name="slotMinutes">${[15,30,45,60,90,120].map(n => `<option value="${n}" ${Number(s.slotMinutes) === n ? "selected" : ""}>${n} minutes</option>`).join("")}</select></div>
      <div class="field"><label for="low-stock">Low-stock threshold</label><input id="low-stock" name="lowStockThreshold" type="number" min="0" value="${s.lowStockThreshold}" required></div>
      <div class="field span-2"><label for="technician">Default technician</label><input id="technician" name="technician" value="${esc(s.technician || "")}"></div>
      <div class="form-actions span-2"><button class="btn btn-primary" type="submit">Save settings</button></div>
    </form></div><div class="card card-pad" style="margin-top:16px"><h2>Data management</h2><p class="muted">Export a full backup or restore from a previous AssetWise backup. Resetting removes all locally saved app data and reloads the sample dataset.</p><div class="toolbar"><button class="btn" data-action="backup-json">↓ Export JSON backup</button><button class="btn" data-action="restore-json">↑ Restore JSON backup</button><input type="file" id="json-file" accept=".json,application/json" class="hidden"><button class="btn btn-danger" data-action="reset-data">Reset sample data</button></div></div>`;
  }
  function assetForm(asset) {
    const editing = !!asset;
    return `<form id="asset-form" data-id="${editing ? esc(asset.id) : ""}" class="form-grid" novalidate>
      <div class="field span-2"><label for="asset-name">Asset name *</label><input id="asset-name" name="name" required value="${esc(asset ? asset.name : "")}"></div>
      <div class="field"><label for="asset-category">Category *</label><select id="asset-category" name="category">${AWStore.CATEGORIES.map(c => `<option ${asset && asset.category === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
      <div class="field"><label for="asset-status">Status</label><select id="asset-status" name="status">${AWStore.STATUSES.map(s => `<option ${asset && asset.status === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></div>
      <div class="field"><label for="asset-brand">Brand</label><input id="asset-brand" name="brand" value="${esc(asset ? asset.brand : "")}"></div><div class="field"><label for="asset-model">Model</label><input id="asset-model" name="model" value="${esc(asset ? asset.model : "")}"></div>
      <div class="field"><label for="asset-serial">Serial number</label><input id="asset-serial" name="serial" value="${esc(asset ? asset.serial : "")}"></div>
      <div class="field"><label for="asset-owner">Owner / customer</label><select id="asset-owner" name="ownerId"><option value="">Shop inventory / unassigned</option>${AWStore.collection("customers").map(c => `<option value="${esc(c.userId || c.id)}" ${asset && asset.ownerId === (c.userId || c.id) ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
      <div class="field"><label for="asset-condition">Condition</label><select id="asset-condition" name="condition">${["New","Excellent","Good","Fair","Poor"].map(c => `<option ${asset && asset.condition === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>
      <div class="field"><label for="asset-date">Date received</label><input id="asset-date" name="dateReceived" type="date" value="${esc(asset ? asset.dateReceived : new Date().toISOString().slice(0,10))}"></div>
      <div class="field"><label for="asset-quantity">Quantity (parts)</label><input id="asset-quantity" name="quantity" type="number" min="0" value="${asset ? asset.quantity : 0}"></div><div class="field"><label for="asset-reorder">Reorder level</label><input id="asset-reorder" name="reorderLevel" type="number" min="0" value="${asset ? asset.reorderLevel : 0}"></div>
      <div class="field span-2"><label for="asset-notes">Notes</label><textarea id="asset-notes" name="notes">${esc(asset ? asset.notes : "")}</textarea></div>
      <div class="form-actions span-2"><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">${editing ? "Save changes" : "Add asset"}</button></div></form>`;
  }
  function repairForm() {
    const assets = AWStore.collection("assets").filter(a => a.category !== "Part/Component" && a.status !== "Retired");
    const customers = AWStore.collection("customers");
    return `<form id="repair-form" class="form-grid" novalidate>
      <div class="field"><label for="repair-customer">Customer *</label><select id="repair-customer" name="customerId" required><option value="">Select customer</option>${customers.map(c => `<option value="${esc(c.userId || c.id)}">${esc(c.name)}</option>`).join("")}</select></div>
      <div class="field"><label for="repair-asset">Device *</label><select id="repair-asset" name="assetId" required><option value="">Select device</option>${assets.map(a => `<option value="${esc(a.id)}">${esc(a.id)} · ${esc(a.name)}</option>`).join("")}</select></div>
      <div class="field span-2"><label for="repair-issue">Reported issue *</label><textarea id="repair-issue" name="issue" required></textarea></div>
      <div class="field span-2"><label for="repair-diagnosis">Diagnosis</label><textarea id="repair-diagnosis" name="diagnosis"></textarea></div>
      <div class="field"><label for="repair-priority">Priority</label><select id="repair-priority" name="priority"><option>Normal</option><option>Low</option><option>High</option><option>Urgent</option></select></div>
      <div class="field"><label for="repair-status">Status</label><select id="repair-status" name="status">${["Received","Diagnosing","Waiting for Parts","In Progress","Completed","Released"].map(s => `<option>${s}</option>`).join("")}</select></div>
      <div class="field"><label for="repair-labor">Labor cost ($)</label><input id="repair-labor" name="laborCost" type="number" min="0" step=".01" value="0"></div>
      <div class="field"><label for="repair-parts-cost">Other parts cost ($)</label><input id="repair-parts-cost" name="partsCost" type="number" min="0" step=".01" value="0"></div>
      <div class="field"><label for="repair-technician">Assigned technician</label><input id="repair-technician" name="technician" value="${esc(AWStore.data().settings.technician)}"></div>
      <div class="field"><label for="repair-part">Deduct a part from inventory</label><select id="repair-part" name="partId"><option value="">No part selected</option>${AWStore.collection("assets").filter(a => a.category === "Part/Component" && a.quantity > 0).map(a => `<option value="${esc(a.id)}">${esc(a.name)} · ${a.quantity} available</option>`).join("")}</select></div>
      <div class="field"><label for="repair-part-quantity">Part quantity</label><input id="repair-part-quantity" name="partQuantity" type="number" min="1" value="1"></div>
      <div class="field"><label for="repair-part-unit-cost">Part unit cost ($)</label><input id="repair-part-unit-cost" name="partUnitCost" type="number" min="0" step=".01" value="0"></div>
      <div class="form-actions span-2"><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">Create repair ticket</button></div></form>`;
  }
  function repairDetail(id) {
    const r = AWStore.find("repairs", id);
    if (!r) return;
    const asset = AWStore.find("assets", r.assetId);
    const history = (r.history || []).slice().reverse();
    const customer = customerOf(r.customerId);
    openModal(`Repair ticket ${r.id}`, `<div class="split-grid"><div><h3>${esc(asset ? asset.name : "Device removed")}</h3><p>${esc(customer.name)} · ${esc(customer.phone)}</p><p><strong>Reported:</strong> ${esc(r.issue)}</p><p><strong>Diagnosis:</strong> ${esc(r.diagnosis || "Not yet recorded")}</p><p><strong>Technician:</strong> ${esc(r.technician)}</p><p><strong>Priority:</strong> ${badge(r.priority)}</p><p><strong>Labor:</strong> ${money(r.laborCost)} &nbsp; <strong>Parts:</strong> ${money(r.partsCost)} &nbsp; <strong>Total:</strong> ${money(r.totalCost)}</p>${r.partsUsed && r.partsUsed.length ? `<p><strong>Parts used:</strong> ${r.partsUsed.map(p => `${esc(idLabel("assets", p.assetId))} × ${p.quantity}`).join(", ")}</p>` : ""}</div><div><h3>Update repair</h3><form id="repair-update-form" data-id="${esc(id)}"><div class="field"><label for="update-status">Status</label><select id="update-status" name="status">${["Received","Diagnosing","Waiting for Parts","In Progress","Completed","Released"].map(s => `<option ${r.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div><div class="field" style="margin-top:10px"><label for="update-diagnosis">Diagnosis</label><textarea id="update-diagnosis" name="diagnosis">${esc(r.diagnosis || "")}</textarea></div><div class="field" style="margin-top:10px"><label for="update-note">History note</label><input id="update-note" name="note" placeholder="What changed?"></div><div class="form-actions"><button type="button" class="btn" data-action="print-repair" data-id="${esc(id)}">Print slip</button><button type="submit" class="btn btn-primary">Save update</button></div></form></div></div><div class="timeline">${history.map(h => `<div class="timeline-entry"><strong>${esc(h.status)}</strong><div>${esc(h.note || "")}</div><time>${fmtDate(h.at)} · ${fmtTime(h.at)}</time></div>`).join("")}</div>`, true);
  }
  function consultationDetail(id) {
    const c = AWStore.find("consultations", id);
    if (!c) return;
    const customer = customerOf(c.customerId);
    openModal(`Consultation ${c.id}`, `<p><strong>${esc(customer.name)}</strong> · ${esc(customer.email)}</p><p><strong>Device:</strong> ${esc(c.device)}</p><p><strong>Problem:</strong> ${esc(c.problem)}</p><p><strong>Preferred date:</strong> ${fmtDate(c.preferredDate)}</p><form id="consultation-form" data-id="${esc(id)}" class="form-grid"><div class="field"><label for="consult-status">Status</label><select id="consult-status" name="status">${["Pending","Reviewed","Quoted","Converted to Repair","Declined"].map(s => `<option ${c.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div><div class="field"><label for="consult-cost">Estimated cost ($)</label><input id="consult-cost" name="estimatedCost" type="number" min="0" step=".01" value="${esc(c.estimatedCost)}"></div><div class="field span-2"><label for="consult-notes">Reply / notes for customer</label><textarea id="consult-notes" name="notes">${esc(c.notes)}</textarea></div><div class="form-actions span-2"><button type="button" class="btn" data-action="close-modal">Close</button><button type="submit" class="btn btn-primary">Save consultation</button><button type="button" class="btn" data-action="convert-consultation" data-id="${esc(id)}">Convert to repair</button></div></form>`, true);
  }
  function appointmentForm(appointment) {
    const s = AWStore.data().settings;
    const date = appointment ? new Date(appointment.dateTime) : new Date(Date.now() + 86400000);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const localTime = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    return `<form id="appointment-form" data-id="${appointment ? esc(appointment.id) : ""}" class="form-grid" novalidate>
      <div class="field"><label for="appointment-customer">Customer *</label><select id="appointment-customer" name="customerId" required><option value="">Select customer</option>${AWStore.collection("customers").map(c => `<option value="${esc(c.userId || c.id)}" ${appointment && appointment.customerId === (c.userId || c.id) ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
      <div class="field"><label for="appointment-type">Appointment type</label><select id="appointment-type" name="type">${["drop-off","consultation","pickup"].map(t => `<option ${appointment && appointment.type === t ? "selected" : ""}>${t}</option>`).join("")}</select></div>
      <div class="field"><label for="appointment-date">Date *</label><input id="appointment-date" name="date" type="date" min="${new Date().toISOString().slice(0,10)}" value="${localDate}" required></div>
      <div class="field"><label for="appointment-time">Available time *</label><select id="appointment-time" name="time" required>${appointment ? `<option value="${localTime}">${fmtTime(date.toISOString())} (current)</option>` : ""}${timeOptions(localDate, appointment && appointment.id, localTime)}</select></div>
      <div class="field span-2"><label for="appointment-notes">Notes</label><textarea id="appointment-notes" name="notes">${esc(appointment ? appointment.notes : "")}</textarea></div>
      <div class="form-actions span-2"><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">${appointment ? "Save appointment" : "Book appointment"}</button></div></form>`;
  }
  function timeOptions(dateString, ignoreId, currentTime) {
    const settings = AWStore.data().settings;
    const date = new Date(`${dateString}T12:00:00`);
    if (!dateString || Number.isNaN(date.getTime()) || settings.closedDays.includes(date.getDay())) return `<option value="">Closed on this date</option>`;
    const result = [];
    const step = Number(settings.slotMinutes) || 30;
    for (let minute = settings.openHour * 60; minute + step <= settings.closeHour * 60; minute += step) {
      const h = Math.floor(minute / 60), m = minute % 60;
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const slot = new Date(`${dateString}T${value}:00`);
      if (slot <= new Date() && value !== currentTime) continue;
      const occupied = AWStore.collection("appointments").some(a => a.id !== ignoreId && a.status !== "Cancelled" && new Date(a.dateTime).getTime() === slot.getTime());
      if (!occupied || value === currentTime) result.push(`<option value="${value}" ${value === currentTime ? "selected" : ""}>${slot.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}${occupied ? " (current)" : ""}</option>`);
    }
    return result.length ? result.join("") : `<option value="">No available slots</option>`;
  }
  function initCustomer() {
    const user = window.AWCurrentUser;
    if (!user) return;
    $("#customer-name").textContent = user.name;
    $("#customer-greeting").textContent = user.name.split(/\s+/)[0];
    $("#customer-avatar").textContent = user.name.slice(0, 1).toUpperCase();
    $("#customer-shop-name").textContent = AWStore.data().settings.shopName;
    $$(".customer-tab").forEach(tab => tab.addEventListener("click", () => {
      $$(".customer-tab").forEach(item => item.classList.toggle("active", item === tab));
      renderCustomer(tab.dataset.customerTab);
    }));
    renderCustomer("devices");
  }
  function renderCustomer(section) {
    const root = $("#customer-content"), user = window.AWCurrentUser;
    if (!root || !user) return;
    currentCustomerSection = section;
    const devices = ownerDevices(user.id);
    if (section === "devices") root.innerHTML = `<div class="section-heading"><div><h2>My devices</h2><p>Devices registered with ${esc(AWStore.data().settings.shopName)}.</p></div></div>${devices.length ? `<div class="split-grid">${devices.map(a => `<article class="card card-pad"><div class="section-heading"><div><span class="badge info">${esc(a.category)}</span><h2 style="margin:9px 0 3px">${esc(a.name)}</h2><p>${esc([a.brand,a.model].filter(Boolean).join(" · "))}</p></div>${badge(a.status)}</div><p class="small muted">Asset ${esc(a.id)}${a.serial ? ` · S/N ${esc(a.serial)}` : ""}</p>${a.notes ? `<p>${esc(a.notes)}</p>` : ""}</article>`).join("")}</div>` : `<div class="card empty"><span class="empty-icon">▤</span>No devices are linked to your account yet.<p>When you book your first device in, it will appear here.</p></div>`}`;
    if (section === "consultation") root.innerHTML = `<div class="section-heading"><div><h2>Request a consultation</h2><p>Tell us what is happening and when you would like to talk.</p></div></div><div class="split-grid"><form id="customer-consultation-form" class="card card-pad form-grid"><div class="field span-2"><label for="customer-device">Device *</label><input id="customer-device" name="device" required placeholder="Make and model">${devices.length ? `<span class="small muted">Your registered devices: ${devices.map(a => esc(a.name)).join(", ")}</span>` : ""}</div><div class="field span-2"><label for="customer-problem">What do you need help with? *</label><textarea id="customer-problem" name="problem" required placeholder="Describe the issue or question"></textarea></div><div class="field span-2"><label for="preferred-date">Preferred date</label><input id="preferred-date" name="preferredDate" type="date" min="${new Date().toISOString().slice(0,10)}"></div><div class="form-actions span-2"><button class="btn btn-primary" type="submit">Send consultation request</button></div></form><div class="card card-pad"><h2>My consultation requests</h2>${customerConsultations(user.id).map(c => `<div class="appointment"><div class="date-block"><strong>${new Date(c.createdAt).getDate()}</strong><span>${new Date(c.createdAt).toLocaleDateString([], {month:"short"})}</span></div><div><strong>${esc(c.device)}</strong><div class="small muted">${esc(c.notes || c.problem)}</div></div>${badge(c.status)}</div>`).join("") || `<div class="empty">Your requests will show up here.</div>`}</div></div>`;
    if (section === "appointments") root.innerHTML = `<div class="section-heading"><div><h2>Book an appointment</h2><p>Choose from available shop hours. All times are local.</p></div></div><div class="split-grid"><form id="customer-appointment-form" class="card card-pad form-grid"><div class="field"><label for="customer-appt-type">Visit type</label><select id="customer-appt-type" name="type"><option>drop-off</option><option>consultation</option><option>pickup</option></select></div><div class="field"><label for="customer-appt-device">Device (optional)</label><select id="customer-appt-device" name="device"><option value="">Not specified</option>${devices.map(a => `<option>${esc(a.name)}</option>`).join("")}</select></div><div class="field"><label for="customer-appt-date">Date *</label><input id="customer-appt-date" name="date" type="date" min="${new Date().toISOString().slice(0,10)}" required></div><div class="field"><label for="customer-appt-time">Available time *</label><select id="customer-appt-time" name="time" required><option value="">Choose a date first</option></select></div><div class="field span-2"><label for="customer-appt-notes">Notes</label><textarea id="customer-appt-notes" name="notes" placeholder="Anything we should know?"></textarea></div><div class="form-actions span-2"><button class="btn btn-primary" type="submit">Book this appointment</button></div></form><div class="card card-pad"><h2>My appointments</h2>${customerAppointments(user.id).map(a => `<div class="appointment"><div class="date-block"><strong>${new Date(a.dateTime).getDate()}</strong><span>${new Date(a.dateTime).toLocaleDateString([], {month:"short"})}</span></div><div><strong>${esc(a.type)}</strong><div class="small muted">${fmtDate(a.dateTime)} · ${fmtTime(a.dateTime)}</div></div>${a.status === "Scheduled" ? `<button class="btn btn-sm btn-danger" data-action="customer-cancel-appointment" data-id="${esc(a.id)}">Cancel</button>` : badge(a.status)}</div>`).join("") || `<div class="empty">You have no appointments booked.</div>`}</div></div>`;
    if (section === "repairs") {
      const repairs = AWStore.collection("repairs").filter(r => r.customerId === user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const steps = ["Received","Diagnosing","Waiting for Parts","In Progress","Completed","Released"];
      root.innerHTML = `<div class="section-heading"><div><h2>My repairs</h2><p>Follow repair milestones and see service details.</p></div></div>${repairs.length ? `<div class="split-grid">${repairs.map(r => { const asset = AWStore.find("assets", r.assetId); const idx = steps.indexOf(r.status); return `<article class="card card-pad"><div class="section-heading"><div><span class="badge info">${esc(r.id)}</span><h2 style="margin:8px 0 0">${esc(asset ? asset.name : "Device")}</h2></div>${badge(r.status)}</div><p>${esc(r.issue)}</p><div class="progress">${steps.map((s, i) => `<div class="progress-step ${i <= idx ? "done" : ""}">${esc(s === "Waiting for Parts" ? "Parts" : s)}</div>`).join("")}</div><p class="small muted">Received ${fmtDate(r.createdAt)} · Current estimate ${money(r.totalCost)}</p>${r.diagnosis ? `<p><strong>Technician notes:</strong> ${esc(r.diagnosis)}</p>` : ""}</article>`; }).join("")}</div>` : `<div class="card empty"><span class="empty-icon">⌁</span>No repair tickets linked to your account yet.</div>`}`;
    }
    if (section === "profile") root.innerHTML = `<div class="section-heading"><div><h2>Profile</h2><p>Keep your contact details current.</p></div></div><form id="profile-form" class="card card-pad profile-grid form-grid"><div class="field span-2"><label for="profile-name">Full name</label><input id="profile-name" name="name" required value="${esc(user.name)}"></div><div class="field span-2"><label for="profile-email">Email address</label><input id="profile-email" value="${esc(user.email)}" disabled><span class="small muted">Email is used to sign in and cannot be changed here.</span></div><div class="field span-2"><label for="profile-phone">Phone number</label><input id="profile-phone" name="phone" required value="${esc(user.phone)}"></div><div class="form-actions span-2"><button class="btn btn-primary" type="submit">Save profile</button></div></form><form id="password-form" class="card card-pad profile-grid form-grid" style="margin-top:16px"><h2 class="span-2">Change password</h2><div class="field span-2"><label for="old-password">Current password</label><input id="old-password" name="oldPassword" type="password" required></div><div class="field"><label for="new-password">New password</label><input id="new-password" name="newPassword" type="password" required></div><div class="field"><label for="confirm-new-password">Confirm new password</label><input id="confirm-new-password" name="confirmPassword" type="password" required></div><p class="form-error span-2" id="password-error"></p><div class="form-actions span-2"><button class="btn btn-primary" type="submit">Update password</button></div></form>`;
  }
  function customerConsultations(id) { return AWStore.collection("consultations").filter(c => c.customerId === id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); }
  function customerAppointments(id) { return AWStore.collection("appointments").filter(a => a.customerId === id).sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime)); }

  function handleAction(event) {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.action, id = button.dataset.id;
    if (action === "close-modal") closeModal();
    else if (action === "add-asset") openModal("Add asset", assetForm());
    else if (action === "edit-asset") { const a = AWStore.find("assets", id); if (a) openModal(`Edit ${a.id}`, assetForm(a), true); }
    else if (action === "delete-asset") {
      const open = AWStore.collection("repairs").some(r => !["Completed", "Released"].includes(r.status) && (r.assetId === id || (r.partsUsed || []).some(part => part.assetId === id)));
      if (open) { toast("This device is linked to an open repair and cannot be deleted.", "error"); return; }
      if (confirm("Delete this asset permanently?")) { AWStore.remove("assets", id); AWStore.activity(`Asset ${id} deleted.`); rerenderCurrentAdmin(); toast("Asset deleted."); }
    } else if (action === "sort-inventory") {
      pageState.inventoryDir = pageState.inventorySort === button.dataset.sort ? -pageState.inventoryDir : 1;
      pageState.inventorySort = button.dataset.sort; rerenderCurrentAdmin();
    } else if (action === "inventory-page") { pageState.inventoryPage += Number(button.dataset.page); rerenderCurrentAdmin(); }
    else if (action === "export-csv") exportCSV()
    else if (action === "import-csv") $("#csv-file").click()
    else if (action === "add-repair") openModal("Create repair ticket", repairForm(), true)
    else if (action === "repair-detail") repairDetail(id)
    else if (action === "consultation-detail") consultationDetail(id)
    else if (action === "convert-consultation") convertConsultation(id)
    else if (action === "add-appointment") openModal("New appointment", appointmentForm())
    else if (action === "appointment-detail") {
      const appointment = AWStore.find("appointments", id);
      if (!appointment) return;
      openModal("Appointment details", `<p><strong>${esc(customerOf(appointment.customerId).name)}</strong> · ${esc(appointment.type)}</p><p>${fmtDate(appointment.dateTime)} at ${fmtTime(appointment.dateTime)} · ${esc(appointment.notes || "No notes")}</p><p>Status: ${badge(appointment.status)}</p>${appointment.status === "Scheduled" ? `<div class="form-actions"><button class="btn" data-action="reschedule-appointment" data-id="${esc(id)}">Reschedule</button><button class="btn btn-danger" data-action="cancel-appointment" data-id="${esc(id)}">Cancel appointment</button></div>` : ""}`);
    } else if (action === "reschedule-appointment") { const a = AWStore.find("appointments", id); if (a) openModal("Reschedule appointment", appointmentForm(a)); }
    else if (action === "cancel-appointment") {
      if (confirm("Cancel this appointment?")) { AWStore.update("appointments", id, { status: "Cancelled" }); AWStore.activity(`Appointment ${id} cancelled.`); closeModal(); rerenderCurrentAdmin(); toast("Appointment cancelled."); }
    } else if (action === "calendar-mode") { pageState.calendarMode = button.dataset.mode; rerenderCurrentAdmin(); }
    else if (action === "calendar-move") {
      const date = pageState.calendarDate;
      pageState.calendarDate = new Date(date.getFullYear(), date.getMonth() + (pageState.calendarMode === "month" ? Number(button.dataset.dir) : 0), date.getDate() + (pageState.calendarMode === "week" ? Number(button.dataset.dir) * 7 : 0));
      rerenderCurrentAdmin();
    } else if (action === "calendar-today") { pageState.calendarDate = new Date(); rerenderCurrentAdmin(); }
    else if (action === "customer-detail") customerDetail(id)
    else if (action === "backup-json") download("assetwise-backup.json", AWStore.exportData(), "application/json")
    else if (action === "restore-json") $("#json-file").click()
    else if (action === "reset-data") resetData()
    else if (action === "print-repair") printRepair(id)
    else if (action === "go-schedule") { location.hash = "schedule"; renderAdmin("schedule"); }
    else if (action === "customer-cancel-appointment") {
      if (confirm("Cancel this appointment?")) { AWStore.update("appointments", id, { status: "Cancelled" }); AWStore.activity(`Customer cancelled appointment ${id}.`); renderCustomer("appointments"); toast("Appointment cancelled."); }
    }
  }
  function handleChange(event) {
    const target = event.target;
    if (target.id === "inventory-category" || target.id === "inventory-status") { pageState.inventoryPage = 1; rerenderCurrentAdmin(); }
    else if (target.id === "csv-file" && target.files[0]) importCSVFile(target.files[0]);
    else if (target.id === "json-file" && target.files[0]) restoreJSONFile(target.files[0]);
    else if (target.id === "appointment-date") {
      const form = target.closest("form");
      const time = $("#appointment-time", form);
      if (time) time.innerHTML = timeOptions(target.value, form.dataset.id, "");
    } else if (target.id === "customer-appt-date") {
      const time = $("#customer-appt-time");
      time.innerHTML = timeOptions(target.value, "", "");
    }
  }
  function handleInput(event) {
    const target = event.target;
    if (target.id !== "inventory-search" && target.id !== "customer-search") return;
    const id = target.id, start = target.selectionStart;
    rerenderCurrentAdmin();
    const replacement = document.getElementById(id);
    if (replacement) {
      replacement.focus();
      if (start !== null) replacement.setSelectionRange(start, start);
    }
  }
  function handleSubmit(event) {
    const form = event.target;
    if (!form.id) return;
    if (form.id === "asset-form") { event.preventDefault(); saveAsset(form); }
    else if (form.id === "repair-form") { event.preventDefault(); saveRepair(form); }
    else if (form.id === "repair-update-form") { event.preventDefault(); updateRepair(form); }
    else if (form.id === "consultation-form") { event.preventDefault(); saveConsultation(form); }
    else if (form.id === "appointment-form") { event.preventDefault(); saveAppointment(form); }
    else if (form.id === "settings-form") { event.preventDefault(); saveSettings(form); }
    else if (form.id === "customer-consultation-form") { event.preventDefault(); createCustomerConsultation(form); }
    else if (form.id === "customer-appointment-form") { event.preventDefault(); createCustomerAppointment(form); }
    else if (form.id === "profile-form") { event.preventDefault(); saveProfile(form); }
    else if (form.id === "password-form") { event.preventDefault(); changePassword(form); }
  }
  function formValues(form) { return Object.fromEntries(new FormData(form).entries()); }
  function nonNegative(value, label) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw new Error(`${label} must be zero or greater.`);
    return number;
  }
  function saveAsset(form) {
    try {
      const v = formValues(form), name = v.name.trim();
      if (!name) throw new Error("Asset name is required.");
      const quantity = nonNegative(v.quantity, "Quantity"), reorderLevel = nonNegative(v.reorderLevel, "Reorder level");
      if (v.dateReceived && Number.isNaN(new Date(`${v.dateReceived}T00:00:00`).getTime())) throw new Error("Enter a valid date received.");
      const base = { name, category: v.category, status: v.status, brand: v.brand.trim(), model: v.model.trim(), serial: v.serial.trim(), ownerId: v.ownerId, condition: v.condition, dateReceived: v.dateReceived || new Date().toISOString().slice(0, 10), quantity: v.category === "Part/Component" ? quantity : 0, reorderLevel: v.category === "Part/Component" ? reorderLevel : 0, notes: v.notes.trim() };
      if (form.dataset.id) AWStore.update("assets", form.dataset.id, base);
      else { base.id = AWStore.nextId("asset", "AW"); AWStore.insert("assets", base); }
      AWStore.activity(`${form.dataset.id ? "Asset updated" : "Asset added"}: ${name}.`);
      closeModal(); rerenderCurrentAdmin(); toast(form.dataset.id ? "Asset updated." : "Asset added.");
    } catch (error) { toast(error.message, "error"); }
  }
  function saveRepair(form) {
    try {
      const v = formValues(form);
      if (!v.customerId || !v.assetId || !v.issue.trim()) throw new Error("Select a customer and device, and enter the reported issue.");
      const asset = AWStore.find("assets", v.assetId);
      if (!asset) throw new Error("The selected device no longer exists.");
      const laborCost = nonNegative(v.laborCost, "Labor cost"), extraCost = nonNegative(v.partsCost, "Parts cost");
      const partsUsed = [];
      let partCost = 0;
      if (v.partId) {
        const part = AWStore.find("assets", v.partId), quantity = Number(v.partQuantity), unitCost = nonNegative(v.partUnitCost, "Part unit cost");
        if (!part || part.category !== "Part/Component" || !Number.isInteger(quantity) || quantity < 1 || part.quantity < quantity) throw new Error("The selected part does not have enough available quantity.");
        AWStore.update("assets", part.id, { quantity: part.quantity - quantity });
        partCost = unitCost * quantity;
        partsUsed.push({ assetId: part.id, quantity, cost: partCost });
      }
      const now = new Date().toISOString();
      const repair = { id: AWStore.nextId("repair", "RP"), assetId: asset.id, customerId: v.customerId, issue: v.issue.trim(), diagnosis: v.diagnosis.trim(), partsUsed, laborCost, partsCost: extraCost + partCost, totalCost: laborCost + extraCost + partCost, priority: v.priority, status: v.status, technician: v.technician.trim() || AWStore.data().settings.technician, createdAt: now, history: [{ status: v.status, at: now, note: "Repair ticket created" }] };
      AWStore.insert("repairs", repair);
      AWStore.update("assets", asset.id, { ownerId: asset.ownerId || v.customerId, status: v.status === "Completed" ? "Ready for Pickup" : v.status === "Released" ? "Released" : "In Repair" });
      AWStore.activity(`Repair ticket ${repair.id} created for ${asset.name}.`);
      closeModal(); renderAdmin("repairs"); toast(`Repair ticket ${repair.id} created.`);
    } catch (error) { toast(error.message, "error"); }
  }
  function updateRepair(form) {
    try {
      const id = form.dataset.id, current = AWStore.find("repairs", id), v = formValues(form);
      if (!current) throw new Error("Repair ticket could not be found.");
      const status = v.status, now = new Date().toISOString();
      const history = current.history || [];
      if (status !== current.status || v.note.trim()) history.push({ status, at: now, note: v.note.trim() || `Status changed to ${status}` });
      AWStore.update("repairs", id, { status, diagnosis: v.diagnosis.trim(), history });
      const assetStatus = status === "Completed" ? "Ready for Pickup" : status === "Released" ? "Released" : "In Repair";
      if (AWStore.find("assets", current.assetId)) AWStore.update("assets", current.assetId, { status: assetStatus });
      AWStore.activity(`Repair ${id} updated to ${status}.`);
      closeModal(); renderAdmin("repairs"); toast("Repair ticket updated.");
    } catch (error) { toast(error.message, "error"); }
  }
  function saveConsultation(form) {
    try {
      const v = formValues(form), cost = v.estimatedCost === "" ? "" : nonNegative(v.estimatedCost, "Estimated cost");
      AWStore.update("consultations", form.dataset.id, { status: v.status, notes: v.notes.trim(), estimatedCost: cost });
      AWStore.activity(`Consultation ${form.dataset.id} updated to ${v.status}.`);
      closeModal(); renderAdmin("consultations"); toast("Consultation updated.");
    } catch (error) { toast(error.message, "error"); }
  }
  function convertConsultation(id) {
    const c = AWStore.find("consultations", id);
    if (!c) { toast("Consultation could not be found.", "error"); return; }
    const asset = { id: AWStore.nextId("asset", "AW"), name: c.device, category: "Other", brand: "", model: "", serial: "", ownerId: c.customerId, status: "In Repair", condition: "Good", dateReceived: new Date().toISOString().slice(0, 10), notes: `Created from consultation ${id}.`, quantity: 0, reorderLevel: 0 };
    AWStore.insert("assets", asset);
    const now = new Date().toISOString();
    const repair = { id: AWStore.nextId("repair", "RP"), assetId: asset.id, customerId: c.customerId, issue: c.problem, diagnosis: c.notes || "", partsUsed: [], laborCost: 0, partsCost: Number(c.estimatedCost) || 0, totalCost: Number(c.estimatedCost) || 0, priority: "Normal", status: "Received", technician: AWStore.data().settings.technician, createdAt: now, history: [{ status: "Received", at: now, note: `Converted from consultation ${id}` }] };
    AWStore.insert("repairs", repair);
    AWStore.update("consultations", id, { status: "Converted to Repair" });
    AWStore.activity(`Consultation ${id} converted to repair ${repair.id}.`);
    closeModal(); renderAdmin("consultations"); toast(`Created repair ticket ${repair.id}.`);
  }
  function slotConflict(dateTime, ignoreId) {
    const timestamp = new Date(dateTime).getTime();
    return AWStore.collection("appointments").some(a => a.id !== ignoreId && a.status !== "Cancelled" && new Date(a.dateTime).getTime() === timestamp);
  }
  function validateBooking(date, time, ignoreId) {
    if (!date || !time) throw new Error("Select an available appointment date and time.");
    const start = new Date(`${date}T${time}:00`);
    if (Number.isNaN(start.getTime()) || start <= new Date()) throw new Error("Appointments must be booked for a future date and time.");
    if (AWStore.data().settings.closedDays.includes(start.getDay())) throw new Error("The shop is closed on the selected day.");
    const s = AWStore.data().settings, minutes = start.getHours() * 60 + start.getMinutes();
    if (minutes < s.openHour * 60 || minutes + Number(s.slotMinutes) > s.closeHour * 60 || minutes % Number(s.slotMinutes) !== (s.openHour * 60) % Number(s.slotMinutes)) throw new Error("Choose a time within shop business hours.");
    if (slotConflict(start.toISOString(), ignoreId)) throw new Error("That time slot has just been booked. Please choose another.");
    return start;
  }
  function saveAppointment(form) {
    try {
      const v = formValues(form);
      if (!v.customerId) throw new Error("Select a customer.");
      const dateTime = validateBooking(v.date, v.time, form.dataset.id).toISOString();
      if (form.dataset.id) AWStore.update("appointments", form.dataset.id, { customerId: v.customerId, type: v.type, dateTime, duration: AWStore.data().settings.slotMinutes, notes: v.notes.trim() });
      else AWStore.insert("appointments", { id: AWStore.nextId("appointment", "AP"), customerId: v.customerId, type: v.type, dateTime, duration: AWStore.data().settings.slotMinutes, status: "Scheduled", notes: v.notes.trim(), createdAt: new Date().toISOString() });
      AWStore.activity(`Appointment ${form.dataset.id ? "rescheduled" : "booked"} for ${customerOf(v.customerId).name}.`);
      closeModal(); renderAdmin("schedule"); toast(form.dataset.id ? "Appointment rescheduled." : "Appointment booked.");
    } catch (error) { toast(error.message, "error"); }
  }
  function saveSettings(form) {
    try {
      const v = formValues(form), openHour = Number(v.openHour), closeHour = Number(v.closeHour), slotMinutes = Number(v.slotMinutes), lowStockThreshold = nonNegative(v.lowStockThreshold, "Low-stock threshold");
      if (!v.shopName.trim() || !Number.isInteger(openHour) || openHour < 0 || openHour > 23 || !Number.isInteger(closeHour) || closeHour < 1 || closeHour > 24 || closeHour <= openHour) throw new Error("Enter a shop name and valid opening/closing hours.");
      AWStore.save({ ...AWStore.data(), settings: { ...AWStore.data().settings, shopName: v.shopName.trim(), openHour, closeHour, slotMinutes, lowStockThreshold, technician: v.technician.trim() } });
      $("#shop-name-brand").textContent = v.shopName.trim();
      toast("Settings saved.");
    } catch (error) { toast(error.message, "error"); }
  }
  function createCustomerConsultation(form) {
    const v = formValues(form);
    if (!v.device.trim() || !v.problem.trim()) { toast("Enter your device and describe the problem.", "error"); return; }
    if (v.preferredDate && (Number.isNaN(new Date(`${v.preferredDate}T00:00:00`).getTime()) || v.preferredDate < new Date().toISOString().slice(0, 10))) { toast("Choose a valid date that is not in the past.", "error"); return; }
    const id = AWStore.nextId("consultation", "CN");
    AWStore.insert("consultations", { id, customerId: window.AWCurrentUser.id, device: v.device.trim(), problem: v.problem.trim(), preferredDate: v.preferredDate, status: "Pending", notes: "", estimatedCost: "", createdAt: new Date().toISOString() });
    AWStore.activity(`New consultation request from ${window.AWCurrentUser.name}.`);
    renderCustomer("consultation"); toast("Your consultation request has been sent.");
  }
  function createCustomerAppointment(form) {
    try {
      const v = formValues(form);
      const dateTime = validateBooking(v.date, v.time).toISOString();
      AWStore.insert("appointments", { id: AWStore.nextId("appointment", "AP"), customerId: window.AWCurrentUser.id, type: v.type, dateTime, duration: AWStore.data().settings.slotMinutes, status: "Scheduled", notes: [v.device, v.notes].filter(Boolean).join(" — "), createdAt: new Date().toISOString() });
      AWStore.activity(`Appointment booked by ${window.AWCurrentUser.name}.`);
      renderCustomer("appointments"); toast("Your appointment is booked.");
    } catch (error) { toast(error.message, "error"); }
  }
  function saveProfile(form) {
    const v = formValues(form);
    if (!v.name.trim() || !v.phone.trim()) { toast("Name and phone number are required.", "error"); return; }
    const updated = AWStore.update("users", window.AWCurrentUser.id, { name: v.name.trim(), phone: v.phone.trim() });
    const customer = AWStore.collection("customers").find(c => c.userId === updated.id || c.id === updated.id);
    if (customer) AWStore.update("customers", customer.id, { name: updated.name, phone: updated.phone });
    window.AWCurrentUser = updated;
    $("#customer-name").textContent = updated.name;
    $("#customer-greeting").textContent = updated.name.split(/\s+/)[0];
    $("#customer-avatar").textContent = updated.name.slice(0,1).toUpperCase();
    renderCustomer("profile"); toast("Profile updated.");
  }
  async function changePassword(form) {
    const v = formValues(form), error = $("#password-error");
    error.textContent = "";
    const user = AWStore.find("users", window.AWCurrentUser.id);
    if (!user || user.passwordHash !== await AWStore.digest(v.oldPassword)) { error.textContent = "Your current password is incorrect."; return; }
    if (v.newPassword.length < 8 || !/[A-Za-z]/.test(v.newPassword) || !/[0-9]/.test(v.newPassword)) { error.textContent = "Use at least 8 characters with a letter and a number."; return; }
    if (v.newPassword !== v.confirmPassword) { error.textContent = "The new passwords do not match."; return; }
    AWStore.update("users", user.id, { passwordHash: await AWStore.digest(v.newPassword) });
    form.reset(); toast("Password changed successfully.");
  }
  function customerDetail(id) {
    const c = AWStore.find("customers", id);
    if (!c) return;
    const userId = c.userId || c.id, devices = ownerDevices(userId), repairs = AWStore.collection("repairs").filter(r => r.customerId === userId);
    openModal(`Customer: ${c.name}`, `<p><strong>Email:</strong> ${esc(c.email)} &nbsp; <strong>Phone:</strong> ${esc(c.phone)}</p><h3>Devices (${devices.length})</h3>${devices.length ? `<ul>${devices.map(a => `<li>${esc(a.name)} · ${badge(a.status)}</li>`).join("")}</ul>` : `<p class="muted">No linked devices.</p>`}<h3>Repair history (${repairs.length})</h3>${repairs.length ? `<ul>${repairs.map(r => `<li>${esc(r.id)} · ${esc(r.issue)} · ${badge(r.status)}</li>`).join("")}</ul>` : `<p class="muted">No repair history.</p>`}`);
  }
  function rerenderCurrentAdmin() { renderAdmin(location.hash.slice(1) || "overview"); }
  function syncFromOtherPage(event) {
    if (event.key !== AWStore.dataKey || !event.newValue) return;
    let incomingConsultations = [];
    if (document.body.dataset.page === "dashboard" && event.oldValue) {
      try {
        const previousIds = new Set(JSON.parse(event.oldValue).consultations.map(item => item.id));
        incomingConsultations = JSON.parse(event.newValue).consultations.filter(item => !previousIds.has(item.id) && item.status === "Pending");
        incomingConsultations.forEach(item => pendingIncomingConsultationIds.add(item.id));
      } catch (error) {
        console.error("Unable to identify new consultation requests in the saved update.", error);
      }
    }
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      try {
        if (document.body.dataset.page === "customer") renderCustomer(currentCustomerSection);
        else if (document.body.dataset.page === "dashboard") {
          if (pendingIncomingConsultationIds.size) {
            const count = pendingIncomingConsultationIds.size;
            pendingIncomingConsultationIds.clear();
            renderAdmin("consultations");
            toast(`${count} new customer consultation request${count === 1 ? "" : "s"} received.`, "success");
          } else renderAdmin(currentAdminSection);
        }
      } catch (error) {
        console.error("Unable to refresh AssetWise after a change in another tab.", error);
        toast("A saved update could not be refreshed. Reload the page to try again.", "error");
      }
    }, 60);
  }
  function download(filename, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement("a");
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const CSV_FIELDS = ["id","name","category","brand","model","serial","ownerId","status","condition","dateReceived","notes","quantity","reorderLevel"];
  function csvCell(value) { const text = String(value == null ? "" : value); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
  function exportCSV() {
    const rows = [CSV_FIELDS, ...AWStore.collection("assets").map(a => CSV_FIELDS.map(k => a[k] == null ? "" : a[k]))];
    download("assetwise-inventory.csv", rows.map(row => row.map(csvCell).join(",")).join("\r\n"), "text/csv;charset=utf-8");
    toast("Inventory CSV exported.");
  }
  function parseCSV(text) {
    const rows = [], row = [];
    let value = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quoted && char === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (char === '"') quoted = !quoted;
      else if (!quoted && char === ",") { row.push(value); value = ""; }
      else if (!quoted && (char === "\n" || char === "\r")) {
        if (char === "\r" && text[i + 1] === "\n") i++;
        row.push(value); value = "";
        if (row.some(cell => cell.trim())) rows.push(row.splice(0));
        else row.length = 0;
      } else value += char;
    }
    if (quoted) throw new Error("CSV contains an unfinished quoted field.");
    if (value || row.length) { row.push(value); rows.push(row); }
    return rows;
  }
  async function importCSVFile(file) {
    try {
      const rows = parseCSV(await file.text());
      if (rows.length < 2) throw new Error("CSV must have a header row and at least one asset.");
      const headers = rows.shift().map(h => h.trim());
      if (!["name", "category"].every(h => headers.includes(h))) throw new Error("CSV must include name and category columns. Use Export CSV for a sample format.");
      let count = 0;
      rows.forEach(cells => {
        const v = Object.fromEntries(headers.map((h, i) => [h, cells[i] || ""]));
        if (!v.name.trim() || !AWStore.CATEGORIES.includes(v.category)) return;
        const existing = v.id && AWStore.find("assets", v.id);
        const quantity = Number(v.quantity || 0), reorderLevel = Number(v.reorderLevel || 0);
        if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(reorderLevel) || reorderLevel < 0) return;
        const asset = { id: existing ? v.id : (v.id || AWStore.nextId("asset", "AW")), name: v.name.trim(), category: v.category, brand: v.brand || "", model: v.model || "", serial: v.serial || "", ownerId: v.ownerId || "", status: AWStore.STATUSES.includes(v.status) ? v.status : "In Stock", condition: v.condition || "Good", dateReceived: v.dateReceived || new Date().toISOString().slice(0,10), notes: v.notes || "", quantity, reorderLevel };
        if (existing) AWStore.update("assets", asset.id, asset); else AWStore.insert("assets", asset);
        count++;
      });
      if (!count) throw new Error("No valid asset rows were found. Check category names and non-negative quantities.");
      AWStore.activity(`${count} asset record${count === 1 ? "" : "s"} imported from CSV.`);
      rerenderCurrentAdmin(); toast(`${count} asset record${count === 1 ? "" : "s"} imported.`);
    } catch (error) { toast(error.message, "error"); }
    $("#csv-file").value = "";
  }
  async function restoreJSONFile(file) {
    try {
      AWStore.importData(await file.text());
      $("#shop-name-brand").textContent = AWStore.data().settings.shopName;
      rerenderCurrentAdmin(); toast("AssetWise backup restored.");
    } catch (error) { toast(error.message, "error"); }
    $("#json-file").value = "";
  }
  async function resetData() {
    if (!confirm("Reset all AssetWise data to the original sample dataset? This cannot be undone.")) return;
    try {
      AWStore.reset();
      await AWStore.initialize();
      $("#shop-name-brand").textContent = AWStore.data().settings.shopName;
      renderAdmin("overview"); toast("Sample data restored.");
    } catch (error) { toast(error.message, "error"); }
  }
  function printRepair(id) {
    const r = AWStore.find("repairs", id);
    if (!r) return;
    const asset = AWStore.find("assets", r.assetId), customer = customerOf(r.customerId);
    let receipt = $("#print-receipt");
    if (!receipt) { receipt = document.createElement("section"); receipt.id = "print-receipt"; receipt.className = "receipt"; document.body.append(receipt); }
    receipt.innerHTML = `<div class="card card-pad"><h1>${esc(AWStore.data().settings.shopName)}</h1><h2>Repair service slip · ${esc(r.id)}</h2><p>Received: ${fmtDate(r.createdAt)} · Status: ${esc(r.status)}</p><hr><h3>Customer</h3><p>${esc(customer.name)}<br>${esc(customer.email)}<br>${esc(customer.phone)}</p><h3>Device</h3><p>${esc(asset ? asset.name : "Device removed")} · ${esc(asset ? asset.brand : "")} ${esc(asset ? asset.model : "")}<br>Serial: ${esc(asset ? asset.serial : "—")}</p><h3>Service details</h3><p><strong>Reported issue:</strong> ${esc(r.issue)}</p><p><strong>Diagnosis:</strong> ${esc(r.diagnosis || "Pending")}</p><p><strong>Technician:</strong> ${esc(r.technician)}</p><table><tbody><tr><td>Labor</td><td>${money(r.laborCost)}</td></tr><tr><td>Parts</td><td>${money(r.partsCost)}</td></tr><tr><th>Total estimate</th><th>${money(r.totalCost)}</th></tr></tbody></table><p class="small">Thank you for choosing ${esc(AWStore.data().settings.shopName)}.</p></div>`;
    closeModal(); window.print();
  }
  document.addEventListener("assetwise:ready", init, { once: true });
  document.addEventListener("input", handleInput);
  window.addEventListener("storage", syncFromOtherPage);
})();
