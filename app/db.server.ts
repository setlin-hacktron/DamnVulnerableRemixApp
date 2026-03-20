import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const RECEIPTS_DIR = path.join(DATA_DIR, "receipts");
if (!fs.existsSync(RECEIPTS_DIR)) {
  fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, "expenseflow.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    department TEXT DEFAULT 'General',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    receipt_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_by INTEGER,
    approved_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS reimbursements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_id INTEGER UNIQUE NOT NULL,
    amount REAL NOT NULL,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (expense_id) REFERENCES expenses(id)
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    token TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const userCount = (db.prepare("SELECT COUNT(*) as count FROM users").get() as any).count;
if (userCount === 0) {
  const pw = (p: string) => bcrypt.hashSync(p, 10);

  const insertUser = db.prepare(
    "INSERT INTO users (email, password_hash, name, role, department) VALUES (?, ?, ?, ?, ?)"
  );
  // id 1
  insertUser.run("admin@expenseflow.io", pw("admin123"), "Admin User", "admin", "IT");
  // id 2
  insertUser.run("sarah@expenseflow.io", pw("manager123"), "Sarah Chen", "manager", "Finance");
  // id 3
  insertUser.run("john@expenseflow.io", pw("password123"), "John Smith", "employee", "Engineering");
  // id 4
  insertUser.run("jane@expenseflow.io", pw("jane2024"), "Jane Doe", "employee", "Marketing");
  // id 5
  insertUser.run("mike@expenseflow.io", pw("mike2024"), "Mike Rivera", "employee", "Engineering");
  // id 6
  insertUser.run("priya@expenseflow.io", pw("priya2024"), "Priya Patel", "employee", "Sales");
  // id 7
  insertUser.run("tom@expenseflow.io", pw("tom2024"), "Tom Nguyen", "manager", "Engineering");
  // id 8
  insertUser.run("lisa@expenseflow.io", pw("lisa2024"), "Lisa Yamamoto", "employee", "Design");
  // id 9
  insertUser.run("carlos@expenseflow.io", pw("carlos2024"), "Carlos Mendez", "employee", "Sales");
  // id 10
  insertUser.run("rachel@expenseflow.io", pw("rachel2024"), "Rachel Kim", "employee", "Finance");

  const insertExpense = db.prepare(
    "INSERT INTO expenses (user_id, title, description, amount, category, status, receipt_path, created_at, approved_by, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );

  // --- John Smith (Engineering) ---
  insertExpense.run(3, "Flight to NYC", "Round-trip flight to New York for Q3 client meeting with Acme Corp", 450.00, "Travel", "approved", "flight_receipt_3847.pdf", "2026-01-12 09:15:00", 7, "2026-01-13 11:30:00"); // 1
  insertExpense.run(3, "Hotel — Marriott Downtown", "2 nights stay during NYC client visit (Jan 14-16)", 320.00, "Travel", "approved", "hotel_receipt_3848.pdf", "2026-01-16 14:22:00", 7, "2026-01-17 09:00:00"); // 2
  insertExpense.run(3, "Team Lunch", "Team building lunch at Osteria for engineering offsite", 85.50, "Meals", "pending", null, "2026-03-10 12:45:00", null, null); // 3
  insertExpense.run(3, "Taxi to Airport", "Uber from office to JFK terminal 4", 62.30, "Travel", "approved", null, "2026-01-12 06:30:00", 7, "2026-01-13 11:30:00"); // 4
  insertExpense.run(3, "AWS Certification Exam", "AWS Solutions Architect Professional exam fee", 300.00, "Training", "approved", "aws_cert_invoice.pdf", "2026-02-05 10:00:00", 7, "2026-02-06 08:45:00"); // 5
  insertExpense.run(3, "Monitor Stand", "Ergonomic monitor arm for standing desk", 89.99, "Equipment", "approved", "amazon_order_9981.pdf", "2026-02-20 16:30:00", 7, "2026-02-21 09:15:00"); // 6
  insertExpense.run(3, "Coffee with Client", "Coffee meeting with Acme Corp PM to discuss integration timeline", 24.50, "Meals", "approved", null, "2026-03-05 15:00:00", 7, "2026-03-06 10:00:00"); // 7
  insertExpense.run(3, "USB-C Hub", "Anker 7-in-1 USB-C hub for dev machine", 54.99, "Equipment", "pending", "anker_receipt.pdf", "2026-03-18 11:20:00", null, null); // 8

  // --- Jane Doe (Marketing) ---
  insertExpense.run(4, "Office Supplies", "Ergonomic keyboard and monitor stand for home office", 175.00, "Equipment", "rejected", null, "2026-01-20 09:30:00", 2, "2026-01-22 14:00:00"); // 9
  insertExpense.run(4, "Client Dinner", "Dinner with Globex stakeholders at Nobu — discussing Q4 campaign", 210.00, "Meals", "approved", "nobu_receipt.pdf", "2026-02-14 21:30:00", 2, "2026-02-16 09:00:00"); // 10
  insertExpense.run(4, "Facebook Ads — Feb Campaign", "Paid social campaign for product launch", 1250.00, "Marketing", "approved", "meta_invoice_feb.pdf", "2026-02-28 17:00:00", 2, "2026-03-01 10:30:00"); // 11
  insertExpense.run(4, "Canva Pro Subscription", "Annual Canva Pro license for design work", 119.99, "Software", "approved", "canva_invoice.pdf", "2026-01-05 08:00:00", 2, "2026-01-06 11:00:00"); // 12
  insertExpense.run(4, "Trade Show Booth Materials", "Banner, tablecloth, and brochures for SaaStr booth", 890.00, "Marketing", "pending", "printshop_invoice.pdf", "2026-03-15 13:45:00", null, null); // 13
  insertExpense.run(4, "Flight to SF", "Round-trip SFO for SaaStr Annual conference", 385.00, "Travel", "pending", "united_booking.pdf", "2026-03-14 10:00:00", null, null); // 14
  insertExpense.run(4, "Uber to Venue", "Uber from hotel to Moscone Center", 28.50, "Travel", "pending", null, "2026-03-19 08:15:00", null, null); // 15

  // --- Sarah Chen (Finance, Manager) ---
  insertExpense.run(2, "Conference Ticket", "DevOps Days 2026 — early bird registration", 299.00, "Training", "approved", "devopsdays_invoice.pdf", "2026-01-08 10:00:00", 1, "2026-01-09 09:00:00"); // 16
  insertExpense.run(2, "QuickBooks Subscription", "Annual QuickBooks Online Plus renewal", 540.00, "Software", "approved", "qb_invoice.pdf", "2026-02-01 09:00:00", 1, "2026-02-02 10:00:00"); // 17
  insertExpense.run(2, "Lunch with Auditors", "Working lunch with external audit team at Blue Fin", 145.00, "Meals", "approved", "bluefin_receipt.pdf", "2026-03-03 13:00:00", 1, "2026-03-04 08:30:00"); // 18
  insertExpense.run(2, "Taxi to Client Office", "Lyft to Deloitte office for quarterly review", 35.00, "Travel", "approved", null, "2026-03-07 08:45:00", 1, "2026-03-08 09:00:00"); // 19

  // --- Mike Rivera (Engineering) ---
  insertExpense.run(5, "Mechanical Keyboard", "Keychron Q1 Pro for office use", 199.00, "Equipment", "approved", "keychron_order.pdf", "2026-01-15 14:00:00", 7, "2026-01-16 10:30:00"); // 20
  insertExpense.run(5, "Flight to Austin", "Round-trip to Austin for team hackathon", 320.00, "Travel", "approved", "sw_airlines_conf.pdf", "2026-02-10 09:00:00", 7, "2026-02-11 08:00:00"); // 21
  insertExpense.run(5, "Hotel — Austin Hilton", "3 nights for hackathon (Feb 18-21)", 475.00, "Travel", "approved", "hilton_folio.pdf", "2026-02-21 12:00:00", 7, "2026-02-22 09:00:00"); // 22
  insertExpense.run(5, "Team Dinner — Austin", "Hackathon team dinner at Franklin BBQ", 156.80, "Meals", "approved", "franklin_receipt.jpg", "2026-02-19 20:30:00", 7, "2026-02-22 09:00:00"); // 23
  insertExpense.run(5, "GitHub Copilot", "Annual GitHub Copilot Business license", 228.00, "Software", "pending", "github_invoice.pdf", "2026-03-12 11:00:00", null, null); // 24
  insertExpense.run(5, "Udemy Course Bundle", "Advanced Kubernetes + Go microservices courses", 49.99, "Training", "pending", null, "2026-03-17 16:00:00", null, null); // 25
  insertExpense.run(5, "Parking — Office Garage", "Monthly parking pass for March", 180.00, "Travel", "rejected", "parking_receipt.pdf", "2026-03-01 08:00:00", 7, "2026-03-02 09:30:00"); // 26

  // --- Priya Patel (Sales) ---
  insertExpense.run(6, "Client Lunch — Stripe", "Lunch with Stripe BD team at Tartine", 92.00, "Meals", "approved", "tartine_receipt.pdf", "2026-01-22 13:00:00", 2, "2026-01-23 09:00:00"); // 27
  insertExpense.run(6, "Flight to Chicago", "Round-trip for Midwest sales territory visit", 280.00, "Travel", "approved", "aa_booking.pdf", "2026-02-03 07:30:00", 2, "2026-02-04 10:00:00"); // 28
  insertExpense.run(6, "Hotel — Chicago Palmer House", "2 nights for client meetings (Feb 10-12)", 410.00, "Travel", "approved", "palmer_folio.pdf", "2026-02-12 14:00:00", 2, "2026-02-13 09:30:00"); // 29
  insertExpense.run(6, "Uber — Chicago Meetings", "Multiple rides between client offices over 2 days", 67.40, "Travel", "approved", null, "2026-02-12 18:00:00", 2, "2026-02-13 09:30:00"); // 30
  insertExpense.run(6, "Salesforce License Add-on", "Additional Salesforce seat for new SDR", 150.00, "Software", "approved", "sf_invoice.pdf", "2026-02-25 10:00:00", 2, "2026-02-26 08:00:00"); // 31
  insertExpense.run(6, "Client Gift Basket", "Thank-you gift for Acme Corp after contract renewal", 125.00, "Other", "pending", "giftbasket_receipt.pdf", "2026-03-10 15:30:00", null, null); // 32
  insertExpense.run(6, "Dinner — Enterprise Prospect", "Dinner with CTO of Initech at Nobu Malibu", 340.00, "Meals", "pending", "nobu_malibu.pdf", "2026-03-18 21:00:00", null, null); // 33

  // --- Tom Nguyen (Engineering Manager) ---
  insertExpense.run(7, "Team Offsite Venue", "Conference room rental at WeWork for Q1 planning", 350.00, "Other", "approved", "wework_invoice.pdf", "2026-01-10 09:00:00", 1, "2026-01-11 10:00:00"); // 34
  insertExpense.run(7, "Pizza for Sprint Retro", "10 pizzas for end-of-sprint retro (team of 12)", 132.00, "Meals", "approved", null, "2026-02-14 18:30:00", 1, "2026-02-15 09:00:00"); // 35
  insertExpense.run(7, "Engineering Books", "Staff Engineer book + Designing Data-Intensive Apps (team library)", 78.00, "Training", "approved", "amazon_books.pdf", "2026-02-28 14:00:00", 1, "2026-03-01 09:00:00"); // 36
  insertExpense.run(7, "Flight to Seattle", "Round-trip for AWS re:Invent partner meeting", 410.00, "Travel", "pending", "delta_booking.pdf", "2026-03-16 08:00:00", null, null); // 37

  // --- Lisa Yamamoto (Design) ---
  insertExpense.run(8, "Figma Enterprise", "Annual Figma Enterprise license renewal", 720.00, "Software", "approved", "figma_invoice.pdf", "2026-01-03 09:00:00", 2, "2026-01-04 11:00:00"); // 38
  insertExpense.run(8, "Wacom Tablet", "Wacom Intuos Pro for illustration work", 349.99, "Equipment", "approved", "wacom_order.pdf", "2026-01-25 15:00:00", 2, "2026-01-27 09:00:00"); // 39
  insertExpense.run(8, "Design Conference Ticket", "Config 2026 early bird ticket", 450.00, "Training", "approved", "config_ticket.pdf", "2026-02-08 10:00:00", 2, "2026-02-09 09:00:00"); // 40
  insertExpense.run(8, "Art Supplies", "Markers and sketchbooks for user research sessions", 62.50, "Equipment", "approved", null, "2026-02-20 11:30:00", 2, "2026-02-21 10:00:00"); // 41
  insertExpense.run(8, "Stock Photos", "Shutterstock annual plan for marketing assets", 199.00, "Software", "pending", "shutterstock_inv.pdf", "2026-03-13 09:00:00", null, null); // 42
  insertExpense.run(8, "Lunch with UX Researcher", "Working lunch to review usability test findings", 38.00, "Meals", "pending", null, "2026-03-19 12:30:00", null, null); // 43

  // --- Carlos Mendez (Sales) ---
  insertExpense.run(9, "CRM Training Course", "HubSpot advanced certification course", 199.00, "Training", "approved", "hubspot_cert.pdf", "2026-01-18 10:00:00", 2, "2026-01-20 09:00:00"); // 44
  insertExpense.run(9, "Flight to Denver", "Round-trip for Rocky Mountain sales summit", 275.00, "Travel", "approved", "frontier_booking.pdf", "2026-02-15 07:00:00", 2, "2026-02-16 10:00:00"); // 45
  insertExpense.run(9, "Client Lunch — Initech", "Lunch with VP of Ops at Initech — renewal discussion", 88.00, "Meals", "approved", "steakhouse_receipt.pdf", "2026-03-04 12:30:00", 2, "2026-03-05 09:00:00"); // 46
  insertExpense.run(9, "Uber to Airport", "Ride to DEN airport", 42.00, "Travel", "approved", null, "2026-02-17 05:30:00", 2, "2026-02-18 09:00:00"); // 47
  insertExpense.run(9, "Phone Case & Screen Protector", "Replacement case for work phone after drop", 45.00, "Equipment", "rejected", null, "2026-03-08 16:00:00", 2, "2026-03-09 14:00:00"); // 48
  insertExpense.run(9, "Client Dinner — Globex", "Dinner with Globex SVP discussing expansion deal", 275.00, "Meals", "pending", "globex_dinner.pdf", "2026-03-17 20:00:00", null, null); // 49

  // --- Rachel Kim (Finance) ---
  insertExpense.run(10, "Excel Advanced Course", "LinkedIn Learning Excel for Finance Professionals", 29.99, "Training", "approved", null, "2026-01-28 09:00:00", 2, "2026-01-29 10:00:00"); // 50
  insertExpense.run(10, "Office Chair", "Herman Miller Aeron for home office (ergonomic request)", 1395.00, "Equipment", "approved", "hm_order.pdf", "2026-02-05 11:00:00", 2, "2026-02-07 09:00:00"); // 51
  insertExpense.run(10, "Parking — Client Visit", "Parking at Deloitte tower for joint audit session", 22.00, "Travel", "approved", "parking_stub.pdf", "2026-03-03 08:00:00", 2, "2026-03-04 08:30:00"); // 52
  insertExpense.run(10, "Tax Software License", "TurboTax Business license for filing prep", 189.00, "Software", "pending", "turbotax_inv.pdf", "2026-03-15 10:00:00", null, null); // 53

  // --- Reimbursements for all approved expenses ---
  const insertReimb = db.prepare(
    "INSERT INTO reimbursements (expense_id, amount, processed_at) VALUES (?, ?, ?)"
  );
  insertReimb.run(1, 450.00, "2026-01-20 10:00:00");
  insertReimb.run(2, 320.00, "2026-01-20 10:00:00");
  insertReimb.run(4, 62.30, "2026-01-20 10:00:00");
  insertReimb.run(5, 300.00, "2026-02-10 10:00:00");
  insertReimb.run(6, 89.99, "2026-02-25 10:00:00");
  insertReimb.run(7, 24.50, "2026-03-10 10:00:00");
  insertReimb.run(10, 210.00, "2026-02-20 10:00:00");
  insertReimb.run(11, 1250.00, "2026-03-05 10:00:00");
  insertReimb.run(12, 119.99, "2026-01-10 10:00:00");
  insertReimb.run(16, 299.00, "2026-01-15 10:00:00");
  insertReimb.run(17, 540.00, "2026-02-05 10:00:00");
  insertReimb.run(18, 145.00, "2026-03-08 10:00:00");
  insertReimb.run(19, 35.00, "2026-03-10 10:00:00");
  insertReimb.run(20, 199.00, "2026-01-20 10:00:00");
  insertReimb.run(21, 320.00, "2026-02-15 10:00:00");
  insertReimb.run(22, 475.00, "2026-02-25 10:00:00");
  insertReimb.run(23, 156.80, "2026-02-25 10:00:00");
  insertReimb.run(27, 92.00, "2026-01-28 10:00:00");
  insertReimb.run(28, 280.00, "2026-02-08 10:00:00");
  insertReimb.run(29, 410.00, "2026-02-18 10:00:00");
  insertReimb.run(30, 67.40, "2026-02-18 10:00:00");
  insertReimb.run(31, 150.00, "2026-03-01 10:00:00");
  insertReimb.run(34, 350.00, "2026-01-15 10:00:00");
  insertReimb.run(35, 132.00, "2026-02-20 10:00:00");
  insertReimb.run(36, 78.00, "2026-03-05 10:00:00");
  insertReimb.run(38, 720.00, "2026-01-08 10:00:00");
  insertReimb.run(39, 349.99, "2026-01-30 10:00:00");
  insertReimb.run(40, 450.00, "2026-02-12 10:00:00");
  insertReimb.run(41, 62.50, "2026-02-25 10:00:00");
  insertReimb.run(44, 199.00, "2026-01-25 10:00:00");
  insertReimb.run(45, 275.00, "2026-02-20 10:00:00");
  insertReimb.run(46, 88.00, "2026-03-08 10:00:00");
  insertReimb.run(47, 42.00, "2026-02-22 10:00:00");
  insertReimb.run(50, 29.99, "2026-02-02 10:00:00");
  insertReimb.run(51, 1395.00, "2026-02-12 10:00:00");
  insertReimb.run(52, 22.00, "2026-03-08 10:00:00");
}

export default db;
