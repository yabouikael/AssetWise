(function () {
  "use strict";
  const KEY = "assetwise_data_v1";
  const CATEGORIES = ["Laptop", "Desktop", "Phone", "Printer", "Peripheral", "Part/Component", "Other"];
  const STATUSES = ["In Stock", "In Repair", "Ready for Pickup", "Released", "Retired"];

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error("Unable to read AssetWise browser data.", error);
      throw new Error("Saved data could not be read. Check browser storage settings.");
    }
  }
  function write(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Unable to save AssetWise browser data.", error);
      throw new Error("Data could not be saved. Browser storage may be full or unavailable.");
    }
  }
  function dateOffset(days, hour) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour || 10, 0, 0, 0);
    return d.toISOString();
  }
  async function digest(value) {
    if (!window.crypto || !window.crypto.subtle) throw new Error("Secure password hashing is not available in this browser. Open AssetWise in a modern browser or from localhost.");
    const bytes = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
  }
  async function initialize() {
    let data = read();
    if (data) return data;
    const adminHash = await digest("Admin@123");
    const customerHash = await digest("Customer@123");
    const users = [
      { id: "USR-0001", name: "Admin", email: "admin@assetwise.com", phone: "555-0100", role: "admin", passwordHash: adminHash, createdAt: dateOffset(-90) },
      { id: "USR-0002", name: "Jordan Lee", email: "jordan.lee@example.com", phone: "555-0141", role: "customer", passwordHash: customerHash, createdAt: dateOffset(-60) },
      { id: "USR-0003", name: "Taylor Brooks", email: "taylor.brooks@example.com", phone: "555-0182", role: "customer", passwordHash: customerHash, createdAt: dateOffset(-45) },
      { id: "USR-0004", name: "Sam Rivera", email: "sam.rivera@example.com", phone: "555-0117", role: "customer", passwordHash: customerHash, createdAt: dateOffset(-20) }
    ];
    const customers = users.slice(1).map(u => ({ id: u.id, userId: u.id, name: u.name, email: u.email, phone: u.phone, createdAt: u.createdAt }));
    const assets = [
      ["Laptop", "ThinkPad T14", "Lenovo", "Gen 3", "LT-88210", users[1].id, "In Repair", "Good", 0, 0],
      ["Laptop", "MacBook Pro 14", "Apple", "M2 Pro", "AP-23001", users[2].id, "Ready for Pickup", "Good", 0, 0],
      ["Desktop", "OptiPlex 7090", "Dell", "7090 SFF", "DL-99402", users[3].id, "In Stock", "Excellent", 0, 0],
      ["Phone", "Galaxy S22", "Samsung", "SM-S901U", "SM-11304", users[1].id, "Released", "Good", 0, 0],
      ["Printer", "LaserJet Pro M404", "HP", "M404dn", "HP-55412", users[2].id, "In Stock", "Fair", 0, 0],
      ["Peripheral", "MX Master 3S", "Logitech", "910-006556", "LG-88001", users[3].id, "In Stock", "New", 0, 0],
      ["Laptop", "XPS 13", "Dell", "9315", "DL-55072", users[1].id, "In Repair", "Fair", 0, 0],
      ["Part/Component", "USB-C charging port", "Generic", "USB-C 16-pin", "PC-1001", "", "In Stock", "New", 2, 5],
      ["Part/Component", "NVMe SSD 1TB", "Samsung", "970 EVO Plus", "PC-1002", "", "In Stock", "New", 12, 4],
      ["Part/Component", "DDR4 SODIMM 16GB", "Crucial", "CT16G4SFRA32A", "PC-1003", "", "In Stock", "New", 8, 3],
      ["Part/Component", "Laptop fan assembly", "Generic", "5V 4-pin", "PC-1004", "", "In Stock", "New", 1, 3],
      ["Part/Component", "Thermal paste", "Arctic", "MX-6 4g", "PC-1005", "", "In Stock", "New", 7, 2],
      ["Other", "Bench power supply", "UNI-T", "UTP1306", "EQ-7702", "", "In Stock", "Good", 0, 0],
      ["Desktop", "Custom workstation", "Custom", "Creator Z7", "CS-19902", users[3].id, "Retired", "Poor", 0, 0],
      ["Part/Component", "65W USB-C adapter", "Lenovo", "ADLX65", "PC-1006", "", "In Stock", "New", 3, 4]
    ].map((a, i) => ({
      id: `AW-${String(i + 1).padStart(4, "0")}`, name: a[1], category: a[0], brand: a[2], model: a[3],
      serial: a[4], ownerId: a[5], status: a[6], condition: a[7], dateReceived: dateOffset(-i * 3),
      notes: "", quantity: a[8], reorderLevel: a[9]
    }));
    const repairs = [
      { id: "RP-0001", assetId: assets[0].id, customerId: users[1].id, issue: "Intermittent charging; battery not detected.", diagnosis: "USB-C port has a damaged center pin.", partsUsed: [{ assetId: assets[7].id, quantity: 1, cost: 24 }], laborCost: 65, partsCost: 24, totalCost: 89, priority: "High", status: "In Progress", technician: "Alex Morgan", createdAt: dateOffset(-2), history: [{ status: "Received", at: dateOffset(-2), note: "Device checked in" }, { status: "Diagnosing", at: dateOffset(-1), note: "Inspection started" }, { status: "In Progress", at: dateOffset(0), note: "Repair underway" }] },
      { id: "RP-0002", assetId: assets[1].id, customerId: users[2].id, issue: "Fan noise and overheating.", diagnosis: "Dust buildup; thermal service completed.", partsUsed: [], laborCost: 80, partsCost: 0, totalCost: 80, priority: "Normal", status: "Completed", technician: "Alex Morgan", createdAt: dateOffset(-5), history: [{ status: "Received", at: dateOffset(-5), note: "Device checked in" }, { status: "Completed", at: dateOffset(-1), note: "Quality check passed" }] },
      { id: "RP-0003", assetId: assets[6].id, customerId: users[1].id, issue: "Screen flickers when lid moves.", diagnosis: "Waiting on display cable.", partsUsed: [], laborCost: 95, partsCost: 0, totalCost: 95, priority: "Normal", status: "Waiting for Parts", technician: "Alex Morgan", createdAt: dateOffset(-4), history: [{ status: "Received", at: dateOffset(-4), note: "Device checked in" }, { status: "Waiting for Parts", at: dateOffset(-2), note: "Display cable ordered" }] },
      { id: "RP-0004", assetId: assets[3].id, customerId: users[1].id, issue: "Battery drains quickly.", diagnosis: "Battery replaced and tested.", partsUsed: [], laborCost: 40, partsCost: 55, totalCost: 95, priority: "Low", status: "Released", technician: "Alex Morgan", createdAt: dateOffset(-35), history: [{ status: "Received", at: dateOffset(-35), note: "Device checked in" }, { status: "Completed", at: dateOffset(-32), note: "Repair complete" }, { status: "Released", at: dateOffset(-30), note: "Collected by customer" }] },
      { id: "RP-0005", assetId: assets[4].id, customerId: users[2].id, issue: "Paper jams on every second page.", diagnosis: "Pickup roller worn.", partsUsed: [], laborCost: 35, partsCost: 18, totalCost: 53, priority: "Low", status: "Diagnosing", technician: "Alex Morgan", createdAt: dateOffset(-1), history: [{ status: "Received", at: dateOffset(-1), note: "Device checked in" }, { status: "Diagnosing", at: dateOffset(0), note: "Testing feed mechanism" }] }
    ];
    const consultations = [
      { id: "CN-0001", customerId: users[1].id, device: "ThinkPad X1 Carbon", problem: "It will not power on after a spill.", preferredDate: dateOffset(2).slice(0, 10), status: "Pending", notes: "", estimatedCost: "", createdAt: dateOffset(-1) },
      { id: "CN-0002", customerId: users[2].id, device: "iPhone 13", problem: "Cracked rear glass; looking for repair options.", preferredDate: dateOffset(3).slice(0, 10), status: "Reviewed", notes: "We can inspect and provide a firm quote.", estimatedCost: 120, createdAt: dateOffset(-2) },
      { id: "CN-0003", customerId: users[3].id, device: "Custom gaming PC", problem: "Unexpected shutdown under load.", preferredDate: dateOffset(5).slice(0, 10), status: "Quoted", notes: "Diagnostic service is $45, waived if repaired.", estimatedCost: 45, createdAt: dateOffset(-3) },
      { id: "CN-0004", customerId: users[1].id, device: "Samsung tablet", problem: "USB port feels loose.", preferredDate: dateOffset(1).slice(0, 10), status: "Pending", notes: "", estimatedCost: "", createdAt: dateOffset(0) }
    ];
    const appointments = Array.from({ length: 6 }, (_, i) => {
      const day = i < 3 ? i + 1 : -i + 1;
      return {
        id: `AP-${String(i + 1).padStart(4, "0")}`, customerId: users[(i % 3) + 1].id,
        type: ["drop-off", "consultation", "pickup"][i % 3],
        dateTime: dateOffset(day, 9 + (i % 5)), duration: 30, status: i === 5 ? "Completed" : "Scheduled",
        notes: ["Device drop-off", "Initial consultation", "Repair pickup"][i % 3], createdAt: dateOffset(-5)
      };
    });
    data = {
      version: 1, users, customers, assets, repairs, consultations, appointments,
      activities: [
        { id: "AC-1", text: "MacBook Pro repair marked ready for pickup.", at: dateOffset(-1) },
        { id: "AC-2", text: "New consultation received from Jordan Lee.", at: dateOffset(0) },
        { id: "AC-3", text: "USB-C charging port inventory is below reorder level.", at: dateOffset(0) }
      ],
      settings: { shopName: "AssetWise Repair Studio", openHour: 9, closeHour: 18, slotMinutes: 30, closedDays: [0], lowStockThreshold: 3, technician: "Alex Morgan" },
      counters: { asset: 15, repair: 5, consultation: 4, appointment: 6, user: 4 }
    };
    write(data);
    return data;
  }
  function data() {
    const value = read();
    if (!value) throw new Error("AssetWise is not initialized. Reload the page to initialize browser storage.");
    return value;
  }
  function save(value) { write(value); return value; }
  function nextId(type, prefix) {
    const d = data();
    d.counters[type] = (d.counters[type] || 0) + 1;
    let id = `${prefix}-${String(d.counters[type]).padStart(4, "0")}`;
    const collections = ["users", "assets", "repairs", "consultations", "appointments"];
    while (collections.some(name => Array.isArray(d[name]) && d[name].some(item => item.id === id))) {
      d.counters[type]++;
      id = `${prefix}-${String(d.counters[type]).padStart(4, "0")}`;
    }
    save(d);
    return id;
  }
  function collection(name) { return data()[name] || []; }
  function find(name, id) { return collection(name).find(item => item.id === id) || null; }
  function insert(name, item) {
    const d = data();
    if (!Array.isArray(d[name])) throw new Error(`Unknown data collection: ${name}`);
    d[name].unshift(item);
    save(d);
    return item;
  }
  function update(name, id, changes) {
    const d = data();
    const index = d[name].findIndex(item => item.id === id);
    if (index < 0) throw new Error("The requested record no longer exists.");
    d[name][index] = { ...d[name][index], ...changes };
    save(d);
    return d[name][index];
  }
  function remove(name, id) {
    const d = data();
    const before = d[name].length;
    d[name] = d[name].filter(item => item.id !== id);
    if (before === d[name].length) return false;
    save(d);
    return true;
  }
  function activity(text) {
    const d = data();
    d.activities.unshift({ id: `AC-${Date.now()}`, text, at: new Date().toISOString() });
    d.activities = d.activities.slice(0, 40);
    save(d);
  }
  function exportData() { return JSON.stringify(data(), null, 2); }
  function importData(raw) {
    let parsed;
    try { parsed = JSON.parse(raw); } catch (_) { throw new Error("This file is not valid JSON."); }
    const required = ["users", "customers", "assets", "repairs", "consultations", "appointments", "settings", "counters"];
    if (!parsed || required.some(key => !parsed[key]) || !Array.isArray(parsed.users) || !parsed.users.some(u => u.role === "admin")) {
      throw new Error("The backup file does not contain a valid AssetWise dataset.");
    }
    save(parsed);
    return parsed;
  }
  function reset() { localStorage.removeItem(KEY); }
  window.AWStore = { dataKey: KEY, initialize, data, save, nextId, collection, find, insert, update, remove, activity, exportData, importData, reset, digest, CATEGORIES, STATUSES };
})();
