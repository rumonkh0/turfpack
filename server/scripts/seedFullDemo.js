import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import prisma from "../db/prismaClient.js";
import {
  postBookingCreated,
  postBookingInstallment,
  postOrderCreated,
  postExpense,
  postIncome,
  postPartnerPayout,
} from "../services/ledgerPostingService.js";

dotenv.config();

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(d, days) {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

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
  console.log("🚀 Starting comprehensive 6-month demo dataset seeding...");
  console.log(`Connecting to: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ":***@")}`);

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

  for (const acc of defaultAccounts) {
    await prisma.account.create({ data: { ...acc, is_system: 1, status: "active" } });
  }

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

  // 5. Profit Sharing History (60/40 Split setup 6 months ago)
  console.log("Setting up Partner Profit Sharing ratios...");
  const sixMonthsAgoStr = "2026-02-01";
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
  await prisma.tournament.create({
    data: {
      name: "Dhaka Champions Cup 2026",
      turf_id: turf1.id,
      turf_name: turf1.name,
      start_date: "2026-03-10",
      end_date: "2026-03-15",
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

  await prisma.tournament.create({
    data: {
      name: "Independence Cup Futsal",
      turf_id: turf2.id,
      turf_name: turf2.name,
      start_date: "2026-03-26",
      end_date: "2026-03-27",
      max_teams: 8,
      entry_fee: 4500,
      prize_pool: 25000,
      status: "completed",
      format: "knockout",
      description: "National Independence Day celebratory 5-a-side championship.",
      teams: [
        { name: "Red Green Tigers", contact: "01811111111", status: "paid" },
        { name: "71 Warriors", contact: "01822222222", status: "paid" },
        { name: "Bijoy XI", contact: "01833333333", status: "paid" },
        { name: "Freedom Fighters FC", contact: "01844444444", status: "paid" },
      ],
    }
  });

  await prisma.tournament.create({
    data: {
      name: "Monsoon Super League 2026",
      turf_id: turf3.id,
      turf_name: turf3.name,
      start_date: "2026-08-20",
      end_date: "2026-08-25",
      max_teams: 12,
      entry_fee: 5000,
      prize_pool: 40000,
      status: "upcoming",
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

  // Post tournament revenue journal entries for completed tournaments
  const tournInc1 = await prisma.income.create({
    data: {
      description: "Dhaka Champions Cup 2026 entry fees (8 teams)",
      amount: 48000,
      account_code: "4003",
      payment_method: "bkash",
      payment_status: "paid",
      entry_date: "2026-03-10",
      created_by: admin1.id,
    }
  });
  await postIncome(tournInc1, admin1.id);

  const tournInc2 = await prisma.income.create({
    data: {
      description: "Independence Cup Futsal entry fees (4 teams)",
      amount: 18000,
      account_code: "4003",
      payment_method: "nagad",
      payment_status: "paid",
      entry_date: "2026-03-26",
      created_by: admin1.id,
    }
  });
  await postIncome(tournInc2, admin1.id);

  // Partner drawings (Profit distributions) in April & July
  await postPartnerPayout("PAYOUT-2026-01", partner1, 150000, "bkash", "2026-04-10", admin1.id);
  await postPartnerPayout("PAYOUT-2026-02", partner2, 100000, "nagad", "2026-04-10", admin1.id);
  await postPartnerPayout("PAYOUT-2026-03", partner1, 180000, "card", "2026-07-15", admin1.id);
  await postPartnerPayout("PAYOUT-2026-04", partner2, 120000, "card", "2026-07-15", admin1.id);

  // 9. Generate Monthly Recurring Expenses & Incomes over 6 Months (Feb 2026 - Aug 2026)
  console.log("Generating 6-month historical Expenses & Incomes with Double-Entry Ledger...");
  const months = [
    { name: "February 2026", prefix: "2026-02" },
    { name: "March 2026", prefix: "2026-03" },
    { name: "April 2026", prefix: "2026-04" },
    { name: "May 2026", prefix: "2026-05" },
    { name: "June 2026", prefix: "2026-06" },
    { name: "July 2026", prefix: "2026-07" },
    { name: "August 2026", prefix: "2026-08" },
  ];

  for (const m of months) {
    const isAug = m.prefix === "2026-08";

    // Monthly Rent
    const rentExp = await prisma.expense.create({
      data: {
        description: `Venue lease rent for 3 turf properties - ${m.name}`,
        amount: 85000,
        account_code: "6001",
        payment_method: "cash",
        payment_status: "paid",
        entry_date: `${m.prefix}-02`,
        created_by: admin1.id,
      }
    });
    await postExpense(rentExp, admin1.id);

    // Utilities (Electricity, Floodlights & Generators)
    const utilAmount = randomInt(24000, 31000);
    const utilExp = await prisma.expense.create({
      data: {
        description: `Electricity & floodlight bill (DESCO/DPDC) - ${m.name}`,
        amount: utilAmount,
        account_code: "6002",
        payment_method: "bkash",
        payment_status: "paid",
        entry_date: `${m.prefix}-10`,
        created_by: admin1.id,
      }
    });
    await postExpense(utilExp, admin1.id);

    // Salaries & Wages
    const staffExp = await prisma.expense.create({
      data: {
        description: `Staff salaries (Manager, groundskeepers, security) - ${m.name}`,
        amount: 48000,
        account_code: "6003",
        payment_method: "cash",
        payment_status: "paid",
        entry_date: `${m.prefix}-05`,
        created_by: admin1.id,
      }
    });
    await postExpense(staffExp, admin1.id);

    // Maintenance & Supplies
    const maintAmount = randomInt(7000, 16000);
    const maintExp = await prisma.expense.create({
      data: {
        description: `Turf grooming, rubber infill & netting repair - ${m.name}`,
        amount: maintAmount,
        account_code: "6004",
        payment_method: "cash",
        payment_status: "paid",
        entry_date: `${m.prefix}-18`,
        created_by: admin1.id,
      }
    });
    await postExpense(maintExp, admin1.id);

    // Marketing (Meta Ads & Local Promotion)
    const mktAmount = randomInt(5000, 12000);
    const mktExp = await prisma.expense.create({
      data: {
        description: `Social media advertising & tournament boost - ${m.name}`,
        amount: mktAmount,
        account_code: "6005",
        payment_method: "card",
        payment_status: "paid",
        entry_date: `${m.prefix}-12`,
        created_by: admin1.id,
      }
    });
    await postExpense(mktExp, admin1.id);

    // Equipment purchases in selected months
    if (["2026-02", "2026-04", "2026-07"].includes(m.prefix)) {
      const eqExp = await prisma.expense.create({
        data: {
          description: `New tournament match balls, corner flags & bib sets`,
          amount: 8500,
          account_code: "6006",
          payment_method: "nagad",
          payment_status: "paid",
          entry_date: `${m.prefix}-15`,
          created_by: admin1.id,
        }
      });
      await postExpense(eqExp, admin1.id);
    }
  }

  // Sponsorship & Misc Income records
  const inc1 = await prisma.income.create({
    data: {
      description: "Pitch-side perimeter banner sponsorship from local sports brand",
      amount: 45000,
      account_code: "4099",
      payment_method: "bkash",
      payment_status: "paid",
      entry_date: "2026-03-08",
      created_by: admin1.id,
    }
  });
  await postIncome(inc1, admin1.id);

  const inc2 = await prisma.income.create({
    data: {
      description: "Exclusive beverage kiosk station fee for summer season",
      amount: 30000,
      account_code: "4099",
      payment_method: "nagad",
      payment_status: "paid",
      entry_date: "2026-05-15",
      created_by: admin1.id,
    }
  });
  await postIncome(inc2, admin1.id);

  // 10. Generate 400+ Realistic Bookings over 195 days (Feb 1, 2026 to Aug 14, 2026)
  console.log("Generating 400+ realistic historical bookings & ledger records...");
  const startDate = new Date("2026-02-01T00:00:00Z");
  const endDate = new Date("2026-08-14T00:00:00Z");
  let curDate = new Date(startDate);

  let totalBookingsCount = 0;
  let totalPaymentsCount = 0;

  const paymentMethods = ["bkash", "nagad", "rocket", "cash", "card"];

  while (curDate <= endDate) {
    const dayStr = formatDate(curDate);
    const dayOfWeek = curDate.getUTCDay(); // 5 = Friday, 6 = Saturday (weekend in Bangladesh)
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

    // 2-4 bookings on weekdays, 4-7 bookings on weekends
    const bookingsToday = isWeekend ? randomInt(4, 7) : randomInt(2, 4);

    for (let b = 0; b < bookingsToday; b++) {
      const selectedTurf = randomChoice(turfs);
      const customer = randomChoice(CUSTOMER_NAMES);
      const phone = `017${randomInt(10000000, 99999999)}`;
      const startHour = randomChoice([7, 8, 16, 17, 18, 19, 20, 21, 22]);
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

      // Status determination: 88% full paid, 7% partial, 4% unpaid, 1% cancelled
      const rand = Math.random();
      let status = "confirmed";
      let paymentStatus = "paid";
      let paidAmount = totalPrice;
      let paymentHistory = [];

      if (rand < 0.01) {
        status = "cancelled";
        paymentStatus = "unpaid";
        paidAmount = 0;
      } else if (rand < 0.05) {
        paymentStatus = "unpaid";
        paidAmount = 0;
      } else if (rand < 0.12) {
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

      const bookingRecord = await prisma.booking.create({
        data: {
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
          payment_history: paymentHistory,
          status,
          payment_status: paymentStatus,
          payment_method: method,
          txn_id: paymentHistory.length > 0 ? paymentHistory[0].txn_id : null,
          created_at: new Date(`${dayStr}T${String(startHour).padStart(2, "0")}:00:00Z`),
        }
      });

      totalBookingsCount++;

      // Create Payment record & Post double entry ledger
      if (status !== "cancelled") {
        if (paidAmount > 0) {
          await prisma.payment.create({
            data: {
              booking_id: bookingRecord.id,
              amount: paidAmount,
              method,
              status: "completed",
              transaction_id: bookingRecord.txn_id,
              customer_name: customer,
              customer_phone: phone,
              created_at: bookingRecord.created_at,
            }
          });
          totalPaymentsCount++;
        }

        // Post to general ledger
        await postBookingCreated(bookingRecord, staff1.id);
      }
    }

    curDate = addDays(curDate, 1);
  }

  // 11. Generate 140+ POS Retail Orders across the 6 Months
  console.log("Generating POS Retail Orders & COGS Ledger records...");
  curDate = new Date(startDate);
  let totalOrdersCount = 0;

  while (curDate <= endDate) {
    const dayStr = formatDate(curDate);
    // 0 to 2 orders per day
    const ordersToday = randomInt(0, 2);

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

      const orderRecord = await prisma.order.create({
        data: {
          customer_name: randomChoice(CUSTOMER_NAMES).split(":")[0].trim(),
          customer_phone: `018${randomInt(10000000, 99999999)}`,
          items,
          total_amount: totalAmount,
          status: "confirmed",
          payment_method: method,
          payment_status: "paid",
          notes: "Counter retail sale",
          created_at: new Date(`${dayStr}T18:30:00Z`),
        }
      });

      totalOrdersCount++;
      await postOrderCreated(orderRecord, costTotal, staff1.id);
    }

    curDate = addDays(curDate, 1);
  }

  console.log(`\n========================================`);
  console.log(`✅ DEMO DATA SEEDED SUCCESSFULLY!`);
  console.log(`========================================`);
  console.log(`📊 Total Turfs Created:       ${turfs.length}`);
  console.log(`⚽ Total Bookings Created:    ${totalBookingsCount}`);
  console.log(`💳 Total Payments Recorded:   ${totalPaymentsCount}`);
  console.log(`🛍️ Total Retail Orders:       ${totalOrdersCount}`);
  console.log(`📦 Inventory Products:        ${createdProducts.length}`);
  console.log(`🏆 Tournaments Hosted:        3`);
  console.log(`🏢 Chart of Accounts:         23 System Accounts`);
  console.log(`📚 Ledger Journal Entries:    Balanced Double-Entry accounting posted`);
  console.log(`========================================\n`);

  await prisma.$disconnect();
}

seedFullDemo().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
