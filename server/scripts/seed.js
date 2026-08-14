import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import connectDB from "../config/db.js";
import prisma from "../db/prismaClient.js";

dotenv.config();

const seedData = async () => {
  try {
    await connectDB();
    console.log("Connected to database for seeding...");

    // Clear existing data (in reverse dependency order to avoid foreign key errors, though SQLite might be lenient)
    await prisma.payment.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.order.deleteMany();
    await prisma.product.deleteMany();
    await prisma.turf.deleteMany();
    await prisma.profitShareChangeLog.deleteMany();
    await prisma.profitShareRatio.deleteMany();
    await prisma.journalLine.deleteMany();
    await prisma.journalEntry.deleteMany();
    await prisma.account.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.income.deleteMany();
    await prisma.tournament.deleteMany();
    await prisma.user.deleteMany();

    // Seed Chart of Accounts
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

    // Create Users (Admin, Partner, Staff)
    const salt = await bcrypt.genSalt(10);
    const adminPass = await bcrypt.hash("admin123", salt);
    const partnerPass = await bcrypt.hash("partner123", salt);
    const staffPass = await bcrypt.hash("staff123", salt);

    const adminUser = await prisma.user.create({
      data: {
        full_name: "Local Admin",
        email: "admin@turfslot.com",
        password: adminPass,
        role: "admin",
      }
    });

    const partnerUser = await prisma.user.create({
      data: {
        full_name: "Partner Owner",
        email: "partner@turfslot.com",
        password: partnerPass,
        role: "partner",
      }
    });

    const staffUser = await prisma.user.create({
      data: {
        full_name: "Staff Member",
        email: "staff@turfslot.com",
        password: staffPass,
        role: "staff",
      }
    });

    // Assign Initial Profit Share for Partner (100% = 10000 basis points)
    const today = new Date().toISOString().split("T")[0];
    await prisma.profitShareRatio.create({
      data: {
        user_id: partnerUser.id,
        share_bp: 10000,
        effective_from: today,
        version: 1,
      }
    });

    // Create Sample Turfs
    const turfA = await prisma.turf.create({
      data: {
        name: "Wembley Arena",
        type: "5-a-side",
        size: "40x20m",
        location: "Gulshan, Dhaka",
        base_price: 2000,
        peak_price: 3000,
        night_price: 2500,
        status: "active",
        amenities: ["Changing Room", "Parking", "Mineral Water"],
      }
    });

    const turfB = await prisma.turf.create({
      data: {
        name: "Camp Nou Ground",
        type: "7-a-side",
        size: "50x30m",
        location: "Banani, Dhaka",
        base_price: 3500,
        peak_price: 5000,
        night_price: 4000,
        status: "active",
        amenities: ["Parking", "Shower"],
      }
    });

    // Create Sample Bookings
    const bookingA = await prisma.booking.create({
      data: {
        turf_id: turfA.id,
        turf_name: turfA.name,
        customer_name: "Sabbir Tanvir",
        customer_phone: "01712345678",
        date: today,
        start_hour: 17,
        end_hour: 18,
        total_price: 3000,
        status: "confirmed",
        payment_status: "paid",
        payment_method: "bkash",
      }
    });

    await prisma.booking.create({
      data: {
        turf_id: turfB.id,
        turf_name: turfB.name,
        customer_name: "Tanvir Mahtab",
        customer_phone: "01887654321",
        date: today,
        start_hour: 20,
        end_hour: 21,
        total_price: 5000,
        status: "confirmed",
        payment_status: "unpaid",
        payment_method: "cash",
      }
    });

    // Create Sample Payments
    await prisma.payment.create({
      data: {
        booking_id: bookingA.id,
        amount: 3000,
        method: "bkash",
        status: "completed",
        transaction_id: "TRX_889922",
        customer_name: "Sabbir Tanvir",
        customer_phone: "01712345678",
      }
    });

    // Create Sample Products
    await prisma.product.create({
      data: {
        name: "Mineral Water 500ml",
        category: "beverage",
        price: 20,
        cost_price: 15,
        stock: 100,
        status: "active",
      }
    });

    await prisma.product.create({
      data: {
        name: "Energy Drink",
        category: "beverage",
        price: 100,
        cost_price: 80,
        stock: 50,
        status: "active",
      }
    });

    console.log("✅ Data Seeded Successfully with Bookings and Payments!");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedData();
