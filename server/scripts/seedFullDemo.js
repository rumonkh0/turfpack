import dotenv from "dotenv";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../db/prismaClient.js";

dotenv.config();

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(d, days) {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

const cashAccount = (method) => {
  const map = {
    bkash: "1001",
    nagad: "1002",
    rocket: "1003",
    cash: "1004",
    card: "1005",
  };
  return map[method] || "1006";
};

const CUSTOMER_NAMES = [
  "Sabbir Hossain", "Tanvir Ahmed", "Mahmudul Hasan", "Rakibul Islam",
  "Shahadat Hossain", "Imran Nazir", "Ashiqur Rahman", "Mehedi Hasan",
  "Zubair Al Mamun", "Farhan Kabir", "Nayeem Chowdhury", "Saifullah Mansur",
  "Rashedul Karim", "Kazi Anisur Rahman", "Shakil Ahmed", "Tariqul Islam",
  "Mushfiqur Rahim", "Fahim Shahriar", "Nahid Parvez", "Samiul Haque",
  "Ariful Haque", "Enamul Haque", "Mustafizur Rahman", "Golam Kibria",
  "Shoriful Islam", "Towhid Hridoy", "Afif Hossain", "Litton Das",
  "Nasum Ahmed", "Ebadot Hossain", "Nurul Hasan", "Zakir Hasan",
  "Nazmul Hossain", "Soumya Sarkar", "Taijul Islam", "Mahedi Hasan",
  "Shamim Hossain", "Tanzid Hasan", "Rishad Hossain", "Tanzim Sakib",
  "Corporate: Grameenphone FC", "Corporate: Robi XI", "Corporate: BRAC Bank Strikerz",
  "Corporate: Pathao United", "Corporate: bKash Blasters", "Corporate: Chaldal FC",
  "Club: Gulshan Gladiators", "Club: Banani Ballers", "Club: Dhaka Dynamos"
];

async function seedFullDemo() {
  const today = new Date();
  const todayStr = formatDate(today);
  const startDate = addDays(today, -180); // 6 months of continuous history
  const upcomingEndDate = addDays(today, 10); // 10 days of upcoming slots

  console.log(`🚀 Starting optimized 6-month demo seeding relative to TODAY (${todayStr})...`);
  console.log(`Connecting to: ${process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ":***@") : "default"}`);

  await prisma.$connect();
  console.log("Connected to database. Cleaning old records...");

  // 1. Clean old records in proper dependency order
  await prisma.journalLine.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.profitShareChangeLog.deleteMany();
  await prisma.profitShareRatio.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.income.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.turf.deleteMany();
  await prisma.account.deleteMany();
  await prisma.appSetting.deleteMany();
  await prisma.user.deleteMany();

  console.log("Cleaned old tables. Creating Chart of Accounts...");

  // 2. Chart of Accounts
  const defaultAccounts = [
    { code: "1001", name: "Cash - bKash", type: "asset", normal_side: "debit", description: "Mobile banking - bKash" },
    { code: "1002", name: "Cash - Nagad", type: "asset", normal_side: "debit", description: "Mobile banking - Nagad" },
    { code: "1003", name: "Cash - Rocket", type: "asset", normal_side: "debit", description: "Mobile banking - Rocket" },
    { code: "1004", name: "Cash - Physical", type: "asset", normal_side: "debit", description: "Physical cash on hand" },
    { code: "1005", name: "Cash - Card", type: "asset", normal_side: "debit", description: "Card terminal receipts" },
    { code: "1006", name: "Cash - Other", type: "asset", normal_side: "debit", description: "Other payment channels" },
    { code: "1100", name: "Accounts Receivable", type: "asset", normal_side: "debit", description: "Unpaid/partial booking balances" },
    { code: "1200", name: "Inventory", type: "asset", normal_side: "debit", description: "Product stock at cost" },
    { code: "2001", name: "Accounts Payable", type: "liability", normal_side: "credit", description: "Unpaid obligations" },
    { code: "3000", name: "Retained Earnings", type: "equity", normal_side: "credit", description: "Accumulated net profit" },
    { code: "3100", name: "Partner Drawings", type: "equity", normal_side: "debit", description: "Payouts to partners (contra-equity)" },
    { code: "4001", name: "Booking Revenue", type: "revenue", normal_side: "credit", description: "Turf rental income" },
    { code: "4002", name: "Product Sales Revenue", type: "revenue", normal_side: "credit", description: "POS/retail product sales" },
    { code: "4003", name: "Tournament Revenue", type: "revenue", normal_side: "credit", description: "Tournament entry fees" },
    { code: "4099", name: "Miscellaneous Revenue", type: "revenue", normal_side: "credit", description: "Other income (sponsorships, etc.)" },
    { code: "5001", name: "Cost of Goods Sold", type: "cogs", normal_side: "debit", description: "Product cost basis on sale" },
    { code: "6001", name: "Rent", type: "expense", normal_side: "debit", description: "Venue/space rental" },
    { code: "6002", name: "Utilities", type: "expense", normal_side: "debit", description: "Electric, water, internet" },
    { code: "6003", name: "Salaries & Wages", type: "expense", normal_side: "debit", description: "Staff compensation" },
    { code: "6004", name: "Maintenance", type: "expense", normal_side: "debit", description: "Turf/facility upkeep" },
    { code: "6005", name: "Marketing", type: "expense", normal_side: "debit", description: "Advertising, promotions" },
    { code: "6006", name: "Equipment", type: "expense", normal_side: "debit", description: "Gear, tools, hardware" },
    { code: "6099", name: "Miscellaneous Expense", type: "expense", normal_side: "debit", description: "Uncategorized expenses" },
  ];

  await prisma.account.createMany({
    data: defaultAccounts.map(a => ({ ...a, is_system: 1, status: "active" }))
  });

  // 3. App Settings
  await prisma.appSetting.createMany({
    data: [
      { key: "business_name", value: "TurfSlot Sports Complex" },
      { key: "currency_symbol", value: "৳" },
      { key: "time_zone", value: "Asia/Dhaka" },
      { key: "tax_rate", value: "0" },
    ]
  });

  // 4. Users (Admin, Partners, Staff)
  console.log("Creating demo users & roles...");
  const salt = await bcrypt.genSalt(10);
  const adminPass = await bcrypt.hash("admin123", salt);
  const partnerPass = await bcrypt.hash("partner123", salt);
  const staffPass = await bcrypt.hash("staff123", salt);
  const zeroPass = await bcrypt.hash("00000000", salt);

  const admin1 = await prisma.user.create({
    data: {
      full_name: "Tanvir Rahman (Admin)",
      email: "admin@turfslot.com",
      password: adminPass,
      role: "admin",
      status: "active",
    }
  });

  const admin2 = await prisma.user.create({
    data: {
      full_name: "System Admin",
      email: "admin@mail.com",
      password: zeroPass,
      role: "admin",
      status: "active",
    }
  });

  const partner1 = await prisma.user.create({
    data: {
      full_name: "Rafiqul Islam (Partner - 60%)",
      email: "partner1@turfslot.com",
      password: partnerPass,
      role: "partner",
      status: "active",
    }
  });

  const partner2 = await prisma.user.create({
    data: {
      full_name: "Shahriar Ahmed (Partner - 40%)",
      email: "partner2@turfslot.com",
      password: partnerPass,
      role: "partner",
      status: "active",
    }
  });

  const staff1 = await prisma.user.create({
    data: {
      full_name: "Arif Hossain (Manager)",
      email: "manager@turfslot.com",
      password: staffPass,
      role: "staff",
      status: "active",
    }
  });

  const staff2 = await prisma.user.create({
    data: {
      full_name: "Kamrul Hasan (Staff)",
      email: "staff@turfslot.com",
      password: staffPass,
      role: "staff",
      status: "active",
    }
  });

  // 5. Profit Sharing History
  console.log("Setting up Partner Profit Sharing ratios...");
  const sixMonthsAgoStr = formatDate(startDate);
  await prisma.profitShareRatio.createMany({
    data: [
      { user_id: partner1.id, share_bp: 6000, effective_from: sixMonthsAgoStr, effective_to: null, version: 1 },
      { user_id: partner2.id, share_bp: 4000, effective_from: sixMonthsAgoStr, effective_to: null, version: 1 },
    ]
  });

  await prisma.profitShareChangeLog.create({
    data: {
      version: 1,
      changed_by: admin1.id,
      reason: "Initial partnership incorporation agreement (60/40)",
      snapshot: [
        { user_id: partner1.id, name: partner1.full_name, share_bp: 6000 },
        { user_id: partner2.id, name: partner2.full_name, share_bp: 4000 }
      ]
    }
  });

  // 6. Turfs
  console.log("Creating Turfs...");
  const turf1 = await prisma.turf.create({
    data: {
      name: "Thunder Arena",
      type: "7-a-side",
      size: "52m x 32m",
      location: "Gulshan-2, Dhaka",
      description: "FIFA-certified artificial turf with 500-lux stadium floodlights, premium player dugouts, and spectator seating.",
      base_price: 2500,
      peak_price: 3500,
      night_price: 3000,
      opening_hour: 6,
      closing_hour: 23,
      peak_hours_start: 17,
      peak_hours_end: 22,
      weekend_multiplier: 1.15,
      amenities: ["Floodlights", "Changing Rooms", "Locker Room", "Mineral Water", "Parking", "Free WiFi"],
      status: "active",
    }
  });

  const turf2 = await prisma.turf.create({
    data: {
      name: "Galaxy Field",
      type: "5-a-side",
      size: "40m x 22m",
      location: "Banani Block-E, Dhaka",
      description: "Fast-paced 5-a-side enclosed cage arena with impact netting and high-definition match recording cameras.",
      base_price: 1800,
      peak_price: 2600,
      night_price: 2200,
      opening_hour: 6,
      closing_hour: 23,
      peak_hours_start: 17,
      peak_hours_end: 22,
      weekend_multiplier: 1.10,
      amenities: ["LED Lights", "Dugout", "Washrooms", "Air Conditioning Lounge", "Sound System"],
      status: "active",
    }
  });

  const turf3 = await prisma.turf.create({
    data: {
      name: "Premier Turf Ground",
      type: "6-a-side",
      size: "46m x 26m",
      location: "Dhanmondi 27, Dhaka",
      description: "Semi-covered multi-sports turf suited for football, cricket practice, and corporate community matches.",
      base_price: 2200,
      peak_price: 3200,
      night_price: 2800,
      opening_hour: 6,
      closing_hour: 23,
      peak_hours_start: 17,
      peak_hours_end: 22,
      weekend_multiplier: 1.15,
      amenities: ["Covered Pavilion", "Shower Rooms", "Cafeteria", "Dedicated Parking", "First Aid"],
      status: "active",
    }
  });

  const turfs = [turf1, turf2, turf3];

  // 7. Products (Inventory)
  console.log("Creating POS products & initial inventory...");
  const productsData = [
    { name: "Kinley Mineral Water 500ml", category: "beverage", price: 25, cost_price: 18, stock: 260, unit: "bottle", sku: "BEV-WAT-01" },
    { name: "Speed Energy Drink 250ml", category: "beverage", price: 45, cost_price: 32, stock: 180, unit: "can", sku: "BEV-SPD-02" },
    { name: "Red Bull 250ml", category: "beverage", price: 180, cost_price: 140, stock: 95, unit: "can", sku: "BEV-RBL-03" },
    { name: "Gatorade Blue Chill 500ml", category: "beverage", price: 120, cost_price: 90, stock: 110, unit: "bottle", sku: "BEV-GAT-04" },
    { name: "Pocari Sweat Ion Supply 500ml", category: "beverage", price: 130, cost_price: 98, stock: 75, unit: "bottle", sku: "BEV-POC-05" },
    { name: "Nike Anti-Slip Grip Socks", category: "apparel", price: 380, cost_price: 240, stock: 45, unit: "pair", sku: "APP-SCK-01" },
    { name: "Puma Breathable Sports Bib", category: "apparel", price: 250, cost_price: 160, stock: 35, unit: "pcs", sku: "APP-BIB-02" },
    { name: "Elastic Captain Armband", category: "gear", price: 150, cost_price: 80, stock: 50, unit: "pcs", sku: "GAR-ARM-01" },
    { name: "High Impact Shin Guards", category: "gear", price: 550, cost_price: 360, stock: 28, unit: "pair", sku: "GAR-SHN-02" },
    { name: "Mikasa FT-5 Football Match Ball", category: "equipment", price: 2400, cost_price: 1750, stock: 15, unit: "pcs", sku: "EQP-BAL-01" },
    { name: "Pro Latex Goalkeeper Gloves", category: "gear", price: 1450, cost_price: 950, stock: 16, unit: "pair", sku: "GAR-GLV-01" },
    { name: "Instant Ice Spray (Relief 200ml)", category: "medical", price: 420, cost_price: 290, stock: 30, unit: "can", sku: "MED-ICE-01" },
  ];

  const createdProducts = [];
  for (const p of productsData) {
    const cp = await prisma.product.create({ data: { ...p, status: "active" } });
    createdProducts.push(cp);
  }

  // 8. Tournaments
  console.log("Creating Tournaments...");
  const t1StartDate = formatDate(addDays(today, -150));
  const t1EndDate = formatDate(addDays(today, -145));
  await prisma.tournament.create({
    data: {
      name: "Dhaka Champions Cup 2026",
      turf_id: turf1.id,
      turf_name: turf1.name,
      start_date: t1StartDate,
      end_date: t1EndDate,
      max_teams: 16,
      entry_fee: 6000,
      prize_pool: 60000,
      status: "completed",
      format: "knockout",
      description: "16-team premier futsal tournament with gold trophy, medals, and individual awards.",
      teams: [
        { name: "Gulshan Warriors", contact: "01711111111", status: "paid" },
        { name: "Banani Strikers", contact: "01722222222", status: "paid" },
        { name: "Dhanmondi Dragons", contact: "01733333333", status: "paid" },
        { name: "Uttara Kings", contact: "01744444444", status: "paid" },
        { name: "Mirpur United", contact: "01755555555", status: "paid" },
        { name: "Bashundhara Blitz", contact: "01766666666", status: "paid" },
        { name: "Old Dhaka Titans", contact: "01777777777", status: "paid" },
        { name: "Mohakhali Mavericks", contact: "01788888888", status: "paid" },
      ],
    }
  });

  const t2StartDate = formatDate(addDays(today, -75));
  const t2EndDate = formatDate(addDays(today, -73));
  await prisma.tournament.create({
    data: {
      name: "Independence Cup Futsal",
      turf_id: turf2.id,
      turf_name: turf2.name,
      start_date: t2StartDate,
      end_date: t2EndDate,
      max_teams: 8,
      entry_fee: 4500,
      prize_pool: 25000,
      status: "completed",
      format: "knockout",
      description: "Celebrating national football spirit with 8 top academy squads.",
      teams: [
        { name: "Red Green Tigers", contact: "01811111111", status: "paid" },
        { name: "71 Warriors", contact: "01822222222", status: "paid" },
        { name: "Bijoy XI", contact: "01833333333", status: "paid" },
        { name: "Freedom Fighters FC", contact: "01844444444", status: "paid" },
      ],
    }
  });

  const t3StartDate = formatDate(addDays(today, -1));
  const t3EndDate = formatDate(addDays(today, 6));
  await prisma.tournament.create({
    data: {
      name: "Dhaka Monsoon Super League 2026",
      turf_id: turf3.id,
      turf_name: turf3.name,
      start_date: t3StartDate,
      end_date: t3EndDate,
      max_teams: 12,
      entry_fee: 5000,
      prize_pool: 40000,
      status: "ongoing",
      format: "group_knockout",
      description: "High-intensity monsoon league with night floodlights and live streaming.",
      teams: [
        { name: "Storm Hawks", contact: "01911111111", status: "paid" },
        { name: "Cyclone Strikerz", contact: "01922222222", status: "paid" },
        { name: "Thunderbolts", contact: "01933333333", status: "paid" },
        { name: "Rainy Rooks", contact: "01944444444", status: "registered" },
      ],
    }
  });

  // Prepare ledger collections for batch insertion
  const batchJournalEntries = [];
  const batchJournalLines = [];

  const addBatchJournal = (entryDate, description, refType, refId, event, lines) => {
    const entryId = crypto.randomUUID();
    batchJournalEntries.push({
      id: entryId,
      entry_date: entryDate,
      description,
      reference_type: refType,
      reference_id: refId,
      posting_event: event,
      created_by: admin1.id,
      created_at: new Date(`${entryDate}T12:00:00Z`),
    });

    for (const l of lines) {
      batchJournalLines.push({
        id: crypto.randomUUID(),
        journal_entry_id: entryId,
        account_code: l.account_code,
        debit: l.debit || 0,
        credit: l.credit || 0,
        description: l.description || null,
        created_at: new Date(`${entryDate}T12:00:00Z`),
      });
    }
  };

  // Tournament revenues
  const tInc1Id = crypto.randomUUID();
  await prisma.income.create({
    data: {
      id: tInc1Id,
      description: "Dhaka Champions Cup 2026 entry fees (8 teams)",
      amount: 48000,
      account_code: "4003",
      payment_method: "bkash",
      payment_status: "paid",
      entry_date: t1StartDate,
      created_by: admin1.id,
    }
  });
  addBatchJournal(t1StartDate, "Tournament: Dhaka Champions Cup entry fees", "income", tInc1Id, "income:recorded", [
    { account_code: "1001", debit: 4800000, credit: 0, description: "bKash receipt" },
    { account_code: "4003", debit: 0, credit: 4800000, description: "Tournament revenue" },
  ]);

  const tInc2Id = crypto.randomUUID();
  await prisma.income.create({
    data: {
      id: tInc2Id,
      description: "Independence Cup Futsal entry fees (4 teams)",
      amount: 18000,
      account_code: "4003",
      payment_method: "nagad",
      payment_status: "paid",
      entry_date: t2StartDate,
      created_by: admin1.id,
    }
  });
  addBatchJournal(t2StartDate, "Tournament: Independence Cup entry fees", "income", tInc2Id, "income:recorded", [
    { account_code: "1002", debit: 1800000, credit: 0, description: "Nagad receipt" },
    { account_code: "4003", debit: 0, credit: 1800000, description: "Tournament revenue" },
  ]);

  // Partner drawings (Profit distributions)
  const addPayout = (date, partner, amount, method, refCode) => {
    const poisha = Math.round(amount * 100);
    addBatchJournal(date, `Partner drawing: ${partner.full_name}`, "partner_payout", refCode, "partner:payout", [
      { account_code: "3100", debit: poisha, credit: 0, description: `Payout to ${partner.full_name}` },
      { account_code: cashAccount(method), debit: 0, credit: poisha, description: `Disbursement via ${method}` },
    ]);
  };

  addPayout(formatDate(addDays(today, -120)), partner1, 150000, "bkash", "PAYOUT-2026-01");
  addPayout(formatDate(addDays(today, -120)), partner2, 100000, "nagad", "PAYOUT-2026-02");
  addPayout(formatDate(addDays(today, -50)), partner1, 180000, "card", "PAYOUT-2026-03");
  addPayout(formatDate(addDays(today, -50)), partner2, 120000, "card", "PAYOUT-2026-04");
  addPayout(formatDate(addDays(today, -10)), partner1, 120000, "bkash", "PAYOUT-2026-05");
  addPayout(formatDate(addDays(today, -10)), partner2, 80000, "nagad", "PAYOUT-2026-06");

  // 9. Generate Monthly Recurring Expenses & Incomes over 6 Months dynamically
  console.log("Generating dynamic monthly Expenses & Incomes with Double-Entry Ledger...");
  const months = [];
  const monthCursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  while (monthCursor <= currentMonthStart) {
    const y = monthCursor.getFullYear();
    const m = String(monthCursor.getMonth() + 1).padStart(2, "0");
    const mName = monthCursor.toLocaleString("en-US", { month: "long", year: "numeric" });
    months.push({
      name: mName,
      prefix: `${y}-${m}`,
      isCurrentMonth: (y === today.getFullYear() && monthCursor.getMonth() === today.getMonth()),
    });
    monthCursor.setMonth(monthCursor.getMonth() + 1);
  }

  const allExpenses = [];
  for (const m of months) {
    const isCurrent = m.isCurrentMonth;
    const currentDay = today.getDate();

    // Monthly Rent
    if (!isCurrent || currentDay >= 2) {
      const expId = crypto.randomUUID();
      const entryDate = `${m.prefix}-02`;
      allExpenses.push({
        id: expId,
        description: `Venue lease rent for 3 turf properties - ${m.name}`,
        amount: 85000,
        account_code: "6001",
        payment_method: "cash",
        payment_status: "paid",
        entry_date: entryDate,
        created_by: admin1.id,
      });
      addBatchJournal(entryDate, `Expense: Venue lease rent - ${m.name}`, "expense", expId, "expense:recorded", [
        { account_code: "6001", debit: 8500000, credit: 0, description: "Venue rental" },
        { account_code: "1004", debit: 0, credit: 8500000, description: "Cash payment" },
      ]);
    }

    // Salaries & Wages
    if (!isCurrent || currentDay >= 5) {
      const expId = crypto.randomUUID();
      const entryDate = `${m.prefix}-05`;
      allExpenses.push({
        id: expId,
        description: `Staff salaries (Manager, groundskeepers, security) - ${m.name}`,
        amount: 48000,
        account_code: "6003",
        payment_method: "cash",
        payment_status: "paid",
        entry_date: entryDate,
        created_by: admin1.id,
      });
      addBatchJournal(entryDate, `Expense: Staff salaries - ${m.name}`, "expense", expId, "expense:recorded", [
        { account_code: "6003", debit: 4800000, credit: 0, description: "Staff payroll" },
        { account_code: "1004", debit: 0, credit: 4800000, description: "Cash payroll payment" },
      ]);
    }

    // Utilities
    const utilDay = isCurrent ? Math.min(currentDay, 4) : 10;
    const utilDateStr = `${m.prefix}-${String(utilDay).padStart(2, "0")}`;
    const utilAmount = randomInt(24000, 31000);
    const utilExpId = crypto.randomUUID();
    allExpenses.push({
      id: utilExpId,
      description: `Electricity & floodlight bill (DESCO/DPDC) - ${m.name}`,
      amount: utilAmount,
      account_code: "6002",
      payment_method: "bkash",
      payment_status: "paid",
      entry_date: utilDateStr,
      created_by: admin1.id,
    });
    addBatchJournal(utilDateStr, `Expense: Utilities - ${m.name}`, "expense", utilExpId, "expense:recorded", [
      { account_code: "6002", debit: utilAmount * 100, credit: 0, description: "Electricity & floodlight" },
      { account_code: "1001", debit: 0, credit: utilAmount * 100, description: "bKash bill pay" },
    ]);

    // Maintenance
    const maintDay = isCurrent ? Math.min(currentDay, 3) : 18;
    const maintDateStr = `${m.prefix}-${String(maintDay).padStart(2, "0")}`;
    const maintAmount = randomInt(7000, 16000);
    const maintExpId = crypto.randomUUID();
    allExpenses.push({
      id: maintExpId,
      description: `Turf grooming, rubber infill & netting repair - ${m.name}`,
      amount: maintAmount,
      account_code: "6004",
      payment_method: "cash",
      payment_status: "paid",
      entry_date: maintDateStr,
      created_by: admin1.id,
    });
    addBatchJournal(maintDateStr, `Expense: Maintenance - ${m.name}`, "expense", maintExpId, "expense:recorded", [
      { account_code: "6004", debit: maintAmount * 100, credit: 0, description: "Turf upkeep" },
      { account_code: "1004", debit: 0, credit: maintAmount * 100, description: "Cash payment" },
    ]);

    // Marketing
    const mktDay = isCurrent ? Math.min(currentDay, 2) : 12;
    const mktDateStr = `${m.prefix}-${String(mktDay).padStart(2, "0")}`;
    const mktAmount = randomInt(5000, 12000);
    const mktExpId = crypto.randomUUID();
    allExpenses.push({
      id: mktExpId,
      description: `Social media advertising & tournament boost - ${m.name}`,
      amount: mktAmount,
      account_code: "6005",
      payment_method: "card",
      payment_status: "paid",
      entry_date: mktDateStr,
      created_by: admin1.id,
    });
    addBatchJournal(mktDateStr, `Expense: Marketing - ${m.name}`, "expense", mktExpId, "expense:recorded", [
      { account_code: "6005", debit: mktAmount * 100, credit: 0, description: "Digital promotions" },
      { account_code: "1005", debit: 0, credit: mktAmount * 100, description: "Card charge" },
    ]);

    // Equipment
    const eqDay = isCurrent ? 1 : 15;
    const eqDateStr = `${m.prefix}-${String(eqDay).padStart(2, "0")}`;
    const eqExpId = crypto.randomUUID();
    allExpenses.push({
      id: eqExpId,
      description: `Tournament match balls, corner flags & bib sets - ${m.name}`,
      amount: 8500,
      account_code: "6006",
      payment_method: "nagad",
      payment_status: "paid",
      entry_date: eqDateStr,
      created_by: admin1.id,
    });
    addBatchJournal(eqDateStr, `Expense: Equipment - ${m.name}`, "expense", eqExpId, "expense:recorded", [
      { account_code: "6006", debit: 850000, credit: 0, description: "Sports gear" },
      { account_code: "1002", debit: 0, credit: 850000, description: "Nagad payment" },
    ]);
  }

  await prisma.expense.createMany({ data: allExpenses });

  // Sponsorship Incomes
  const inc1Date = formatDate(addDays(today, -130));
  const inc1Id = crypto.randomUUID();
  await prisma.income.create({
    data: {
      id: inc1Id,
      description: "Pitch-side perimeter banner sponsorship from local sports brand",
      amount: 45000,
      account_code: "4099",
      payment_method: "bkash",
      payment_status: "paid",
      entry_date: inc1Date,
      created_by: admin1.id,
    }
  });
  addBatchJournal(inc1Date, "Sponsorship: Pitch-side banner", "income", inc1Id, "income:recorded", [
    { account_code: "1001", debit: 4500000, credit: 0, description: "bKash receipt" },
    { account_code: "4099", debit: 0, credit: 4500000, description: "Sponsorship revenue" },
  ]);

  const inc2Date = formatDate(addDays(today, -60));
  const inc2Id = crypto.randomUUID();
  await prisma.income.create({
    data: {
      id: inc2Id,
      description: "Exclusive beverage kiosk station fee for summer season",
      amount: 30000,
      account_code: "4099",
      payment_method: "nagad",
      payment_status: "paid",
      entry_date: inc2Date,
      created_by: admin1.id,
    }
  });
  addBatchJournal(inc2Date, "Kiosk: Station concession fee", "income", inc2Id, "income:recorded", [
    { account_code: "1002", debit: 3000000, credit: 0, description: "Nagad receipt" },
    { account_code: "4099", debit: 0, credit: 3000000, description: "Concession fee" },
  ]);

  // 10. Generate 450+ Realistic Bookings from 6 months ago through TODAY and 10 days upcoming
  console.log("Generating realistic historical, today's, and upcoming bookings with Ledger...");
  let curDate = new Date(startDate);

  const allBookings = [];
  const allPayments = [];
  const paymentMethods = ["bkash", "nagad", "rocket", "cash", "card"];

  while (curDate <= upcomingEndDate) {
    const dayStr = formatDate(curDate);
    const dayOfWeek = curDate.getUTCDay();
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
    const isToday = dayStr === todayStr;
    const isUpcoming = curDate > today && !isToday;

    // Balanced daily distribution: 2-4 bookings on weekdays, 4-5 on weekends (including today)
    const bookingsToday = isWeekend ? randomInt(4, 5) : randomInt(2, 4);

    const availableHours = [7, 8, 10, 15, 16, 17, 18, 19, 20, 21, 22];

    for (let b = 0; b < bookingsToday; b++) {
      const selectedTurf = randomChoice(turfs);
      const customer = randomChoice(CUSTOMER_NAMES);
      const phone = `017${randomInt(10000000, 99999999)}`;
      const startHour = randomChoice(availableHours);
      const durationHours = randomChoice([1, 1.5, 2]);
      const endHour = Math.min(23, Math.ceil(startHour + durationHours));

      let pricePerHour = selectedTurf.base_price;
      if (startHour >= selectedTurf.peak_hours_start && startHour < selectedTurf.peak_hours_end) {
        pricePerHour = selectedTurf.peak_price;
      } else if (startHour >= 21) {
        pricePerHour = selectedTurf.night_price;
      }
      if (isWeekend) {
        pricePerHour = Math.round(pricePerHour * selectedTurf.weekend_multiplier);
      }

      const totalPrice = Math.round(pricePerHour * durationHours);
      const method = randomChoice(paymentMethods);

      let status = "confirmed";
      let paymentStatus = "paid";
      let paidAmount = totalPrice;
      let paymentHistory = [];

      const rand = Math.random();
      if (rand < 0.02) {
        status = "cancelled";
        paymentStatus = "unpaid";
        paidAmount = 0;
      } else if (rand < 0.08) {
        paymentStatus = "unpaid";
        paidAmount = 0;
      } else if (rand < 0.18) {
        paymentStatus = "partial";
        paidAmount = Math.round(totalPrice * 0.4);
        paymentHistory.push({
          amount: paidAmount,
          date: dayStr,
          method,
          txn_id: `TRX-${randomInt(100000, 999999)}`,
          note: "Advance slot booking payment"
        });
      } else {
        paymentStatus = "paid";
        paidAmount = totalPrice;
        paymentHistory.push({
          amount: totalPrice,
          date: dayStr,
          method,
          txn_id: `TRX-${randomInt(100000, 999999)}`,
          note: "Full slot payment"
        });
      }

      const bookingId = crypto.randomUUID();
      const txnId = paymentHistory.length > 0 ? paymentHistory[0].txn_id : null;
      // Anchor created_at to the slot date so each day has its own balanced revenue
      const createdAtDate = new Date(`${dayStr}T${String(startHour).padStart(2, "0")}:00:00Z`);

      allBookings.push({
        id: bookingId,
        turf_id: selectedTurf.id,
        turf_name: selectedTurf.name,
        customer_name: customer,
        customer_phone: phone,
        customer_email: customer.toLowerCase().replace(/[^a-z0-9]/g, "") + "@example.com",
        date: dayStr,
        start_hour: startHour,
        end_hour: endHour,
        duration_hours: durationHours,
        total_price: totalPrice,
        paid_amount: paidAmount,
        payment_history: JSON.stringify(paymentHistory),
        status,
        payment_status: paymentStatus,
        payment_method: method,
        txn_id: txnId,
        created_at: createdAtDate,
      });

      if (status !== "cancelled") {
        if (paidAmount > 0) {
          allPayments.push({
            id: crypto.randomUUID(),
            booking_id: bookingId,
            amount: paidAmount,
            method,
            status: "completed",
            transaction_id: txnId,
            customer_name: customer,
            customer_phone: phone,
            created_at: createdAtDate,
          });
        }

        // Ledger entry for booking
        const totalPoisha = totalPrice * 100;
        const paidPoisha = (paymentStatus === "paid" ? totalPrice : paidAmount) * 100;
        const lines = [
          { account_code: "1100", debit: totalPoisha, credit: 0, description: "Accounts Receivable" },
          { account_code: "4001", debit: 0, credit: totalPoisha, description: "Booking Revenue" },
        ];
        if (paidPoisha > 0) {
          lines.push(
            { account_code: cashAccount(method), debit: paidPoisha, credit: 0, description: `Payment via ${method}` },
            { account_code: "1100", debit: 0, credit: paidPoisha, description: "AR settlement" }
          );
        }

        addBatchJournal(dayStr, `Booking: ${customer} - ${selectedTurf.name}`, "booking", bookingId, "booking:created", lines);
      }
    }

    curDate = addDays(curDate, 1);
  }

  console.log(`Inserting ${allBookings.length} bookings & ${allPayments.length} payments in batch...`);
  // Insert in chunks of 200 for maximum reliability & speed
  for (let i = 0; i < allBookings.length; i += 200) {
    await prisma.booking.createMany({ data: allBookings.slice(i, i + 200) });
  }
  for (let i = 0; i < allPayments.length; i += 200) {
    await prisma.payment.createMany({ data: allPayments.slice(i, i + 200) });
  }

  // 11. Generate POS Retail Orders up to today
  console.log("Generating POS Retail Orders & COGS Ledger records in batch...");
  curDate = new Date(startDate);
  const allOrders = [];

  while (curDate <= today) {
    const dayStr = formatDate(curDate);
    const isToday = dayStr === todayStr;
    const ordersToday = isToday ? 3 : randomInt(0, 2);

    for (let o = 0; o < ordersToday; o++) {
      const p1 = randomChoice(createdProducts);
      const p2 = randomChoice(createdProducts);
      const q1 = randomInt(1, 4);
      const q2 = randomInt(1, 2);

      const items = [
        { product_id: p1.id, name: p1.name, price: p1.price, cost_price: p1.cost_price, quantity: q1 },
      ];
      if (p1.id !== p2.id) {
        items.push({ product_id: p2.id, name: p2.name, price: p2.price, cost_price: p2.cost_price, quantity: q2 });
      }

      const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const costTotal = items.reduce((sum, item) => sum + item.cost_price * item.quantity, 0);
      const method = randomChoice(["cash", "bkash", "nagad"]);
      const orderId = crypto.randomUUID();

      allOrders.push({
        id: orderId,
        customer_name: randomChoice(CUSTOMER_NAMES).split(":")[0].trim(),
        customer_phone: `018${randomInt(10000000, 99999999)}`,
        items: JSON.stringify(items),
        total_amount: totalAmount,
        status: "confirmed",
        payment_method: method,
        payment_status: "paid",
        notes: "Counter retail sale",
        created_at: new Date(`${dayStr}T18:30:00Z`),
      });

      const totalPoisha = totalAmount * 100;
      const costPoisha = costTotal * 100;
      addBatchJournal(dayStr, "POS Sale: Counter retail order", "order", orderId, "order:created", [
        { account_code: cashAccount(method), debit: totalPoisha, credit: 0, description: "Cash from retail sale" },
        { account_code: "4002", debit: 0, credit: totalPoisha, description: "Product Sales Revenue" },
        { account_code: "5001", debit: costPoisha, credit: 0, description: "COGS - retail sale" },
        { account_code: "1200", debit: 0, credit: costPoisha, description: "Inventory reduction" },
      ]);
    }

    curDate = addDays(curDate, 1);
  }

  for (let i = 0; i < allOrders.length; i += 200) {
    await prisma.order.createMany({ data: allOrders.slice(i, i + 200) });
  }

  console.log(`Inserting ${batchJournalEntries.length} journal entries & ${batchJournalLines.length} lines in batch...`);
  for (let i = 0; i < batchJournalEntries.length; i += 200) {
    await prisma.journalEntry.createMany({ data: batchJournalEntries.slice(i, i + 200) });
  }
  for (let i = 0; i < batchJournalLines.length; i += 300) {
    await prisma.journalLine.createMany({ data: batchJournalLines.slice(i, i + 300) });
  }

  console.log(`\n========================================`);
  console.log(`✅ DEMO DATA SEEDED SUCCESSFULLY TO TODAY (${todayStr})!`);
  console.log(`========================================`);
  console.log(`📊 Total Turfs Created:       ${turfs.length}`);
  console.log(`⚽ Total Bookings Created:    ${allBookings.length}`);
  console.log(`💳 Total Payments Recorded:   ${allPayments.length}`);
  console.log(`🛍️ Total Retail Orders:       ${allOrders.length}`);
  console.log(`📦 Inventory Products:        ${createdProducts.length}`);
  console.log(`🏆 Tournaments Hosted:        3 (incl. ongoing Monsoon Super League)`);
  console.log(`🏢 Chart of Accounts:         23 System Accounts`);
  console.log(`📚 Ledger Journal Entries:    ${batchJournalEntries.length} Balanced Entries (${batchJournalLines.length} lines)`);
  console.log(`========================================\n`);

  await prisma.$disconnect();
}

seedFullDemo().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
