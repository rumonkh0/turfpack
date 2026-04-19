import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Route files
import authRoutes from "./routes/authRoutes.js";
import turfRoutes from "./routes/turfRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import tournamentRoutes from "./routes/tournamentRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import errorHandler from "./middleware/error.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localUploadDir =
  process.env.LOCAL_UPLOAD_DIR || path.resolve(process.cwd(), "server/uploads");

// Body parser
app.use(express.json());

// Cookie parser
app.use(cookieParser());

// Dev logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Allowed CORS origins
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5000",
  "https://turf.rumon.top",
  "https://admin.turf.rumon.top",
  "https://api.turf.rumon.top",
];

const corsOptions = {
  origin: function (origin, callback) {
    // Log origin for debugging
    console.log("Incoming Origin:", origin);

    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(
      origin,
    );

    // Check if origin is allowed by list or by subdomain pattern
    const isAllowed =
      isLocalOrigin ||
      allowedOrigins.includes(origin) ||
      origin.endsWith(".rumon.top");

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn("CORS Blocked for Origin:", origin);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Cookie",
  ],
};

// Enable CORS with options
app.use(cors(corsOptions));
// Handle preflight requests globally
app.options("*", cors(corsOptions));

// Set security headers
app.use(
  helmet({
    crossOriginResourcePolicy: false, // Disable to prevent conflicts with CORS
  }),
);

// Mount routers
app.use("/api/auth", authRoutes);
app.use("/api/turfs", turfRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);
app.use("/api/upload", uploadRoutes);

// Serve local uploaded files (used when Cloudinary is not configured)
if (fs.existsSync(localUploadDir)) {
  app.use("/uploads", express.static(localUploadDir));
}

// Serve frontend build in production/desktop mode
const shouldServeClient =
  process.env.NODE_ENV === "production" || process.env.SERVE_CLIENT === "true";

const clientDistCandidates = [
  path.resolve(__dirname, "../client/dist"),
  path.resolve(process.cwd(), "client/dist"),
  path.resolve(process.resourcesPath || "", "app.asar/client/dist"),
  path.resolve(process.resourcesPath || "", "client/dist"),
];

const clientDistPath = clientDistCandidates.find((candidate) => {
  if (!candidate || candidate === ".") return false;
  return fs.existsSync(path.join(candidate, "index.html"));
});

if (shouldServeClient && clientDistPath) {
  console.log(`Serving client from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    return res.sendFile(path.join(clientDistPath, "index.html"));
  });
} else if (shouldServeClient) {
  console.warn("Client build not found. Checked paths:", clientDistCandidates);
}

// Error handling middleware
app.use(errorHandler);

export default app;
