import prisma from "../db/prismaClient.js";

/**
 * Prisma connection setup
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
    await prisma.$connect();
    console.log(`✅ Prisma Connected to Database`);
  } catch (error) {
    console.error(`❌ Error connecting to database via Prisma: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
