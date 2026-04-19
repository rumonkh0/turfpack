import { initDatabase, getDbPath } from "../db/sqlite.js";

/**
 * SQLite connection setup
 */
const connectDB = async () => {
  // Try to load dotenv only in development
  if (process.env.NODE_ENV !== "production") {
    try {
      const dotenv = await import("dotenv");
      dotenv.config();
    } catch (e) {
      console.warn("Dotenv not found, skipping...");
    }
  }

  try {
    initDatabase();
    console.log(`✅ SQLite Connected: ${getDbPath()}`);
  } catch (error) {
    console.error(`❌ Error connecting to SQLite: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
