import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import connectDB from "../config/db.js";
import { clearAllTables, createRecord } from "../db/sqlite.js";

dotenv.config();

const seedData = async () => {
  try {
    await connectDB();
    console.log("Connected to SQLite for seeding...");

    // Clear existing data
    clearAllTables();

    // Create Admin User
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("admin123", salt);

    createRecord("users", {
      full_name: "Local Admin",
      email: "admin@turfslot.com",
      password: hashedPassword,
      role: "admin",
    });

    // Create Sample Turfs
    const turfA = createRecord("turfs", {
      name: "Wembley Arena",
      type: "5-a-side",
      size: "40x20m",
      location: "Gulshan, Dhaka",
      base_price: 2000,
      peak_price: 3000,
      night_price: 2500,
      status: "active",
      amenities: ["Changing Room", "Parking", "Mineral Water"],
    });

    const turfB = createRecord("turfs", {
      name: "Camp Nou Ground",
      type: "7-a-side",
      size: "50x30m",
      location: "Banani, Dhaka",
      base_price: 3500,
      peak_price: 5000,
      night_price: 4000,
      status: "active",
      amenities: ["Parking", "Shower"],
    });

    // Create Sample Bookings
    const today = new Date().toISOString().split("T")[0];
    const bookingA = createRecord("bookings", {
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
    });

    createRecord("bookings", {
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
    });

    // Create Sample Payments
    createRecord("payments", {
      booking_id: bookingA.id,
      amount: 3000,
      method: "bkash",
      status: "completed",
      transaction_id: "TRX_889922",
      customer_name: "Sabbir Tanvir",
      customer_phone: "01712345678",
    });

    // Create Sample Products
    createRecord("products", {
      name: "Mineral Water 500ml",
      category: "beverage",
      price: 20,
      cost_price: 15,
      stock: 100,
      status: "active",
    });

    createRecord("products", {
      name: "Energy Drink",
      category: "beverage",
      price: 100,
      cost_price: 80,
      stock: 50,
      status: "active",
    });

    console.log("✅ Data Seeded Successfully with Bookings and Payments!");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedData();
